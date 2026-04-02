"""Nova Sonic bidirectional streaming session.

Manages the full lifecycle of a Nova Sonic conversation:
1. Connect to Bedrock and open a bidirectional stream
2. Configure the session (model params, voice, system prompt)
3. Stream microphone audio in, receive spoken responses out
"""

import asyncio
import base64
import json
import logging
import os
import uuid

# Set up basic logging (matches existing GenRx pattern)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

from aws_sdk_bedrock_runtime.client import BedrockRuntimeClient
from aws_sdk_bedrock_runtime.config import Config
from aws_sdk_bedrock_runtime.models import (
    BidirectionalInputPayloadPart,
    InvokeModelWithBidirectionalStreamInputChunk,
    InvokeModelWithBidirectionalStreamOperationInput,
)
from smithy_aws_core.auth.sigv4 import SigV4AuthScheme
from smithy_aws_core.identity.chain import create_default_chain
from smithy_http.aio.aiohttp import AIOHTTPClient
import boto3

from audio import convert_to_16khz, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE

MODEL_ID = "amazon.nova-2-sonic-v1:0"
VOICE_ID = "matthew"
SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Keep responses brief and conversational. "
    "Start the conversation by greeting the user and asking how you can help them today."
)

# Shared audio format used in both input and output config
_AUDIO_FORMAT = {
    "mediaType": "audio/lpcm",
    "sampleSizeBits": 16,
    "channelCount": 1,
    "encoding": "base64",
    "audioType": "SPEECH",
}


async def _send(stream, event_dict):
    """Send a single event to the Nova Sonic stream."""
    await stream.input_stream.send(
        InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(
                bytes_=json.dumps(event_dict).encode("utf-8")
            )
        )
    )


async def _setup_session(stream, prompt_name):
    """Configure the Nova Sonic session: model params, system prompt, audio format."""

    # 1. Start session with inference parameters
    await _send(
        stream,
        {
            "event": {
                "sessionStart": {
                    "inferenceConfiguration": {
                        "maxTokens": 1024,
                        "topP": 0.9,
                        "temperature": 0.7,
                    }
                }
            }
        },
    )

    # 2. Configure audio output (Nova Sonic -> browser)
    await _send(
        stream,
        {
            "event": {
                "promptStart": {
                    "promptName": prompt_name,
                    "audioOutputConfiguration": {
                        **_AUDIO_FORMAT,
                        "sampleRateHertz": OUTPUT_SAMPLE_RATE,
                        "voiceId": VOICE_ID,
                    },
                }
            }
        },
    )

    # 3. Send system prompt
    system_content = str(uuid.uuid4())
    await _send(
        stream,
        {
            "event": {
                "contentStart": {
                    "promptName": prompt_name,
                    "contentName": system_content,
                    "type": "TEXT",
                    "interactive": True,
                    "role": "SYSTEM",
                    "textInputConfiguration": {"mediaType": "text/plain"},
                }
            }
        },
    )
    await _send(
        stream,
        {
            "event": {
                "textInput": {
                    "promptName": prompt_name,
                    "contentName": system_content,
                    "content": SYSTEM_PROMPT,
                }
            }
        },
    )
    await _send(
        stream,
        {
            "event": {
                "contentEnd": {
                    "promptName": prompt_name,
                    "contentName": system_content,
                }
            }
        },
    )


async def _start_audio_input(stream, prompt_name, audio_content_name):
    """Tell Nova Sonic to expect audio input in our format."""
    await _send(
        stream,
        {
            "event": {
                "contentStart": {
                    "promptName": prompt_name,
                    "contentName": audio_content_name,
                    "type": "AUDIO",
                    "interactive": True,
                    "role": "USER",
                    "audioInputConfiguration": {
                        **_AUDIO_FORMAT,
                        "sampleRateHertz": INPUT_SAMPLE_RATE,
                    },
                }
            }
        },
    )


async def run_session(audio_in, audio_out, region, pc_id):
    """Run a full Nova Sonic conversation session.

    Args:
        audio_in:  WebRTC MediaStreamTrack (microphone from browser)
        audio_out: OutputTrack (plays Nova Sonic responses to browser)
        region:    AWS region for Bedrock
        pc_id:     Peer connection ID for logging
    """
    logger.info(f"Starting Nova Sonic session for {pc_id}")

    # --- Create clients explicitly so we can close them later ---
    http_client = AIOHTTPClient()
    client = None
    stream = None

    try:
        # --- Connect to Bedrock ---
        logger.info(f"Connecting to Bedrock in {region}...")

        # Fetch credentials via boto3 (reads ECS task role from container metadata)
        # and inject into env vars so create_default_chain can find them.
        session = boto3.Session(region_name=region)
        creds = session.get_credentials().get_frozen_credentials()
        os.environ["AWS_ACCESS_KEY_ID"] = creds.access_key
        os.environ["AWS_SECRET_ACCESS_KEY"] = creds.secret_key
        if creds.token:
            os.environ["AWS_SESSION_TOKEN"] = creds.token

        client = BedrockRuntimeClient(
            Config(
                endpoint_uri=f"https://bedrock-runtime.{region}.amazonaws.com",
                region=region,
                aws_credentials_identity_resolver=create_default_chain(http_client),
                auth_schemes={"aws.auth#sigv4": SigV4AuthScheme(service="bedrock")},
            )
        )
        logger.info("Bedrock client created, opening bidirectional stream...")
        stream = await client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(model_id=MODEL_ID)
        )
        logger.info("Bidirectional stream opened successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Bedrock: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        try:
            await http_client.close()
        except Exception:
            pass
        return

    # --- Configure session ---
    try:
        prompt_name = str(uuid.uuid4())
        audio_content_name = str(uuid.uuid4())
        await _setup_session(stream, prompt_name)
        await _start_audio_input(stream, prompt_name, audio_content_name)
        logger.info("Nova Sonic session configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure Nova Sonic session: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        try:
            await http_client.close()
        except Exception:
            pass
        return

    # --- Receive responses (runs concurrently with audio sending) ---
    ready = asyncio.Event()
    content_roles = {}  # contentId -> role

    async def receive_responses():
        try:
            logger.info("Receive loop started, waiting for Nova Sonic events...")
            while True:
                output = await stream.await_output()
                result = await output[1].receive()
                if not (result.value and result.value.bytes_):
                    continue

                raw = result.value.bytes_.decode("utf-8")
                event = json.loads(raw).get("event", {})
                logger.info(f"Received event: {list(event.keys())}")

                if not ready.is_set():
                    ready.set()

                if "contentStart" in event:
                    cs = event["contentStart"]
                    if cid := cs.get("contentId"):
                        content_roles[cid] = cs.get("role", "ASSISTANT")
                elif "audioOutput" in event:
                    audio_out.add_audio(
                        base64.b64decode(event["audioOutput"]["content"])
                    )
                elif "textOutput" in event:
                    to = event["textOutput"]
                    content = to["content"]
                    role = content_roles.get(to.get("contentId"), "ASSISTANT")
                    if "interrupted" in content and "true" in content:
                        logger.info("Barge-in detected, clearing audio queue")
                        audio_out.clear()
                    else:
                        label = "User" if role == "USER" else "Nova Sonic"
                        logger.info(f"{label}: {content}")
                elif "contentEnd" in event:
                    ce = event["contentEnd"]
                    if ce.get("stopReason") == "INTERRUPTED":
                        audio_out.clear()
                    content_roles.pop(ce.get("contentId"), None)
        except Exception as e:
            logger.error(f"Receive error: {e}")

    recv_task = asyncio.create_task(receive_responses())

    await asyncio.sleep(0.5)
    if not ready.is_set():
        ready.set()
    await ready.wait()
    logger.info("Session ready, streaming audio")

    # --- Stream microphone audio to Nova Sonic ---
    try:
        frame_count = 0
        while True:
            pcm = convert_to_16khz(await audio_in.recv())
            if not pcm:
                continue

            frame_count += 1
            if frame_count % 500 == 0:
                logger.info(f"Sent {frame_count} audio frames")

            await _send(
                stream,
                {
                    "event": {
                        "audioInput": {
                            "promptName": prompt_name,
                            "contentName": audio_content_name,
                            "content": base64.b64encode(pcm).decode("utf-8"),
                        }
                    }
                },
            )
    except Exception as e:
        logger.error(f"Audio send error: {e}")
    finally:
        recv_task.cancel()
        # --- Gracefully close all resources ---
        try:
            if hasattr(stream, 'input_stream'):
                await stream.input_stream.close()
        except Exception:
            pass
        try:
            if hasattr(stream, 'close'):
                await stream.close()
        except Exception:
            pass
        try:
            await client.close()
        except Exception:
            pass
        try:
            await http_client.close()
        except Exception:
            pass