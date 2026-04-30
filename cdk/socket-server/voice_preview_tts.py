"""Pure TTS via Nova Sonic 2 — no database, no chat history, no agent logic.

Spawned by server.js as a child process for voice preview.
Reads a single JSON config from stdin, opens a Bedrock Nova Sonic
bidirectional stream, sends the text, and writes base64 audio chunks
to stdout as JSON lines. Exits when the model finishes speaking.

Input (one JSON line on stdin):
    {"voice_id": "amy", "text": "Hello, I have chest pain."}

Output (JSON lines on stdout):
    {"type": "ready"}
    {"type": "audio", "data": "<base64 PCM 24kHz 16-bit mono>"}
    {"type": "done"}
"""

import asyncio
import base64
import json
import os
import sys
import uuid
import logging

import boto3
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
from smithy_aws_core.credentials_resolvers.environment import EnvironmentCredentialsResolver

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger("voice_preview_tts")

MODEL_ID = "amazon.nova-2-sonic-v1:0"
REGION = "us-east-1"
OUTPUT_SAMPLE_RATE = 24000

SYSTEM_PROMPT = (
    "You are a voice preview assistant. "
    "Say exactly what the user tells you, in a natural conversational tone. "
    "Do not add anything extra. Do not greet. Just speak the text naturally."
)


def emit(obj: dict):
    """Write a JSON line to stdout for the Node.js parent process."""
    print(json.dumps(obj), flush=True)


def make_client() -> BedrockRuntimeClient:
    # ECS task role credentials come via the container metadata endpoint,
    # not env vars. Use boto3 to resolve them and inject into env so the
    # Bedrock SDK's EnvironmentCredentialsResolver can find them.
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

    config = Config(
        endpoint_uri=f"https://bedrock-runtime.{REGION}.amazonaws.com",
        region=REGION,
        aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
        http_auth_scheme_resolver=HTTPAuthSchemeResolver(),
        http_auth_schemes={"aws.auth#sigv4": SigV4AuthScheme()},
    )
    return BedrockRuntimeClient(config=config)


async def send_event(stream, event: dict):
    payload = json.dumps(event, separators=(",", ":"))
    chunk = InvokeModelWithBidirectionalStreamInputChunk(
        value=BidirectionalInputPayloadPart(bytes_=payload.encode("utf-8"))
    )
    await stream.input_stream.send(chunk)


async def run_tts(voice_id: str, text: str):
    client = make_client()
    stream = await client.invoke_model_with_bidirectional_stream(
        InvokeModelWithBidirectionalStreamOperationInput(model_id=MODEL_ID)
    )

    prompt_name = str(uuid.uuid4())

    # 1) sessionStart
    await send_event(stream, {
        "event": {
            "sessionStart": {
                "inferenceConfiguration": {
                    "maxTokens": 1024,
                    "topP": 1.0,
                    "temperature": 0.7,
                },
            }
        }
    })

    # 2) promptStart — configure audio output
    await send_event(stream, {
        "event": {
            "promptStart": {
                "promptName": prompt_name,
                "textOutputConfiguration": {"mediaType": "text/plain"},
                "audioOutputConfiguration": {
                    "mediaType": "audio/lpcm",
                    "sampleRateHertz": OUTPUT_SAMPLE_RATE,
                    "sampleSizeBits": 16,
                    "channelCount": 1,
                    "voiceId": voice_id,
                    "encoding": "base64",
                    "audioType": "SPEECH",
                },
            }
        }
    })

    # 3) System prompt
    sys_content = str(uuid.uuid4())
    await send_event(stream, {
        "event": {
            "contentStart": {
                "promptName": prompt_name,
                "contentName": sys_content,
                "type": "TEXT",
                "interactive": True,
                "role": "SYSTEM",
                "textInputConfiguration": {"mediaType": "text/plain"},
            }
        }
    })
    await send_event(stream, {
        "event": {
            "textInput": {
                "promptName": prompt_name,
                "contentName": sys_content,
                "content": SYSTEM_PROMPT,
            }
        }
    })
    await send_event(stream, {
        "event": {
            "contentEnd": {
                "promptName": prompt_name,
                "contentName": sys_content,
            }
        }
    })

    # 4) User text input — the text to speak
    user_content = str(uuid.uuid4())
    await send_event(stream, {
        "event": {
            "contentStart": {
                "promptName": prompt_name,
                "contentName": user_content,
                "type": "TEXT",
                "interactive": True,
                "role": "USER",
                "textInputConfiguration": {"mediaType": "text/plain"},
            }
        }
    })
    await send_event(stream, {
        "event": {
            "textInput": {
                "promptName": prompt_name,
                "contentName": user_content,
                "content": text,
            }
        }
    })
    await send_event(stream, {
        "event": {
            "contentEnd": {
                "promptName": prompt_name,
                "contentName": user_content,
            }
        }
    })

    emit({"type": "ready"})

    # 5) Read audio from the response stream
    decoder = json.JSONDecoder()
    buffer = ""
    audio_count = 0

    try:
        while True:
            output = await stream.await_output()
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

                evt = obj.get("event", {})
                if "audioOutput" in evt:
                    emit({"type": "audio", "data": evt["audioOutput"]["content"]})
                    audio_count += 1

            buffer = buffer[idx:]

    except Exception as e:
        logger.info("Stream ended: %s", e)

    # Clean up
    try:
        await send_event(stream, {"event": {"promptEnd": {"promptName": prompt_name}}})
        await send_event(stream, {"event": {"sessionEnd": {}}})
        await stream.input_stream.close()
    except Exception:
        pass

    emit({"type": "done"})
    logger.info("TTS complete — emitted %d audio chunks", audio_count)


async def main():
    # Read config from stdin (single JSON line)
    line = sys.stdin.readline().strip()
    if not line:
        emit({"type": "error", "error": "No input received"})
        return

    try:
        config = json.loads(line)
    except json.JSONDecodeError as e:
        emit({"type": "error", "error": f"Invalid JSON: {e}"})
        return

    voice_id = config.get("voice_id", "amy")
    text = config.get("text", "")

    if not text:
        emit({"type": "error", "error": "No text provided"})
        return

    await run_tts(voice_id, text)


if __name__ == "__main__":
    asyncio.run(main())
