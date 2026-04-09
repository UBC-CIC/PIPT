const crypto = require("crypto");
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { verifyToken, getStsCredentials } = require("./auth");
const { SignatureV4 } = require("@smithy/signature-v4");
const { HttpRequest } = require("@smithy/protocol-http");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");

// ─── Voice Agent Adapter ──────────────────────────────────────────────────────
// When VOICE_AGENT_ARN is set, audio is streamed to the AgentCore
// voice agent via SigV4-authenticated WebSocket instead of using the local
// nova_sonic.py child process.
const VOICE_AGENT_ARN = process.env.VOICE_AGENT_ENDPOINT || "";
const AGENTCORE_REGION = process.env.AWS_REGION || "ca-central-1";

// SHA-256 helper for SigV4
class Sha256 {
  constructor(secret) {
    this._hmac = secret
      ? crypto.createHmac("sha256", secret)
      : crypto.createHash("sha256");
  }
  update(data) {
    this._hmac.update(typeof data === "string" ? data : Buffer.from(data));
  }
  async digest() {
    return new Uint8Array(this._hmac.digest());
  }
}

/**
 * Open a SigV4-authenticated WebSocket connection to AgentCore's /ws endpoint.
 * @param {object} initConfig — init message payload (session_id, patient_name, etc.)
 * @returns {Promise<WebSocket>}
 */
async function connectToVoiceAgent(initConfig) {
  const sessionId = initConfig.session_id || `session-${Date.now()}-${crypto.randomUUID()}`;

  // Build the AgentCore WebSocket URL
  const host = `bedrock-agentcore.${AGENTCORE_REGION}.amazonaws.com`;
  const wsPath = `/runtimes/${VOICE_AGENT_ARN}/ws`;
  const queryParams = `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id=${encodeURIComponent(sessionId)}`;

  // Create an HTTP request to sign
  const request = new HttpRequest({
    method: "GET",
    protocol: "wss:",
    hostname: host,
    path: wsPath,
    query: Object.fromEntries(new URLSearchParams(queryParams)),
    headers: {
      host: host,
    },
  });

  // Sign the request with SigV4
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: AGENTCORE_REGION,
    service: "bedrock-agentcore",
    sha256: Sha256,
  });

  const signed = await signer.sign(request);

  // Build the final WebSocket URL with signed headers
  const wsUrl = `wss://${host}${wsPath}?${queryParams}`;
  console.log("🔌 Connecting to AgentCore WebSocket:", wsUrl);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: signed.headers,
    });

    ws.on("open", () => {
      console.log("✅ AgentCore WebSocket connected (session:", sessionId, ")");
      // Send init message with session config
      ws.send(JSON.stringify({ type: "init", ...initConfig }));
      resolve(ws);
    });

    ws.on("error", (err) => {
      console.error("❌ AgentCore WebSocket error:", err.message);
      reject(err);
    });
  });
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// ─── TURN Credential Generation (RFC 5389) ───────────────────────────────────
/**
 * Generate time-limited TURN credentials using HMAC-SHA1.
 * @param {string} username — unique identifier (e.g. socket.userId)
 * @param {string} sharedSecret — TURN shared secret
 * @param {number} ttlSeconds — credential lifetime (max 24 hours)
 * @returns {{ username: string, credential: string }}
 */
function generateTurnCredentials(username, sharedSecret, ttlSeconds = 86400) {
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const turnUsername = `${timestamp}:${username}`;
  const hmac = crypto.createHmac("sha1", sharedSecret);
  hmac.update(turnUsername);
  const turnPassword = hmac.digest("base64");
  return { username: turnUsername, credential: turnPassword };
}

/**
 * Build the ICE server configuration array for a given user.
 * Reads STUN_SERVER_URL, TURN_SERVER_URL, and TURN_SHARED_SECRET from env.
 * @param {string} userId — authenticated user id to scope TURN credentials
 * @returns {Array<{urls: string, username?: string, credential?: string}>}
 */
function getIceServers(userId) {
  const stunUrl = process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302";
  const turnUrl = process.env.TURN_SERVER_URL;
  const turnSecret = process.env.TURN_SHARED_SECRET;

  const iceServers = [{ urls: stunUrl }];

  if (turnUrl && turnSecret) {
    const creds = generateTurnCredentials(userId, turnSecret);
    iceServers.push({
      urls: turnUrl,
      username: creds.username,
      credential: creds.credential,
    });
  }

  return iceServers;
}

// ─── Socket.IO Connection ─────────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = await verifyToken(token);
    socket.userId = decoded.sub;
    socket.userEmail = decoded.email;
    console.log("🔐 User authenticated:", socket.userEmail);
    next();
  } catch (err) {
    console.error("🔐 Authentication failed:", err.message);
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  console.log("🔌 CLIENT CONNECTED:", socket.id, "User:", socket.userEmail);
  console.log(
    process.env.SM_DB_CREDENTIALS
      ? "🔐 DB CREDENTIALS LOADED"
      : "❌ NO DB CREDENTIALS",
  );
  console.log(
    process.env.RDS_PROXY_ENDPOINT ? "🔐 RDS PROXY LOADED" : "❌ NO RDS PROXY",
  );

  let novaProcess = null;
  let novaReady = false;

  // Small delay then log active client count
  setTimeout(() => {
    console.log(`🔌 ACTIVE CLIENTS: ${io.engine.clientsCount}`);
  }, 100);

  socket.on("error", (err) => {
    console.error("🔌 SOCKET ERROR:", err);
  });

  // ─── Start Nova Sonic (Socket.IO audio transport) ───────────────────────
  // When VOICE_AGENT_ARN is set, audio is streamed to the AgentCore
  // voice agent via WebSocket. Otherwise, falls back to the local
  // nova_sonic.py child process.
  socket.on("start-nova-sonic", async (config = {}) => {
    console.log("🚀 Starting Nova Sonic session for client:", socket.id);

    audioStarted = false;

    // Clean up any previous session
    if (socket.agentWs) {
      try { socket.agentWs.close(); } catch {}
      socket.agentWs = null;
    }
    if (novaProcess) {
      novaProcess.kill();
      novaProcess = null;
    }
    novaReady = false;

    // ── AgentCore WebSocket path ──────────────────────────────────────────
    if (VOICE_AGENT_ARN) {
      console.log("🔀 Using AgentCore WebSocket for ARN:", VOICE_AGENT_ARN);

      // Fetch full patient context from the API if we have IDs
      let patientContext = {};
      if (config.patient_id && config.simulation_group_id && process.env.TEXT_GENERATION_ENDPOINT) {
        try {
          const ctxUrl = `${process.env.TEXT_GENERATION_ENDPOINT}/student/patient_context?simulation_group_id=${encodeURIComponent(config.simulation_group_id)}&patient_id=${encodeURIComponent(config.patient_id)}`;
          console.log("📋 Fetching patient context:", ctxUrl);
          const ctxResp = await fetch(ctxUrl, {
            headers: { Authorization: socket.handshake.auth.token || "" },
          });
          if (ctxResp.ok) {
            patientContext = await ctxResp.json();
            console.log("📋 Patient context loaded:", patientContext.patient_name);
          } else {
            console.warn("⚠️ Patient context fetch failed:", ctxResp.status);
          }
        } catch (err) {
          console.warn("⚠️ Patient context fetch error:", err.message);
        }
      }

      try {
        const agentWs = await connectToVoiceAgent({
          session_id: config.session_id || "default",
          voice_id: config.voice_id || "",
          user_id: socket.userId || "anonymous",
          patient_name: patientContext.patient_name || config.patient_name || "",
          patient_prompt: patientContext.patient_prompt || config.patient_prompt || "",
          patient_id: config.patient_id || "",
          simulation_group_id: config.simulation_group_id || "",
          llm_completion: patientContext.llm_completion || config.llm_completion || false,
          system_prompt: patientContext.system_prompt || config.system_prompt || "",
          cognito_token: socket.handshake.auth.token || "",
          text_generation_endpoint: process.env.TEXT_GENERATION_ENDPOINT || "",
        });

        socket.agentWs = agentWs;

        // Relay messages from agent back to the frontend
        agentWs.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());

            if (msg.type === "audio") {
              socket.emit("audio-chunk", { data: msg.data });
            } else if (msg.type === "turn-start") {
              socket.emit("turn-start", { role: msg.role });
            } else if (msg.type === "text") {
              console.log("💬 AGENT TEXT:", msg.text);
              socket.emit("text-message", { text: msg.text, role: msg.role || "assistant" });
              if (msg.text && msg.text.includes("Nova Sonic ready")) {
                novaReady = true;
                socket.emit("nova-started", { status: "Nova Sonic session started" });
              }
            } else if (msg.type === "diagnosis_complete") {
              console.log("🎯 DIAGNOSIS COMPLETE:", msg.text);
              socket.emit("diagnosis-complete", { message: msg.text });
            } else if (msg.type === "diagnosis_verdict") {
              console.log("🩺 DIAGNOSIS VERDICT:", msg.verdict);
              if (msg.verdict) {
                socket.emit("diagnosis-complete", { message: "Session completed successfully" });
              }
            }
          } catch (err) {
            console.warn("⚠️ Failed to parse agent message:", err.message);
          }
        });

        agentWs.on("close", () => {
          console.log("🔚 Voice agent WebSocket closed");
          socket.agentWs = null;
          novaReady = false;
        });

        agentWs.on("error", (err) => {
          console.error("❌ Voice agent WebSocket error:", err.message);
          socket.emit("nova-error", { error: err.message });
        });

      } catch (error) {
        console.error("❌ Failed to connect to voice agent:", error.message);
        socket.emit("nova-error", { error: "Failed to connect to voice agent" });
      }
      return;
    }

    // ── Local child process path (fallback) ───────────────────────────────

    // Get Cognito Identity Pool credentials for user-specific access
    console.log(
      "🔑 Getting Cognito Identity Pool credentials for user:",
      socket.userEmail,
    );
    let stsCredentials;
    try {
      stsCredentials = await getStsCredentials(socket.handshake.auth.token);
      console.log("✅ Successfully obtained Cognito Identity Pool credentials");
    } catch (error) {
      console.error("❌ Failed to get Cognito credentials:", error.message);
      socket.emit("nova-error", {
        error: "Failed to authenticate with AWS services",
      });
      return;
    }

    const PORT = process.env.PORT || 80;

    // Try python3 first, then python if that fails
    const pythonCmd = process.env.PYTHON_CMD || "python3";
    console.log(`🐍 PYTHON_CMD env var: ${process.env.PYTHON_CMD}`);
    console.log(`🐍 Using command: ${pythonCmd}`);
    console.log(`🐍 Attempting to spawn: ${pythonCmd} nova_sonic.py`);

    try {
      novaProcess = spawn(pythonCmd, ["nova_sonic.py"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          SESSION_ID: config.session_id || "default",
          VOICE_ID: config.voice_id || "",
          USER_ID: socket.userId || "anonymous",
          AWS_ACCESS_KEY_ID: stsCredentials.AccessKeyId,
          AWS_SECRET_ACCESS_KEY: stsCredentials.SecretKey,
          AWS_SESSION_TOKEN: stsCredentials.SessionToken,
          SM_DB_CREDENTIALS: process.env.SM_DB_CREDENTIALS || "",
          RDS_PROXY_ENDPOINT: process.env.RDS_PROXY_ENDPOINT || "",
          PATIENT_NAME: config.patient_name || "",
          PATIENT_PROMPT: config.patient_prompt || "",
          PATIENT_ID: config.patient_id || "",
          LLM_COMPLETION: config.llm_completion ? "true" : "false",
          EXTRA_SYSTEM_PROMPT: config.system_prompt || "",
          APPSYNC_GRAPHQL_URL: process.env.APPSYNC_GRAPHQL_URL || "",
          COGNITO_TOKEN: socket.handshake.auth.token || "",
        },
      });
      console.log("📡 Nova process spawned with PID:", novaProcess.pid);
    } catch (error) {
      console.error("❌ Failed to spawn Nova process:", error.message);
      socket.emit("nova-error", { error: "Failed to start voice system" });
      return;
    }

    // Capture stdout and stderr
    novaProcess.stdout.on("data", (data) => {
      data
        .toString()
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          try {
            const parsed = JSON.parse(line);
            console.log("📤 NOVA JSON:", parsed);

            // ─ Audio chunks ───────────────────────────────────────────────
            if (parsed.type === "audio") {
              // Skip debug file saving for better performance
              socket.emit("audio-chunk", { data: parsed.data });
            }
            // ─ Turn start signals ─────────────────────────────────────────
            else if (parsed.type === "turn-start") {
              socket.emit("turn-start", { role: parsed.role });
            }
            // ─ Debug messages ───────────────────────────────────────────
            else if (parsed.type === "debug") {
              console.log("🐞 NOVA DEBUG:", parsed.text);
            }
            // ─ Text messages ─────────────────────────────────────────────
            else if (parsed.type === "text") {
              console.log("💬 NOVA TEXT:", parsed.text);
              socket.emit("text-message", { text: parsed.text, role: parsed.role || "assistant" });
              if (parsed.text.includes("Nova Sonic ready")) {
                novaReady = true;
                socket.emit("nova-started", {
                  status: "Nova Sonic session started",
                });
              }
            }
            // ─ Diagnosis completion ──────────────────────────────────────
            else if (parsed.type === "diagnosis_complete") {
              console.log("🎯 DIAGNOSIS COMPLETE:", parsed.text);
              socket.emit("diagnosis-complete", { message: parsed.text });
            } else if (parsed.type === "diagnosis_verdict") {
              console.log("🩺 DIAGNOSIS VERDICT:", parsed.verdict);
              if (parsed.verdict) {
                socket.emit("diagnosis-complete", {
                  message: "Session completed successfully",
                });
              }
            }
          } catch {
            // Plain‑text fallback
            console.log("[python]", line);
            if (line.includes("Nova Sonic ready")) {
              novaReady = true;
              socket.emit("nova-started", {
                status: "Nova Sonic session started",
              });
            }
            // Forward voice transcriptions to text chat
            // NOTE: JSON-parsed text-message events already handle this above.
            // This fallback is only for non-JSON debug lines — do NOT re-emit as text-message
            // to avoid duplicates.
            // Handle diagnosis completion in plain text fallback
            if (line.includes("SESSION COMPLETED")) {
              socket.emit("diagnosis-complete", {
                message: "Session completed successfully",
              });
            }
          }
        });
    });

    novaProcess.stderr.on("data", (data) => {
      console.warn("⚠️ Nova stderr:", data.toString().trim());
    });

    novaProcess.on("error", (error) => {
      console.error("❌ Nova process error:", error.message);
      if (error.code === "ENOENT") {
        console.log("🐍 Trying 'python' instead of 'python3'");
        // Retry with 'python' command
        try {
          novaProcess = spawn("python", ["nova_sonic.py"], {
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              ...process.env,
              SESSION_ID: config.session_id || "default",
              VOICE_ID: config.voice_id || "",
              USER_ID: socket.userId || "anonymous",
              AWS_ACCESS_KEY_ID: stsCredentials.AccessKeyId,
              AWS_SECRET_ACCESS_KEY: stsCredentials.SecretKey,
              AWS_SESSION_TOKEN: stsCredentials.SessionToken,
              SM_DB_CREDENTIALS: process.env.SM_DB_CREDENTIALS || "",
              RDS_PROXY_ENDPOINT: process.env.RDS_PROXY_ENDPOINT || "",
              PATIENT_NAME: config.patient_name || "",
              PATIENT_PROMPT: config.patient_prompt || "",
              PATIENT_ID: config.patient_id || "",
              SIMULATION_GROUP_ID: config.simulation_group_id || "",
              LLM_COMPLETION: config.llm_completion ? "true" : "false",
              EXTRA_SYSTEM_PROMPT: config.system_prompt || "",
              APPSYNC_GRAPHQL_URL: process.env.APPSYNC_GRAPHQL_URL || "",
              COGNITO_TOKEN: socket.handshake.auth.token || "",
            },
          });
          console.log(
            "📡 Nova process spawned with 'python', PID:",
            novaProcess.pid,
          );
        } catch (retryError) {
          console.error(
            "❌ Failed to spawn with 'python' too:",
            retryError.message,
          );
          socket.emit("nova-error", { error: "Python not found" });
        }
      } else {
        socket.emit("nova-error", { error: error.message });
      }
    });

    novaProcess.on("close", (code) => {
      console.log("🔚 Nova process closed with code:", code);
      novaProcess = null;
      novaReady = false;
    });
  });

  // ─── Audio‑input from client ──────────────────────────────────────────────
  let audioStarted = false;
  socket.on("audio-input", (msg) => {
    // ── AgentCore WebSocket path ──────────────────────────────────────────
    if (socket.agentWs && socket.agentWs.readyState === WebSocket.OPEN) {
      if (!audioStarted) {
        socket.agentWs.send(JSON.stringify({ type: "start_audio" }));
        audioStarted = true;
      }
      socket.agentWs.send(JSON.stringify({ type: "audio", data: msg.data }));
      return;
    }

    // ── Local child process path ──────────────────────────────────────────
    if (novaProcess && novaProcess.stdin.writable && novaReady) {
      if (!audioStarted) {
        novaProcess.stdin.write(JSON.stringify({ type: "start_audio" }) + "\n");
        audioStarted = true;
        console.log("🎬 Sent start_audio to Nova process");
      }
      novaProcess.stdin.write(
        JSON.stringify({ type: "audio", data: msg.data }) + "\n",
      );
    } else {
      console.log("❌ Cannot send audio - not ready");
    }
  });

  // ─── Text‑input from client ───────────────────────────────────────────────
  socket.on("text-input", (msg) => {
    // ── AgentCore WebSocket path ──────────────────────────────────────────
    if (socket.agentWs && socket.agentWs.readyState === WebSocket.OPEN) {
      socket.agentWs.send(JSON.stringify({ type: "text", text: msg.text }));
      console.log("📝 Sent text to AgentCore WS");
      return;
    }

    // ── Local child process path ──────────────────────────────────────────
    if (novaProcess && novaProcess.stdin.writable && novaReady) {
      novaProcess.stdin.write(
        JSON.stringify({ type: "text", data: msg.text }) + "\n",
      );
      console.log("📝 Sent text to Nova process");
    }
  });

  // ─── Text generation streaming ─────────────────────────────────────────────
  socket.on("text-generation", async (data) => {
    console.log("🚀 Text generation request:", data);

    try {
      const response = await fetch(
        `${process.env.TEXT_GENERATION_ENDPOINT}/student/text_generation?simulation_group_id=${data.simulation_group_id}&session_id=${data.session_id}&patient_id=${data.patient_id}&session_name=${data.session_name}&stream=true`,
        {
          method: "POST",
          headers: {
            Authorization: data.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message_content: data.message }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              socket.emit("text-stream", eventData);
            } catch (e) {
              console.warn("Failed to parse SSE:", line);
            }
          }
        }
      }
    } catch (error) {
      console.error("Text generation error:", error);
      socket.emit("text-stream", {
        type: "error",
        content: "Failed to generate response",
      });
    }
  });

  // ─── End‑audio event ─────────────────────────────────────────────────────
  socket.on("end-audio", () => {
    // ── AgentCore WebSocket path ──────────────────────────────────────────
    if (socket.agentWs && socket.agentWs.readyState === WebSocket.OPEN) {
      socket.agentWs.send(JSON.stringify({ type: "end_audio" }));
      audioStarted = false;
      return;
    }

    // ── Local child process path ──────────────────────────────────────────
    if (novaProcess && novaProcess.stdin.writable && novaReady) {
      novaProcess.stdin.write(JSON.stringify({ type: "end_audio" }) + "\n");
      audioStarted = false;
      console.log("🛑 Sent end_audio to Nova process");
    }
  });

  // ─── Optional Stop event ────────────────────────────────────────────────
  socket.on("stop-nova-sonic", () => {
    console.log("🛑 Stop requested by client");
    // ── AgentCore WebSocket path ──────────────────────────────────────────
    if (socket.agentWs) {
      try {
        socket.agentWs.send(JSON.stringify({ type: "end_session" }));
        socket.agentWs.close();
      } catch {}
      socket.agentWs = null;
      novaReady = false;
      return;
    }

    // ── Local child process path ──────────────────────────────────────────
    if (novaProcess) {
      novaProcess.kill();
      novaProcess = null;
      novaReady = false;
    }
  });

  // ─── Disconnect cleanup ──────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("🔌 CLIENT DISCONNECTED:", socket.id);

    // Clean up AgentCore WebSocket session if present
    if (socket.agentWs) {
      try {
        socket.agentWs.send(JSON.stringify({ type: "end_session" }));
        socket.agentWs.close();
      } catch {}
      socket.agentWs = null;
    }
  });
});

// ─── Start HTTP server on port 80 ─────────────────────────────────────────
const PORT = process.env.PORT || 80;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket server running on port ${PORT}`);
});
