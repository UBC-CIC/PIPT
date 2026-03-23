"""Unit tests for extract_text_from_file."""

import pytest
import pymupdf
import sys
import types

# Stub out heavy dependencies so we can import chat.py without them
for mod_name in [
    "psycopg2", "langchain_aws", "langchain_core", "langchain_core.prompts",
    "langchain_core.runnables", "langchain_core.runnables.history",
    "langchain_classic", "langchain_classic.chains",
    "langchain_classic.chains.combine_documents",
    "langchain_community", "langchain_community.chat_message_histories",
    "pydantic",
]:
    if mod_name not in sys.modules:
        sys.modules[mod_name] = types.ModuleType(mod_name)

# Provide stubs for specific names used at import time
_lc_aws = sys.modules["langchain_aws"]
_lc_aws.ChatBedrock = type("ChatBedrock", (), {})
_lc_aws.BedrockLLM = type("BedrockLLM", (), {})

_lc_prompts = sys.modules.setdefault("langchain_core.prompts", types.ModuleType("langchain_core.prompts"))
_lc_prompts.ChatPromptTemplate = type("ChatPromptTemplate", (), {})
_lc_prompts.MessagesPlaceholder = type("MessagesPlaceholder", (), {})

_lc_history = sys.modules.setdefault("langchain_core.runnables.history", types.ModuleType("langchain_core.runnables.history"))
_lc_history.RunnableWithMessageHistory = type("RunnableWithMessageHistory", (), {})

_lc_combine = sys.modules.setdefault("langchain_classic.chains.combine_documents", types.ModuleType("langchain_classic.chains.combine_documents"))
_lc_combine.create_stuff_documents_chain = lambda *a, **kw: None

_lc_chains = sys.modules["langchain_classic.chains"]
_lc_chains.create_retrieval_chain = lambda *a, **kw: None

_lc_ddb = sys.modules.setdefault("langchain_community.chat_message_histories", types.ModuleType("langchain_community.chat_message_histories"))
_lc_ddb.DynamoDBChatMessageHistory = type("DynamoDBChatMessageHistory", (), {})

_pydantic = sys.modules["pydantic"]
_pydantic.BaseModel = type("BaseModel", (), {})
_pydantic.Field = lambda **kw: None

import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from chat import extract_text_from_file, retrieve_answer_key_text, SUPPORTED_ANSWER_KEY_EXTENSIONS


def _make_pdf_bytes(text: str) -> bytes:
    """Create a minimal PDF containing the given text."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class TestExtractTextFromFile:
    def test_extracts_text_from_pdf(self):
        content = "Hello pharmacy student"
        pdf_bytes = _make_pdf_bytes(content)
        result = extract_text_from_file(pdf_bytes, "pdf")
        assert content in result

    def test_handles_extension_with_dot(self):
        content = "Dotted extension test"
        pdf_bytes = _make_pdf_bytes(content)
        result = extract_text_from_file(pdf_bytes, ".pdf")
        assert content in result

    def test_handles_uppercase_extension(self):
        content = "Uppercase extension"
        pdf_bytes = _make_pdf_bytes(content)
        result = extract_text_from_file(pdf_bytes, "PDF")
        assert content in result

    def test_returns_empty_on_invalid_bytes(self):
        result = extract_text_from_file(b"not a real file", "pdf")
        assert result == ""

    def test_returns_empty_on_empty_bytes(self):
        result = extract_text_from_file(b"", "pdf")
        assert result == ""

    def test_multipage_pdf(self):
        doc = pymupdf.open()
        page1 = doc.new_page()
        page1.insert_text((72, 72), "Page one content")
        page2 = doc.new_page()
        page2.insert_text((72, 72), "Page two content")
        pdf_bytes = doc.tobytes()
        doc.close()

        result = extract_text_from_file(pdf_bytes, "pdf")
        assert "Page one content" in result
        assert "Page two content" in result

    def test_returns_string_type(self):
        pdf_bytes = _make_pdf_bytes("type check")
        result = extract_text_from_file(pdf_bytes, "pdf")
        assert isinstance(result, str)

from unittest.mock import patch, MagicMock
from io import BytesIO


class TestRetrieveAnswerKeyText:
    def test_returns_empty_when_bucket_env_not_set(self, monkeypatch):
        monkeypatch.delenv("EMBEDDING_STORAGE_BUCKET", raising=False)
        result = retrieve_answer_key_text("sg1", "p1")
        assert result == ""

    def test_returns_empty_when_no_files_found(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {"Contents": []}
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert result == ""

    def test_returns_empty_when_s3_list_fails(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        mock_client = MagicMock()
        mock_client.list_objects_v2.side_effect = Exception("S3 error")
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert result == ""

    def test_constructs_correct_s3_prefix(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "my-bucket")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {"Contents": []}
        with patch("chat.boto3.client", return_value=mock_client):
            retrieve_answer_key_text("group-abc", "persona-xyz")
        mock_client.list_objects_v2.assert_called_once_with(
            Bucket="my-bucket", Prefix="group-abc/persona-xyz/answer_key/"
        )

    def test_extracts_text_from_pdf_in_s3(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        pdf_bytes = _make_pdf_bytes("Answer key content")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {
            "Contents": [{"Key": "sg1/p1/answer_key/answers.pdf"}]
        }
        mock_body = MagicMock()
        mock_body.read.return_value = pdf_bytes
        mock_client.get_object.return_value = {"Body": mock_body}
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert "Answer key content" in result

    def test_skips_unsupported_extensions(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {
            "Contents": [{"Key": "sg1/p1/answer_key/image.jpg"}]
        }
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert result == ""
        mock_client.get_object.assert_not_called()

    def test_skips_failed_files_and_continues(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        pdf_bytes = _make_pdf_bytes("Good file content")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "sg1/p1/answer_key/bad.pdf"},
                {"Key": "sg1/p1/answer_key/good.pdf"},
            ]
        }
        mock_body_good = MagicMock()
        mock_body_good.read.return_value = pdf_bytes
        mock_client.get_object.side_effect = [
            Exception("download failed"),
            {"Body": mock_body_good},
        ]
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert "Good file content" in result

    def test_concatenates_multiple_files(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_STORAGE_BUCKET", "test-bucket")
        pdf1 = _make_pdf_bytes("First document")
        pdf2 = _make_pdf_bytes("Second document")
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "sg1/p1/answer_key/a.pdf"},
                {"Key": "sg1/p1/answer_key/b.pdf"},
            ]
        }
        body1 = MagicMock()
        body1.read.return_value = pdf1
        body2 = MagicMock()
        body2.read.return_value = pdf2
        mock_client.get_object.side_effect = [
            {"Body": body1},
            {"Body": body2},
        ]
        with patch("chat.boto3.client", return_value=mock_client):
            result = retrieve_answer_key_text("sg1", "p1")
        assert "First document" in result
        assert "Second document" in result
