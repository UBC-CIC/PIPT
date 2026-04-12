"""Nova Sonic 2.0 bidirectional streaming session (AgentCore WebSocket transport).

Manages the full lifecycle of a Nova Sonic conversation:
1. Connect to Bedrock and open a bidirectional stream
2. Configure the session (model params, voice, system prompt)
3. Stream audio in/out over an AgentCore WebSocket connection
4. Persist messages to DynamoDB + PostgreSQL
"""

import os
import asyncio
import base64
import json
import uuid
import random
import logging
import re
import boto3
import psycopg2
from psycopg2 import pool
from threading import Lock
from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector

from aws_sdk_bedrock_runtime.client import (
    BedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamOperationInput,
)
from aws_sdk_bedrock_runtime.models import (
    InvokeModelWithBidirectionalStreamInputChunk,
    BidirectionalInputPayloadPart,
)
from aws_sdk_bedrock_runtime.config import (
    Config,
    HTTPAuthSchemeResolver,
    SigV4AuthScheme,
)
from smithy_aws_core.identity import (
    EnvironmentCredentialsResolver,
)

import chat_history
_INTERRUPTED_RE = re.compile(r'\{\s*"interrupted"\s*:\s*true\s*\}', re.IGNORECASE)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Audio constants
# ---------------------------------------------------------------------------
INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHANNELS = 1

# ---------------------------------------------------------------------------
# Model — Nova Sonic 2.0
# ---------------------------------------------------------------------------
MODEL_ID = "amazon.nova-2-sonic-v1:0"

# ---------------------------------------------------------------------------
# Database connection pool
# ---------------------------------------------------------------------------
pg_conn_pool = None
pool_lock = Lock()


def get_pg_connection():
    """Get a connection from the pool, initialising the pool on first call."""
    global pg_conn_pool
    with pool_lock:
        if pg_conn_pool is None:
            secrets_client = boto3.client("secretsmanager")
            db_secret_name = os.environ.get("SM_DB_CREDENTIALS")
            rds_endpoint = os.environ.get("RDS_PROXY_ENDPOINT")

            if not db_secret_name or not rds_endpoint:
                logger.warning("Database credentials not available")
                raise Exception("Database credentials not configured")

            secret_response = secrets_client.get_secret_value(SecretId=db_secret_name)
            secret = json.loads(secret_response["SecretString"])

            pg_conn_pool = pool.SimpleConnectionPool(
                1,
                5,
                host=rds_endpoint,
                port=secret["port"],
                database=secret["dbname"],
                user=secret["username"],
                password=secret["password"],
            )

        return pg_conn_pool.getconn()


# ═══════════════════════════════════════════════════════════════════════════
# NovaSonic — bidirectional streaming client
# ═══════════════════════════════════════════════════════════════════════════


class NovaSonic:
    """Manages a single Nova Sonic 2.0 bidirectional streaming session.

    The `websocket` parameter is the AgentCore WebSocket connection.
    All output (audio, text, events) is sent back over this WebSocket
    instead of stdout.
    """

    def __init__(self, websocket, voice_id=None, session_id=None, region=None,
                 patient_name="", patient_prompt="", patient_id="",
                 simulation_group_id="", llm_completion=False, extra_system_prompt="",
                 user_id=None, cognito_token="", text_generation_endpoint=""):
        self.ws = websocket
        self.user_id = user_id or os.getenv("USER_ID")
        self.model_id = MODEL_ID
        self.region = "us-east-1"  # Nova Sonic endpoint region
        self.deployment_region = region or os.getenv("AWS_REGION", "us-east-1")

        self.client = None
        self.stream = None
        self.response = None
        self.is_active = False

        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.audio_queue = asyncio.Queue()
        self.role = None
        self.display_assistant_text = False

        self.voice_id = voice_id
        self.session_id = session_id or "default"
        self.patient_name = patient_name
        self.patient_prompt = patient_prompt
        self.llm_completion = llm_completion
        self.extra_system_prompt = extra_system_prompt
        self.patient_id = patient_id
        self.simulation_group_id = simulation_group_id

        # Matching endpoint config
        self.cognito_token = cognito_token or os.getenv("COGNITO_TOKEN", "")
        self.text_generation_endpoint = text_generation_endpoint or os.getenv("TEXT_GENERATION_ENDPOINT", "")

        # Caches
        self._cached_system_prompt = None
        self._bedrock_client = None
        self._chat_context = None
        self._current_user_input = ""

        # AI message buffering — accumulate fragments, persist once per turn
        self._buffered_ai_message = ""
        self._last_persisted_ai_message = ""

        # Track user audio state to correctly attribute transcribed text
        self._user_audio_active = False
        self._last_emitted_text = None
        self._emitted_texts_this_turn = set()

    # ------------------------------------------------------------------
    # WebSocket output helper
    # ------------------------------------------------------------------

    async def _emit(self, obj: dict):
        """Send a JSON message back to the client over the WebSocket."""
        try:
            await self.ws.send_json(obj)
        except Exception as e:
            logger.error("WebSocket send failed: %s", e)

    # ------------------------------------------------------------------
    # Bedrock client
    # ------------------------------------------------------------------

    def _init_client(self):
        # Fetch credentials via boto3 and inject into env before
        # EnvironmentCredentialsResolver initializes
        session = boto3.Session()
        creds = session.get_credentials()
        if creds:
            frozen = creds.get_frozen_credentials()
            if frozen.access_key:
                os.environ["AWS_ACCESS_KEY_ID"] = frozen.access_key
            if frozen.secret_key:
                os.environ["AWS_SECRET_ACCESS_KEY"] = frozen.secret_key
            if frozen.token:
                os.environ["AWS_SESSION_TOKEN"] = frozen.token
            logger.info("Injected boto3 credentials into environment")
        else:
            logger.error("No AWS credentials found via boto3")

        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
            auth_scheme_resolver=HTTPAuthSchemeResolver(),
            auth_schemes={"aws.auth#sigv4": SigV4AuthScheme(service="bedrock")},
        )
        self.client = BedrockRuntimeClient(config=config)
        logger.info("Initialized Bedrock client for %s in %s", self.model_id, self.region)

    def _get_bedrock_client(self):
        if not self._bedrock_client:
            self._bedrock_client = boto3.client("bedrock-runtime", region_name="us-east-1")
        return self._bedrock_client

    def _get_medical_context(self):
        """Fetch the ENTIRE patient case file from pgvector."""
        if not self.patient_id:
            return ""
        try:
            # We use the existing connection pool instead of making a new one
            conn = get_pg_connection()
            cursor = conn.cursor()
            
            # Fetch ALL document chunks for this patient directly from the vector store tables
            # bypassing the need for a similarity search completely.
            cursor.execute("""
                SELECT document 
                FROM langchain_pg_embedding e
                JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                WHERE c.name = %s
            """, (self.patient_id,))
            
            rows = cursor.fetchall()
            cursor.close()
            pg_conn_pool.putconn(conn)
            
            if rows:
                # Combine all the document chunks into one massive string
                context = "\n---\n".join([r[0] for r in rows])
                logger.info("Loaded complete case file (%d chunks) into Voice Agent memory for patient %s", len(rows), self.patient_id)
                return context
                
        except Exception as e:
            logger.error("[VOICE AGENT] Failed to retrieve complete medical context: %s", e)
            
        return ""

    # ------------------------------------------------------------------
    # Event helpers
    # ------------------------------------------------------------------

    async def send_event(self, event: dict):
        payload = json.dumps(event, separators=(",", ":"))
        chunk = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=payload.encode("utf-8"))
        )
        await self.stream.input_stream.send(chunk)

    # ------------------------------------------------------------------
    # System prompt
    # ------------------------------------------------------------------

    @staticmethod
    def get_default_system_prompt(patient_name) -> str:
        return f"""
        You are {patient_name or 'a patient'} and you are talking to a pharmacy student who is trying to help you.

        CRITICAL ROLE INSTRUCTIONS:
        - You are ONLY the patient - never switch roles or repeat what the student says
        - When the student speaks to you, respond as the patient would respond
        - Do NOT echo or repeat the student's words back to them
        - Do NOT act as the pharmacy student or provide medical advice
        - Stay in character as the patient at all times

        RESPONSE GUIDELINES:
        - Keep responses brief (1-2 sentences maximum)
        - Be realistic about your symptoms and concerns
        - Don't volunteer too much information at once
        - Ask questions a real patient would ask
        - Focus on how you're feeling physically
        - If the student shows empathy, respond naturally as a patient would

        WHAT TO AVOID:
        - Never repeat what the student just said
        - Don't switch to being the pharmacy student
        - Don't provide medical explanations
        - Don't break character

        Start by saying only "Hello." Then describe your symptoms when asked.
        """

    def _sanitize_prompt_for_voice(self, prompt: str) -> str:
        """
        Make DB/system prompts safe for streaming voice.

        Main goals:
        - Prevent 'greet every response' bugs (Hello/Hi repeating).
        - Keep the same patient-role constraints.
        - Avoid instructions that only make sense in text-mode / single-shot prompts.
        """
        if not prompt:
            return prompt

        p = prompt

        # 1) Remove/soften greeting-on-every-turn instructions
        # Handles variations you might have in DB prompt content.
        p = re.sub(
            r'Start by saying only\s*"Hello\."\s*Then describe your symptoms when asked\.?',
            'Greet the student once at the beginning of the session. Do NOT repeat greetings every response.',
            p,
            flags=re.IGNORECASE,
        )

        p = re.sub(
            r'Start the conversation by greeting the pharmacy student.*?(?=\n|$)',
            'At the start of the session, greet the pharmacy student once. Do NOT repeat greetings every response.',
            p,
            flags=re.IGNORECASE,
        )

        # 2) Add an explicit anti-repetition rule (voice streaming tends to over-follow early instructions)
        p += (
            "\n\nVOICE MODE OVERRIDE (IMPORTANT):\n"
            "- You may greet at the very beginning of the session ONCE.\n"
            "- Do NOT start every reply with 'Hello'/'Hi' or any greeting.\n"
            "- After the first greeting, answer directly in-role as the patient.\n"
        )

        return p

    def get_system_prompt(self, patient_name=None, patient_prompt=None, llm_completion=None):
        if self._cached_system_prompt:
            return self._cached_system_prompt

        try:
            conn = get_pg_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT prompt_content FROM system_prompt_history ORDER BY created_at DESC LIMIT 1"
            )
            result = cursor.fetchone()
            cursor.close()
            pg_conn_pool.putconn(conn)

            if result and result[0]:
                self._cached_system_prompt = result[0]
                return self._cached_system_prompt
        except Exception as e:
            logger.error("Error retrieving system prompt: %s", e)

        raw_default = self.get_default_system_prompt(patient_name or self.patient_name)
        self._cached_system_prompt = self._sanitize_prompt_for_voice(raw_default)
        return self._cached_system_prompt

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    async def start_session(self):
        if not self.client:
            self._init_client()

        self.stream = await self.client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(model_id=self.model_id)
        )
        logger.info("Bidirectional stream opened")
        self.is_active = True

        # 1) sessionStart
        await self.send_event(
            {
                "event": {
                    "sessionStart": {
                        "inferenceConfiguration": {
                            "maxTokens": 2048,
                            "topP": 1.0,
                            "temperature": 0.8,
                            "stopSequences": [],
                        }
                    }
                }
            }
        )

        # Voice selection
        voice_ids = {
            "feminine": ["amy", "tiffany", "lupe"],
            "masculine": ["matthew", "carlos"],
        }
        selected_voice = self.voice_id or random.choice(voice_ids["feminine"])

        # 2) promptStart
        await self.send_event(
            {
                "event": {
                    "promptStart": {
                        "promptName": self.prompt_name,
                        "textOutputConfiguration": {"mediaType": "text/plain"},
                        "audioOutputConfiguration": {
                            "mediaType": "audio/lpcm",
                            "sampleRateHertz": OUTPUT_SAMPLE_RATE,
                            "sampleSizeBits": 16,
                            "channelCount": 1,
                            "voiceId": selected_voice,
                            "encoding": "base64",
                            "audioType": "SPEECH",
                        },
                    }
                }
            }
        )

        # 3) SYSTEM contentStart
        await self.send_event(
            {
                "event": {
                    "contentStart": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                        "type": "TEXT",
                        "interactive": True,
                        "role": "SYSTEM",
                        "interrupt": True,
                        "textInputConfiguration": {"mediaType": "text/plain"},
                    }
                }
            }
        )

        # Build system prompt with chat context
        if not self._chat_context:
            self._chat_context = chat_history.format_chat_history(self.session_id)

        prompt_parts = [self.get_system_prompt()]
        if self.patient_prompt:
            prompt_parts.append(f"\nPatient context:\n{self.patient_prompt}")
        if self.extra_system_prompt:
            prompt_parts.append(f"\n{self.extra_system_prompt}")

        # Fetch medical documents from vector store
        medical_context = self._get_medical_context()
        if medical_context:
            prompt_parts.append(f"\nMEDICAL CONTEXT:\n{medical_context}")

        if self._chat_context:
            prompt_parts.append(f"\nPrevious conversation:\n{self._chat_context}")

        system_prompt = "\n".join(prompt_parts)

        # 4) textInput
        await self.send_event(
            {
                "event": {
                    "textInput": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                        "content": system_prompt,
                    }
                }
            }
        )

        # 5) contentEnd
        await self.send_event(
            {
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                    }
                }
            }
        )

        # Start response processing
        self.response = asyncio.create_task(self._process_responses())

        logger.info("Nova Sonic session started (prompt=%s)", self.prompt_name)
        await self._emit({"type": "text", "text": "Nova Sonic ready"})

    # ------------------------------------------------------------------
    # Audio input
    # ------------------------------------------------------------------

    async def start_audio_input(self):
        self.audio_content_name = str(uuid.uuid4())
        self._current_user_input = ""
        self._user_audio_active = True

        # SEND TURN-START SIGNAL IMMEDIATELY for USER role
        await self._emit({"type": "turn-start", "role": "user"})

        await self.send_event(
            {
                "event": {
                    "contentStart": {
                        "promptName": self.prompt_name,
                        "contentName": self.audio_content_name,
                        "type": "AUDIO",
                        "interactive": True,
                        "role": "USER",
                        "audioInputConfiguration": {
                            "mediaType": "audio/lpcm",
                            "sampleRateHertz": INPUT_SAMPLE_RATE,
                            "sampleSizeBits": 16,
                            "channelCount": CHANNELS,
                            "audioType": "SPEECH",
                            "encoding": "base64",
                        },
                    }
                }
            }
        )

    async def send_audio_chunk(self, audio_bytes):
        blob = base64.b64encode(audio_bytes).decode("utf-8")
        await self.send_event(
            {
                "event": {
                    "audioInput": {
                        "promptName": self.prompt_name,
                        "contentName": self.audio_content_name,
                        "content": blob,
                    }
                }
            }
        )

    async def send_text_input(self, text: str):
        self.content_name = str(uuid.uuid4())
        self._current_user_input = text
        # Start text block
        await self.send_event(
            {
                "event": {
                    "contentStart": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                        "type": "TEXT",
                        "interactive": True,
                        "role": "USER",
                        "textInputConfiguration": {
                            "mediaType": "text/plain",
                        },
                    }
                }
            }
        )
        # Send the text
        await self.send_event(
            {
                "event": {
                    "textInput": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                        "content": text,
                    }
                }
            }
        )
        # End text block
        await self.send_event(
            {
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_name,
                        "contentName": self.content_name,
                    }
                }
            }
        )

    async def end_audio_input(self):
        self._buffered_ai_message = ""

        await self.send_event(
            {
                "event": {
                    "contentEnd": {
                        "promptName": self.prompt_name,
                        "contentName": self.audio_content_name,
                    }
                }
            }
        )

    async def end_session(self):
        # Flush any remaining buffered AI message before closing
        if self._buffered_ai_message and self._buffered_ai_message != self._last_persisted_ai_message:
            try:
                chat_history.add_message(self.session_id, "ai", self._buffered_ai_message)
                self._save_message_to_db(self.session_id, False, self._buffered_ai_message, None)
                self._last_persisted_ai_message = self._buffered_ai_message
                logger.info("💬 [PERSIST] AI (final) | %s | %s", self.session_id, self._buffered_ai_message[:30])
            except Exception as e:
                logger.error("Failed to persist final AI message: %s", e)
            self._buffered_ai_message = ""

        # Flush any remaining buffered user message
        if self._current_user_input and self._current_user_input.strip():
            try:
                await self._save_user_message_async(self._current_user_input)
            except Exception as e:
                logger.error("Failed to persist final user message: %s", e)
            self._current_user_input = ""

        self.is_active = False
        try:
            await self.send_event({"event": {"promptEnd": {"promptName": self.prompt_name}}})
            await self.send_event({"event": {"sessionEnd": {}}})
            await self.stream.input_stream.close()
        except Exception as e:
            logger.error("Error ending session: %s", e)

    # ------------------------------------------------------------------
    # Response processing
    # ------------------------------------------------------------------

    async def _process_responses(self):
        decoder = json.JSONDecoder()
        buffer = ""

        try:
            while self.is_active:
                output = await self.stream.await_output()
                result = await output[1].receive()

                if not (result.value and result.value.bytes_):
                    continue

                chunk = result.value.bytes_.decode("utf-8")
                buffer += chunk

                idx = 0
                while True:
                    try:
                        obj, offset = decoder.raw_decode(buffer[idx:])
                    except json.JSONDecodeError:
                        break
                    idx += offset
                    await self._handle_event(obj)

                buffer = buffer[idx:]

        except Exception as e:
            logger.error("Error in _process_responses: %s", e)

    async def _handle_event(self, json_data):
        evt = json_data.get("event", {})

        # ── contentStart ──────────────────────────────────────────────
        if "contentStart" in evt:
            cs = evt["contentStart"]
            prev_role = self.role
            new_role = cs.get("role")

            # Flush buffered AI message when the AI turn ends
            if prev_role == "ASSISTANT" and new_role != "ASSISTANT":
                if self._buffered_ai_message and self._buffered_ai_message != self._last_persisted_ai_message:
                    try:
                        chat_history.add_message(self.session_id, "ai", self._buffered_ai_message)
                        self._save_message_to_db(self.session_id, False, self._buffered_ai_message, None)
                        self._last_persisted_ai_message = self._buffered_ai_message
                        logger.info("💬 [PERSIST] AI | %s | %s", self.session_id, self._buffered_ai_message[:30])
                    except Exception as e:
                        logger.error("Failed to persist buffered AI message: %s", e)
                self._buffered_ai_message = ""

            # Flush buffered user message when the user turn ends
            if prev_role == "USER" and new_role != "USER":
                if self._current_user_input and self._current_user_input.strip():
                    asyncio.create_task(self._save_user_message_async(self._current_user_input))
                    self._current_user_input = ""

            # When AI starts talking, user audio phase is over
            if new_role and new_role.upper() == "ASSISTANT":
                self._user_audio_active = False

            self.role = new_role
            if new_role != prev_role:
                self._emitted_texts_this_turn = set()
            if "additionalModelFields" in cs:
                fields = json.loads(cs["additionalModelFields"])
                self.display_assistant_text = fields.get("generationStage") == "SPECULATIVE"
            # Signal a new turn to the frontend so it creates a new chat bubble
            # USER turn-start is now sent earlier in start_audio_input()
            if self.role and self.role.upper() != "USER":
                await self._emit({"type": "turn-start", "role": self.role.lower()})

        # ── textOutput ────────────────────────────────────────────────
        elif "textOutput" in evt:
            text = evt["textOutput"]["content"]

            # Filter interrupted marker
            text = _INTERRUPTED_RE.sub("", text)

            # If the chunk is now empty, drop it
            if not text.strip():
                return

            # Deduplicate — skip any text already emitted this turn
            if text in self._emitted_texts_this_turn:
                return
            self._emitted_texts_this_turn.add(text)

            # Determine effective role — if user audio is active, any
            # transcribed text belongs to the user even if self.role
            # hasn't switched yet (Nova Sonic timing issue)
            effective_role = self.role
            if self._user_audio_active and effective_role == "ASSISTANT":
                effective_role = "USER"

            # Diagnosis completion check
            diagnosis_achieved = "SESSION COMPLETED" in text
            if diagnosis_achieved and self.llm_completion:
                text = text.replace("SESSION COMPLETED", "").strip()
                text += " I really appreciate your feedback. You may continue practicing with other patients. Goodbye."

            if effective_role == "ASSISTANT":
                self._buffered_ai_message += text
                await self._emit({"type": "text", "text": text, "role": "assistant"})
                if diagnosis_achieved and self.llm_completion:
                    await self._emit({"type": "diagnosis_complete", "text": "Session completed successfully"})

            elif effective_role == "USER":
                await self._emit({"type": "user-text", "text": text})
                self._current_user_input += text

        # ── audioOutput ───────────────────────────────────────────────
        elif "audioOutput" in evt:
            b64 = evt["audioOutput"]["content"]
            await self._emit({"type": "audio", "data": b64})

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def _save_user_message_async(self, user_text):
        try:
            loop = asyncio.get_event_loop()
            message_id = await loop.run_in_executor(
                None, self._save_message_to_db, self.session_id, True, user_text, None
            )
            await loop.run_in_executor(
                None, chat_history.add_message, self.session_id, "user", user_text
            )
            logger.info("User audio message saved: %s…", user_text[:30])

            # Trigger semantic matching via text generation endpoint
            if message_id and user_text.strip():
                await loop.run_in_executor(
                    None, self._call_matching_endpoint, message_id, user_text
                )
        except Exception as e:
            logger.error("Failed to save user audio message: %s", e)

    def _call_matching_endpoint(self, message_id, message_content):
        """Call the text generation service's /match endpoint for semantic question matching."""
        import urllib.request
        endpoint = self.text_generation_endpoint
        token = self.cognito_token
        if not endpoint:
            logger.warning("TEXT_GENERATION_ENDPOINT not set, skipping semantic matching")
            return
        try:
            url = (
                f"{endpoint}/student/text_generation"
                f"?simulation_group_id={self.simulation_group_id}"
                f"&session_id={self.session_id}"
                f"&patient_id={self.patient_id}"
                f"&mode=match"
            )
            data = json.dumps({"message_id": message_id, "message_content": message_content}).encode()
            req = urllib.request.Request(url, data=data, method="POST", headers={
                "Content-Type": "application/json",
                "Authorization": token,
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                logger.info("Matching endpoint responded: %s", resp.status)
        except Exception as e:
            logger.error("Failed to call matching endpoint: %s", e)

    def _save_message_to_db(self, session_id, student_sent, message_content, empathy_evaluation=None):
        try:
            conn = get_pg_connection()
            cursor = conn.cursor()
            sender = "student" if student_sent else "ai"
            msg_id = str(uuid.uuid4())
            cursor.execute(
                'INSERT INTO "messages" (message_id, chat_id, sender_type, message_content, sent_at) VALUES (%s, %s, %s, %s, NOW())',
                (msg_id, session_id, sender, message_content),
            )
            conn.commit()
            cursor.close()
            pg_conn_pool.putconn(conn)
            logger.info("Message saved to DB")
            return msg_id
        except Exception as e:
            logger.error("Error saving message: %s", e)
            try:
                pg_conn_pool.putconn(conn, close=True)
            except Exception:
                pass
            return None

    # ------------------------------------------------------------------
    # WebSocket message handler (replaces stdin handler)
    # ------------------------------------------------------------------

    async def handle_websocket(self):
        """Main loop: read JSON messages from the WebSocket, dispatch to Nova Sonic."""
        audio_started = False

        try:
            while True:
                msg = await self.ws.receive_json()
                msg_type = msg.get("type")

                if msg_type == "audio":
                    audio_bytes = base64.b64decode(msg["data"])
                    await self.send_audio_chunk(audio_bytes)

                elif msg_type == "start_audio":
                    await self.start_audio_input()
                    audio_started = True
                    logger.info("Started audio input")

                elif msg_type == "end_audio":
                    await self.end_audio_input()
                    audio_started = False

                elif msg_type == "text":
                    user_text = msg.get("text", "")
                    if user_text:
                        logger.info("Received text input from client")
                        await self.send_text_input(user_text)
                        asyncio.create_task(self._save_user_message_async(user_text))
                        self._current_user_input = ""

                elif msg_type == "interrupt":
                    self.is_active = False
                    if self.stream:
                        try:
                            await self.stream.input_stream.close()
                        except Exception:
                            pass

                elif msg_type == "set_voice":
                    voice_id = msg.get("voice_id")
                    logger.info("Voice change request: %s", voice_id)
                    self.voice_id = voice_id
                    if self.is_active:
                        await self.end_session()
                        await self.start_session()

                elif msg_type == "end_session":
                    logger.info("Client requested session end")
                    break

        except Exception as e:
            # WebSocket disconnect or other error
            logger.info("WebSocket handler ended: %s", e)
        finally:
            await self.end_session()
