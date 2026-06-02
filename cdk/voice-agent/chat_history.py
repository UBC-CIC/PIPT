"""Chat history persistence — DynamoDB + PostgreSQL.

Ported from cdk/socket-server/langchain_chat_history.py for the
agentcore voice agent container.
"""

import json
import os
import uuid
import logging
from datetime import datetime

import boto3
import psycopg2
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

connection = None
db_secret = None

secrets_manager_client = boto3.client("secretsmanager")

RDS_PROXY_ENDPOINT = os.environ.get("RDS_PROXY_ENDPOINT")
DB_SECRET_NAME = os.environ.get("SM_DB_CREDENTIALS")
_TABLE_NAME = os.environ.get("TABLE_NAME")


def format_chat_history(
    session_id: str, table_name: str = None
) -> str:
    table_name = table_name or _TABLE_NAME
    if not table_name:
        raise RuntimeError("TABLE_NAME environment variable is not set")
    history = DynamoDBChatMessageHistory(table_name=table_name, session_id=session_id)
    recent_messages = history.messages[-10:]

    lines = []
    for m in recent_messages:
        role = "User" if m.type == "human" else "Assistant"
        content = m.content.strip().replace("\n", " ")
        safe_content = json.dumps(content)[1:-1]
        lines.append(f"{role}: {safe_content}")
    return "\n".join(lines)


def add_message(
    session_id: str, role: str, content: str, table_name: str = None
):
    table_name = table_name or _TABLE_NAME
    if not table_name:
        raise RuntimeError("TABLE_NAME environment variable is not set")
    history = DynamoDBChatMessageHistory(table_name=table_name, session_id=session_id)
    if role == "user":
        history.add_message(HumanMessage(content=content))
    elif role == "ai":
        history.add_message(AIMessage(content=content))
    else:
        raise ValueError(f"Invalid role '{role}'. Must be 'user' or 'ai'.")


def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        response = secrets_manager_client.get_secret_value(SecretId=secret_name)["SecretString"]
        db_secret = json.loads(response) if expect_json else response
    return db_secret


def connect_to_db():
    global connection
    if connection is None or connection.closed:
        secret = get_secret(DB_SECRET_NAME)
        connection_params = {
            "dbname": secret["dbname"],
            "user": secret["username"],
            "password": secret["password"],
            "host": RDS_PROXY_ENDPOINT,
            "port": secret["port"],
            "sslmode": "require",
        }
        connection_string = " ".join(f"{k}={v}" for k, v in connection_params.items())
        connection = psycopg2.connect(connection_string)
        logger.info("Connected to the database")
    return connection


def insert_message_to_postgres(session_id: str, role: str, content: str):
    try:
        conn = connect_to_db()
        cursor = conn.cursor()
        sender = "student" if role == "user" else "ai"
        cursor.execute(
            """INSERT INTO messages (message_id, chat_id, sender_type, message_content, sent_at)
               VALUES (%s, %s, %s, %s, %s)""",
            (str(uuid.uuid4()), session_id, sender, content, datetime.utcnow()),
        )
        conn.commit()
        cursor.close()
        logger.info("Saved message to PostgreSQL (session=%s, role=%s)", session_id, role)
    except Exception as e:
        logger.error("Failed to insert message: %s", e)
        conn.rollback()
