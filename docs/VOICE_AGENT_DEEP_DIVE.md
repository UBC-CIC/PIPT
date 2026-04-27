# GenRx Voice Agent Deep Dive

**Date:** April 27, 2026
**Scope:** Architecture, code walkthrough, runtime flow, debrief integration, and design decisions for the voice agent pipeline
**Audience:** Developers working on or maintaining the GenRx voice feature

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Code Explanation](#2-code-explanation)
3. [Runtime Flow](#3-runtime-flow)
4. [Voice and Debrief Integration](#4-voice-and-debrief-integration)
5. [Design Decisions](#5-design-decisions)

---

## 1. Architecture Overview

### Overview

Voice Mode uses a WebSocket-based bidirectional streaming architecture implemented in `cdk/voice-agent/nova_sonic.py`. It allows real-time voice conversation between a student (pharmacy student) and an AI agent (simulated patient) using **Amazon Nova Sonic 2.0** (`amazon.nova-2-sonic-v1:0`) via AWS Bedrock.

The `NovaSonic` class handles the full session lifecycle: establishing the WebSocket connection, compiling the patient's medical context, streaming audio bidirectionally, and persisting conversation history.

Unlike Text Mode (which uses API Gateway > Lambda > LangChain), Voice Mode requires continuous, low-latency, bidirectional audio streaming. AgentCore spins up a dedicated Docker container (`cdk/voice-agent`) that maintains a persistent WebSocket connection. Audio bytes from the student's microphone stream into this container, pass to Bedrock's Nova Sonic 2.0, and audio responses stream back in real-time.

### Request Path

```
Browser > Socket.IO > Node.js (socket-server) > WebSocket > AgentCore container > Bedrock
```

### Audio Specifications

| Direction | Sample Rate | Format | Encoding |
|-----------|-------------|--------|----------|
| Input (student > Bedrock) | 16 kHz | 1-channel LPCM | base64 |
| Output (Bedrock > student) | 24 kHz, 16-bit | 1-channel LPCM | base64 |

Voice IDs are configurable dynamically by the client (AWS voices).

### Why the Socket Server Exists

The frontend does not connect directly to AgentCore. The `socket-server` (`cdk/socket-server/server.js`) sits between them for five reasons:

1. **SigV4 signing.** AgentCore requires SigV4-signed WebSocket handshakes, which need AWS credentials. Those credentials cannot be exposed in the browser. `connectToVoiceAgent` in `server.js` signs the request with `SignatureV4` and passes signed headers to the handshake.

2. **Cognito JWT authentication.** The socket-server verifies the student's identity before allowing any voice session. AgentCore has no knowledge of the Cognito setup.

3. **Patient context fetch.** It calls `/student/patient_context` using the student's auth token and passes the result to AgentCore in the init message. This happens in the socket-server because it has access to both the student's auth token and the internal API.

4. **Non-voice features.** The same server handles text chat streaming, text generation proxy, and file operations.

5. **Session multiplexing.** Multiple students connect to the same socket-server; each gets their own AgentCore WebSocket session.

In short: the socket-server is a thin proxy/auth layer for voice, and the main backend for everything else.

---

## 2. Code Explanation

### `cdk/voice-agent/` Directory

This is the Voice Mode logic. It runs as a containerized FastAPI application wrapped by the AWS AgentCore SDK.

---

### `bot.py` - Entry Point

Accepts WebSocket connections and delegates to the AI logic.

**`handle_invocation(payload, context)`**
- HTTP GET `/invocations` handler.
- Serves as a health check so ECS/AgentCore knows the container is alive.

**`websocket_handler(websocket, context)`**
- Listens for incoming WebSocket connections.
- Waits for an initial JSON message containing `session_id`, `patient_name`, user tokens, etc.
- Instantiates `NovaSonic` with that configuration.
- Calls `nova.start_session()` to open a stream to Bedrock.
- Calls `nova.handle_websocket()` to begin routing audio between the student and Bedrock.

---

### `nova_sonic.py` - Core Voice Logic

The heaviest file. Manages the Bedrock connection, AI persona, audio streaming, and database writes.

#### Setup and Configuration

| Function | Purpose |
|----------|---------|
| `__init__` | Initializes variables, UUIDs, region config, audio buffers |
| `_init_client()` / `_get_bedrock_client()` | Fetches AWS credentials, initializes the Bedrock API client for bidirectional streaming |
| `_get_medical_context()` | Fetches the patient's medical history from PostgreSQL (see RAG Bypass in [Section 4](#4-voice-and-debrief-integration)) |
| `get_system_prompt()` / `get_default_system_prompt()` | Fetches AI behavior instructions from PostgreSQL (overridable via `system_prompt_history` table) |
| `_sanitize_prompt_for_voice()` | Regex scrubber that strips text-specific instructions from the prompt (see below) |

**Prompt sanitization detail:** The default text-based prompt included instructions like "Start the conversation by saying 'Hello'." In continuous voice streaming, LLMs tend to over-index on early instructions and prepend "Hello" to every response. `_sanitize_prompt_for_voice` uses regex to strip greeting instructions and injects a hardcoded `VOICE MODE OVERRIDE` that forces the AI to greet only once. This prevents "greet-loop" bugs and keeps the transcript clean for debrief consumption.

#### Audio and Streaming

| Function | Purpose |
|----------|---------|
| `start_session()` | Opens the bidirectional stream to Bedrock Nova Sonic 2.0. Sends initial config (voice type, sample rates, max tokens) and the system prompt. |
| `handle_websocket()` | Infinite loop listening to the frontend. Routes `audio` events to Bedrock, handles `interrupt`, `start_audio`, `end_audio`, `text`, and `set_voice` events. |
| `send_audio_chunk()` | Wraps incoming user audio bytes into a Bedrock-compatible `audioInput` JSON payload and pushes it to the stream. |
| `_process_responses()` | Background async loop reading from Bedrock. Receives `contentStart`, `textOutput`, and `audioOutput` events. |
| `_handle_event()` | Routes events from `_process_responses()`. Audio is forwarded to the frontend. Text is checked for triggers (`{"interrupted": true}`, `SESSION COMPLETED`) and buffered for DB save. |

**Interrupt filtering detail:** When the AI is interrupted, Bedrock sometimes outputs `{"interrupted": true}` in the text stream. The logic now uses `_INTERRUPTED_RE.sub("", text)` to strip this marker from the transcript, dropping the chunk entirely if empty.

**Diagnosis completion:** `_handle_event` monitors the text stream for the phrase `SESSION COMPLETED`. When detected, the agent injects a goodbye message, fires a `diagnosis_complete` WebSocket event to the frontend, and closes the session.

#### Database and Integration

| Function | Purpose |
|----------|---------|
| `_save_user_message_async(user_text)` | Saves transcribed student text to PostgreSQL `messages` table and DynamoDB history. |
| `_call_matching_endpoint(message_id, message_content)` | HTTP POST to the Text Generation Lambda with `mode="match"`. Triggers Key Question scoring for the debrief. |

Messages from both AI (ASSISTANT) and student (USER) are normalized and saved simultaneously to DynamoDB (via `chat_history`) and PostgreSQL (via `SimpleConnectionPool`).

---

### `chat_history.py` - Session Memory

Handles chat log persistence and retrieval.

| Function | Purpose |
|----------|---------|
| `format_chat_history(session_id)` | Fetches the last 10 messages from DynamoDB for injection into the AI's system prompt at session start. |
| `add_message(session_id, role, content)` | Pushes a new message (`user` or `ai`) into the LangChain-managed DynamoDB table. |
| `insert_message_to_postgres()` / `connect_to_db()` | Connects to RDS (PostgreSQL) via Secrets Manager to store messages for analytics and debrief generation. |

**Chat history continuity:** When a student switches from text to voice mid-conversation, the voice agent loads previous chat history from DynamoDB via `chat_history.format_chat_history(self.session_id)` and injects it into the system prompt. The AI patient knows what was already discussed in text and continues naturally in voice.

---

### Connection Points Outside `cdk/voice-agent/`

**`cdk/socket-server/server.js`**
- `connectToVoiceAgent(initConfig)`: Uses SigV4 to open a signed WebSocket to the AgentCore container URL (`VOICE_AGENT_ARN`).
- Acts as a relay, forwarding base64 audio chunks between frontend Socket.IO and AgentCore WebSocket.

**`cdk/text_generation/src/main.py`**
- `if mode == "match"`: The Voice Agent does not have LangChain/vector embedding libraries loaded. It outsources student question grading to this Lambda endpoint.
- `match_message_to_questions(...)` (in `helpers/chat.py`): Converts student text to an embedding, compares against Key Questions via cosine similarity, writes `matched_question_ids` to PostgreSQL. The debrief relies entirely on these database records.

---

## 3. Runtime Flow

### Session Initialization and Context Loading

This entire process runs once during WebSocket initialization, before the student says a word.

#### Step 1 - Fetch All Patient Data

When the student connects, `NovaSonic` calls `_get_medical_context()`. Instead of initializing a LangChain PGVector store, it opens a PostgreSQL connection and runs:

```sql
SELECT document
FROM langchain_pg_embedding e
JOIN langchain_pg_collection c ON e.collection_id = c.uuid
WHERE c.name = %s  -- patient_id
```

No `LIMIT`, no `ORDER BY similarity`. Every chunk for that patient is fetched.

#### Step 2 - Reassemble Chunks

LangChain's ingestion pipeline originally chunked the patient's medical data into individual rows in `langchain_pg_embedding`. The voice agent stitches them back together:

```python
rows = cursor.fetchall()
context = "\n---\n".join([r[0] for r in rows])
```

`context` now holds the entire case file: allergies, family history, chief complaint, medications, everything.

#### Step 3 - Compile System Prompt

`get_system_prompt()` injects this context string into the AI's instructions (along with sanitized behavioral rules like "Act as the patient, do not break character, don't greet at every turn").

#### Step 4 - Push to Bedrock

`start_session()` opens the WebSocket to Bedrock Nova Sonic 2.0. Before audio streaming begins, it sends an initial `sessionConfig` payload:

```json
{
  "sessionConfig": {
    "systemPrompt": "You are patient X... [ENTIRE MEDICAL FILE]...",
    "voice": "matthew",
    "sampleRate": 16000
  }
}
```

Nova Sonic 2.0 has a large context window and ingests this in a fraction of a second. From this point, the stream is strictly audio-in/audio-out. The AI has the full case file in active memory for the duration of the session.

---

### Lifecycle of a Single Voice Turn

Example: student says "Are you experiencing chest pain?"

| Step | Component | Action |
|------|-----------|--------|
| 1 | **Frontend** | Records microphone, encodes to base64, emits `socket.emit("audio-chunk")` to socket-server. |
| 2 | **Socket Server** | Receives chunk, forwards via WebSocket to `bot.py`. |
| 3 | **bot.py** | `websocket_handler` passes audio to `nova_sonic.py`'s `handle_websocket()` loop. |
| 4 | **nova_sonic.py** | `send_audio_chunk()` packages base64 audio into a Bedrock payload, streams to Nova Sonic 2.0. |
| 5 | **Bedrock** | Processes audio, transcribes to text ("Are you experiencing chest pain?"), generates patient response audio ("No, just knee pain."). |
| 6 | **nova_sonic.py** | `_handle_event()` receives student transcript, calls `_save_user_message_async()` (DB write + HTTP POST to `/match` on Text Generation Lambda). Receives AI audio, emits `{"type": "audio"}` back to WebSocket. |
| 7 | **Socket Server** | Relays AI audio to frontend. |
| 8 | **Frontend** | Plays audio through speakers. |

---

## 4. Voice and Debrief Integration

The Voice Agent is a continuous audio loop. It is fast and narrow-scoped: it does not know about grading, vector embeddings, or rubrics. Its only job is to stay in character and stream audio.

To make the debrief work, Voice Mode hooks into the existing Text Generation Lambda in real-time.

### 4.1 Real-Time Matching Handoff

In Text Mode, grading happens when the user submits a message. In Voice Mode, the user streams audio bytes continuously.

To bridge this: every time the student finishes a sentence, Bedrock transcribes it. `nova_sonic.py` calls `_save_user_message_async(user_text)`, which writes to the PostgreSQL `messages` table and generates a `message_id`. Immediately after, it fires an HTTP POST to the Text Generation Lambda:

```json
{"mode": "match", "message_id": "<uuid>", "message_content": "<transcript>"}
```

**Implication:** The Lambda is triggered during the voice call, sentence by sentence, in the background. By the time the user clicks "End Session" and calls `mode="debrief"`, all `matched_question_ids` in the database are already populated. No bulk grading is needed at the end, just read the pre-scored rows.

### 4.2 Synchronous Lambda Constraint

In the voice-fixes branch, the recent commit in `cdk/text_generation/src/main.py` removed `run_matching_async()` and replaced it with synchronous `match_message_to_questions()`.

**Why:** AWS Lambda freezes its execution environment the instant it returns an HTTP response. The previous async implementation spun up a background thread for cosine similarity + DB UPDATE on the `messages` table. The Lambda was freezing before the database write completed, resulting in missing `matched_question_ids` and 0% debrief scores.

Hence, matching and DB writes must execute synchronously before returning `200 OK`.

### 4.3 Transcript Sanitization

The debrief LLM reads transcripts from the `messages` table. Two sanitization steps protect transcript quality:

**Interrupt marker stripping.** When a student interrupts the AI, Bedrock outputs `{"interrupted": true}` as literal text. Without filtering, this JSON string would be inserted into the `messages` table. `nova_sonic.py` strips it before DB insert:

```python
_INTERRUPTED_RE = re.compile(r'\{\s*"interrupted"\s*:\s*true\s*\}', re.IGNORECASE)
```

**Prompt sanitization.** `_sanitize_prompt_for_voice` strips text-specific instructions (e.g., "Start by saying Hello") so the AI does not repeat greetings on every turn. This keeps the transcript natural for debrief consumption.

### 4.4 Bypassing RAG/Vector Search

For now, `_get_medical_context()` in `nova_sonic.py` does not use `vectorstore.similarity_search()`. It opens a raw `psycopg2` connection and executes:

```sql
SELECT document
FROM langchain_pg_embedding e
JOIN langchain_pg_collection c ON e.collection_id = c.uuid
WHERE c.name = %s
```

**Why:**
- Voice streaming would have to pause the WebSocket for ~1.5 seconds per utterance to generate an embedding and query pgvector.
- Spoken language uses pronouns and fragments ("Does it hurt?") that perform poorly in semantic search.
- A one-time vector search at session start with a generic query (e.g., "Patient X medical history") only returns the top-N chunks. For example, it might pull chief complaints and medications but miss family history or allergies. Since voice mode cannot dynamically query the database later, the AI would hallucinate when asked about missing data.
- Nova Sonic 2.0 has a large context window. Loading the entire case file into the system prompt at initialization is both safe and faster than vector search.

### 4.5 Key Questions Caching

In `cdk/text_generation/src/main.py`:

```python
cached = get_cached_key_questions(session_id, TABLE_NAME)
if not cached:
    cache_key_questions(...)
```

**Why:** In Text Mode, checking rubric embeddings once per chat message is fine. In Voice Mode, the student may speak 30+ sentences in a 5-minute call, triggering `mode="match"` 30+ times. Without caching, every invocation fetches the rubric and calls Bedrock to generate Key Question embeddings. This caching ensures the rubric is embedded once per session and reused for all subsequent sentences.

### 4.6 Debrief Generation Flow (Voice Mode)

#### Background: Real-Time Scoring

Every time the student finishes a sentence, the following happens silently:

- **The Voice Agent** (`nova_sonic.py`) is an actor playing the patient. It does not have the rubric. It stays in character and streams audio.
- **The Text Generation Lambda** (`main.py`) is the grader. It has the vector embeddings and Key Questions.
- **PostgreSQL** (`messages` table) is the shared state.

**Steps per sentence:**

1. **Student speaks.** Bedrock transcribes audio to text.
2. **Voice Agent writes to DB.** `_save_user_message_async` inserts a row into `messages` with a unique `message_id`.
3. **Voice Agent calls Lambda.** `_call_matching_endpoint` sends HTTP POST to Text Generation Lambda: `{"mode": "match", "message_id": "<uuid>", "message_content": "<transcript>"}`.
4. **Lambda assesses the sentence.** Checks `get_cached_key_questions` for cached rubric. Runs `match_message_to_questions` (cosine similarity against Key Questions). Updates `matched_question_ids` on the `messages` row.

By the time the student clicks "End Session," all scoring is already done.

#### Debrief Generation

1. **Frontend calls Lambda** with `mode="debrief"`.
2. **Lambda gathers evidence from the database:**
   - Full chat transcript (all messages, both roles)
   - Key Questions for this patient case
   - Student's final recommendation text
   - Graded rows (messages where `matched_question_ids` is populated)
3. **Deterministic scoring (no LLM involvement here).** Inside `helpers/chat.py` > `build_questions_from_matched_data`:
   - Builds list of Questions Addressed from graded rows
   - Subtracts from rubric to get Questions Missed
   - Calculates Overall Score
4. **LLM generates feedback.** Lambda sends a prompt to Bedrock LLM containing: transcript, recommendation, questions addressed, questions missed. Instructions: do not alter the math, write a 3-sentence summary, identify recommendation strengths/weaknesses, suggest better phrasings.
5. **Suggested rewrites.** For moderate-match questions (e.g., "How's your heart?" instead of "Do you have chest pain?"), the LLM generates a `suggested_rewrite`.
6. **Save and return.** Bedrock returns a JSON object (summary, strengths, weaknesses, rewrites). Lambda attaches the deterministic score, saves to `debriefs` table, returns to frontend.

---

## 5. Design Decisions

### 5.1 Bidirectional Streaming vs. Request/Response

#### Previous Architecture (Request/Response Pipeline)

The old voice implementation followed a sequential, blocking pipeline:

1. Student finishes speaking entirely
2. Client sends the **complete** audio file to an STT service
3. STT service returns transcribed text, sent to the LLM
4. LLM generates a **complete** text response
5. Text response sent to a TTS service
6. TTS returns final audio, sent back to the client for playback

**Core problem:** Every step blocks on the previous one. The student waits in silence for the entire chain to finish (typically 3-5 seconds) before hearing a single word back.

#### Current Architecture (Bidirectional Streaming)

Audio flows **simultaneously in both directions** over a single persistent WebSocket connection to Bedrock Nova Sonic 2.0. Three specific improvements result from this:

**Near-Zero Time-To-First-Byte (TTFB)**
- Audio chunks stream to Bedrock **while the student is still speaking**
- Bedrock processes intent in real-time as chunks arrive
- As the LLM generates its **first few tokens**, Bedrock immediately synthesizes them into audio and streams them back
- The client begins playback **before the AI has finished generating the rest of the response**
- Result: the perceived pause between student speech and AI response drops from 3-5 seconds to near-zero

**Native Interruptibility (Barge-In)**
- **Old behavior:** If the student interrupts mid-response, the backend has already generated the full response and plays it blindly, with no mechanism to stop
- **New behavior:**
  - The persistent WebSocket maintains continuous session state
  - The frontend sends `{"type": "interrupt"}`
  - The backend immediately closes the Bedrock output stream via `self.stream.input_stream.close()`
  - The AI stops mid-word and begins listening to the new input
  - Result: natural, human-like conversational turn-taking

**Simultaneous Multi-Modal Output**
- The bidirectional stream **multiplexes** different event types over the same connection:
  - `audioOutput` chunks played through the student's speakers
  - `textOutput` events rendered as real-time closed captions in the UI
- Both arrive in sync, enabling:
  - Captions that are perfectly aligned with spoken audio
  - UI state changes (e.g., `diagnosis_complete` event) triggered at the exact moment the AI speaks the relevant words
- **Old behavior:** Syncing UI updates with voice was difficult because text and audio were generated in separate, sequential steps

---

### 5.2 WebSocket vs. WebRTC

WebRTC is the standard for **human-to-human** video/voice calls (Zoom, Google Meet). For an **AI voice agent** backed by AWS Bedrock, it introduces unnecessary overhead across four dimensions.

#### 5.2a Network Hops

Both architectures must cross the `ca-central-1` > `us-east-1` region boundary to reach Nova Sonic. That hop is unavoidable. The difference is what happens before that hop.

- **WebRTC:** browser > TURN relay (`ca-central-1`) > agent container (`ca-central-1`) > Bedrock (`us-east-1`)
  - **3 network hops** before Nova Sonic receives a single audio chunk
- **WebSocket:** browser > AgentCore container > Bedrock (`us-east-1`)
  - **2 network hops**, the TURN relay is eliminated entirely

#### 5.2b UDP vs. TCP: Jitter vs. Ordering

This is the more fundamental issue and the reason the region boundary matters more for WebRTC than for WebSocket.

**WebRTC uses UDP:**
- UDP is intentionally lightweight: sends packets without waiting to confirm arrival or ordering
- Fine for video calls: a dropped frame = a blurry moment; retransmitting stale video frames would make things worse
- **Not fine for AI audio streaming:** audio must be stitched into a coherent, continuous stream
- When packets arrive out-of-order or are delayed across a variable-latency inter-region link, the receiver has two bad options:
  - **Wait** for the missing packet: gap/stutter in playback
  - **Skip** the missing packet: click or audio dropout
- WebRTC mitigates this with a **jitter buffer**, which intentionally adds a fixed delay to absorb variance
  - If the inter-region link has 20-30ms of jitter, the buffer must be >= that size
  - This **permanently adds latency to every audio chunk** to handle worst-case packets

**WebSocket uses TCP:**
- TCP guarantees **in-order delivery** and **automatic retransmission** of dropped packets at the transport layer
- The receiver always gets chunks in the correct order, no jitter buffer needed
- Trade-off: small acknowledgement overhead per packet
  - On a stable inter-region link, this overhead is **negligible and constant** (vs. UDP's variable jitter penalty)

#### 5.2c Pipe Buffer Inside the Container

Even after audio arrives at the agent container, the WebRTC architecture has an additional latency source unrelated to the network: the **Node.js > Python handoff**.

**Previous WebRTC setup:**
- The agent container ran **Node.js** (`server.js`) to handle the WebRTC connection
- It spawned a **Python** child process (`nova_sonic.py`) for Bedrock communication, because the Nova Sonic streaming client is a Python SDK (`boto3`)
- Data crossed between them via `stdin`/`stdout` **OS pipes**

**How OS pipe buffering causes choppy audio:**
- OS pipes are **kernel-managed** with a buffer (typically 4KB or 64KB)
- When Node.js writes a small audio chunk into the pipe, the kernel does **not** immediately forward it to Python
- The kernel holds writes until the buffer fills or the writer explicitly flushes
- For small, frequent audio chunks, the result is:
  - Python (and Bedrock) receives **nothing** for a period...
  - ...then suddenly receives a **large burst** of accumulated chunks
  - The same buffering happens in reverse on the response path
- The student hears **choppy, stuttering, robotic** playback because data arrives in bursts instead of a smooth stream

**Current WebSocket + AgentCore setup:**
- The entire agent is **Python** (FastAPI)
- The browser's WebSocket terminates in the **same Python process** that holds the Bedrock HTTP/2 stream
- Audio moves through **in-memory function calls**, no IPC, no kernel buffering between receipt and delivery

**Summary:** WebSocket eliminates three compounding latency sources:

| Source | WebRTC | WebSocket |
|--------|--------|-----------|
| TURN relay hop | Present (3 hops total) | Eliminated (2 hops total) |
| UDP jitter across variable-latency link | Requires jitter buffer (adds fixed latency) | TCP handles ordering at transport layer (no buffer needed) |
| OS pipe buffer in container | Node.js > Python IPC causes burst pattern | Single Python process, in-memory calls |

Any one alone adds latency. All three together produce the choppy playback observed in the previous architecture.

#### 5.2d Packet Loss Sensitivity

- **WebRTC (UDP):** A dropped packet during a human phone call produces a tiny glitch. Human brains fill in the missing syllable effortlessly.
- **AI models (TCP via WebSocket):** Nova Sonic is **highly sensitive** to audio corruption. Dropped UDP packets produce audio artifacts that can cause the model to:
  - Hallucinate words that were never spoken
  - Completely misunderstand the student's medical symptoms
- TCP guarantees every chunk arrives **in the exact order it was spoken**, ensuring the highest possible transcription and comprehension accuracy by the LLM

#### 5.2e Unified Data and Control Channel

- **WebRTC:** Passing metadata alongside audio (patient context, system prompts, voice IDs) requires negotiating a **separate WebRTC Data Channel**
- **WebSocket:** Binary audio data and JSON control instructions travel over the **exact same connection**
  - The frontend can send `{"type": "set_voice", "voice_id": "matthew"}` followed immediately by `{"type": "audio", "data": "..."}` on the same pipe
  - No channel negotiation overhead

---

### 5.3 Python-Native (FastAPI) vs. Node.js + Python

#### The Two-Language Problem

The previous architecture required two languages running simultaneously:

- **Node.js** - required to handle the incoming WebRTC audio connection from the browser
- **Python** - required to communicate with Bedrock, because the Nova Sonic streaming SDK is built on `boto3` (Python)

These are **separate OS processes** that cannot share memory. Audio bytes passed from Node.js to Python via OS pipes (`stdout` > `stdin`).

#### How OS Pipes Create Bursts

- An OS pipe is a kernel-managed communication channel with an internal buffer (typically 4KB or 64KB)
- When Node.js writes a small audio chunk into the pipe:
  - The kernel does **not** immediately deliver it to Python
  - It accumulates writes in the buffer until it fills (or is explicitly flushed)
- For real-time audio (small, frequent chunks):
  - Python receives **nothing... nothing... nothing...** while the buffer fills
  - Then receives a **large dump** of all accumulated chunks at once
  - The reverse path (Python > Node.js) exhibits the same behavior
- Result: **choppy, stuttering audio** - data arrives in bursts instead of a continuous stream

#### The Fix: Single-Process Python

The AgentCore container uses **FastAPI** to accept the WebSocket audio stream natively in Python. The incoming audio handler and the Bedrock SDK (`boto3`) live in the **same process**, sharing the **same memory space**.

| Step | What Happens |
|------|-------------|
| **Receive** | FastAPI receives a base64 audio chunk from the WebSocket, stores it in RAM as a Python byte array |
| **Pass** | Calls `send_audio_chunk()` directly, passing the **in-memory reference** - no OS kernel involvement, no inter-process communication (IPC) |
| **Stream** | The byte is pushed into the Bedrock HTTPS stream the **instant** it arrives from the student's microphone |

- Passing a memory pointer takes **nanoseconds**
- There is **no inter-process communication**, no OS pipe, and no kernel buffer waiting to fill
- Node.js is completely removed from the container

---

*This document covers the voice agent architecture and design rationale. For console setup and deployment instructions, see [AGENTCORE_VOICE_AGENT_SETUP.md](AGENTCORE_VOICE_AGENT_SETUP.md). For infrastructure review, see [CDK_TECHNICAL_REVIEW.md](CDK_TECHNICAL_REVIEW.md).*
