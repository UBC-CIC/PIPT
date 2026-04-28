"""
Cohere Embed v4 wrapper for Amazon Bedrock.

Drop-in replacement for LangChain's BedrockEmbeddings that handles
Cohere Embed v4's different API format:
  - Request: { "texts": [...], "input_type": "search_query"|"search_document", "embedding_types": ["float"] }
  - Response: { "embeddings": { "float": [[...]] } }

Uses cross-region inference profile (us.cohere.embed-v4:0) when the
model ID starts with "cohere.embed".
"""

import json
import logging
from langchain_core.embeddings import Embeddings

logger = logging.getLogger(__name__)


class CohereBedrockEmbeddings(Embeddings):
    """Thin wrapper around Bedrock's invoke_model for Cohere Embed v4.

    Extends LangChain's Embeddings base class so it can be used anywhere
    BedrockEmbeddings is expected (PGVector, etc.).
    """

    def __init__(self, *, model_id: str, client, region_name: str):
        # Use cross-region inference profile for Cohere models
        if model_id.startswith("cohere.embed"):
            self.model_id = f"us.{model_id}"
        else:
            self.model_id = model_id
        self.client = client
        self.region_name = region_name
        logger.info(f"CohereBedrockEmbeddings initialized with model_id={self.model_id}")

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string (for search/matching)."""
        return self._embed([text], input_type="search_query")[0]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of document strings (for indexing)."""
        return self._embed(texts, input_type="search_document")

    def _embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        """Call Bedrock invoke_model with Cohere Embed v4 request format."""
        body = json.dumps({
            "texts": texts,
            "input_type": input_type,
            "embedding_types": ["float"],
        })

        response = self.client.invoke_model(
            modelId=self.model_id,
            body=body,
            accept="*/*",
            contentType="application/json",
        )

        result = json.loads(response["body"].read())
        embeddings = result.get("embeddings", {}).get("float", [])

        if not embeddings:
            logger.error(f"Cohere Embed v4 returned no embeddings. Response keys: {list(result.keys())}")
            raise ValueError("Cohere Embed v4 returned empty embeddings")

        return embeddings
