"""AgentCore voice agent entry point.

Exposes the AgentCore contract:
  GET  /ping          — health check
  POST /invocations   — HTTP request (returns agent info)
  WS   /ws            — bidirectional audio streaming via WebSocket

The WebSocket handler receives an init message with session config,
opens a Nova Sonic 2.0 bidirectional stream, and pipes audio frames
between the client and Bedrock.
"""

import logging
from bedrock_agentcore import BedrockAgentCoreApp
from nova_sonic import NovaSonic

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()


@app.entrypoint
async def handle_invocation(payload, context):
    """HTTP /invocations handler — returns agent status."""
    return {"status": "healthy", "agent": "voice-agent", "model": "amazon.nova-2-sonic-v1:0"}


@app.websocket
async def websocket_handler(websocket, context):
    """WebSocket /ws handler — bidirectional audio streaming.

    Protocol:
    1. Client sends an init message with session config:
       {"type": "init", "session_id": "...", "voice_id": "...",
        "patient_name": "...", "patient_prompt": "...", "patient_id": "...",
        "llm_completion": false, "system_prompt": "...", "user_id": "..."}
    2. Client sends audio frames:
       {"type": "start_audio"}
       {"type": "audio", "data": "<base64 PCM>"}
       {"type": "end_audio"}
    3. Agent sends back:
       {"type": "text", "text": "Nova Sonic ready"}
       {"type": "audio", "data": "<base64 PCM>"}
       {"type": "text", "text": "...transcription..."}
       {"type": "diagnosis_complete", "text": "..."}
    4. Client sends {"type": "end_session"} to close.
    """
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    try:
        # 1. Wait for init message with session config
        init_msg = await websocket.receive_json()

        if init_msg.get("type") != "init":
            await websocket.send_json({"type": "error", "text": "Expected init message"})
            await websocket.close()
            return

        logger.info("Session init: session_id=%s, patient=%s",
                     init_msg.get("session_id"), init_msg.get("patient_name"))

        # 2. Create NovaSonic client with config from init message
        nova = NovaSonic(
            websocket=websocket,
            voice_id=init_msg.get("voice_id"),
            session_id=init_msg.get("session_id", "default"),
            patient_name=init_msg.get("patient_name", ""),
            patient_prompt=init_msg.get("patient_prompt", ""),
            patient_id=init_msg.get("patient_id", ""),
            llm_completion=init_msg.get("llm_completion", False),
            extra_system_prompt=init_msg.get("system_prompt", ""),
            user_id=init_msg.get("user_id"),
        )

        # 3. Start the Nova Sonic session (opens Bedrock stream)
        await nova.start_session()

        # 4. Handle audio frames until the client disconnects
        await nova.handle_websocket()

    except Exception as e:
        logger.error("WebSocket session error: %s", e)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("WebSocket connection closed")


if __name__ == "__main__":
    app.run(log_level="info")
