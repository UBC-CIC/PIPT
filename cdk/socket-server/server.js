const crypto = require("crypto");
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { verifyToken, getStsCredentials } = require("./auth");
const { MediaBridge } = require("./media-bridge");

// ─── Voice Agent Adapter ──────────────────────────────────────────────────────
// When VOICE_AGENT_ENDPOINT is set, WebRTC signaling is proxied to the
// agentcore-voice-agent container via REST instead of using the local
// MediaBridge + nova_sonic.py child process.
const VOICE_AGENT_ENDPOINT = process.env.VOICE_AGENT_ENDPOINT || "";

/**
 * Forward a signaling action to the voice agent's /invocations endpoint.
 * @param {string} action — one of: ice_config, offer, ice_candidate, disconnect
 * @param {object} data   — action-specific payload
 * @returns {Promise<object>} parsed JSON response
 */
async function callVoiceAgent(action, data = {}) {
  const resp = await fetch(`${VOICE_AGENT_ENDPOINT}/invocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  if (!resp.ok) {
    throw new Error(`Voice agent returned ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
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
  // This handler uses Socket.IO for audio: Nova stdout "audio" messages are
  // emitted as "audio-chunk" events. This path coexists with the WebRTC
  // start-voice-session handler — each socket uses one transport per session.
  socket.on("start-nova-sonic", async (config = {}) => {
    console.log("🚀 Starting Nova Sonic session for client:", socket.id);

    audioStarted = false;

    // Kill any previous process
    if (novaProcess) {
      novaProcess.kill();
      novaProcess = null;
    }
    novaReady = false;

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
            // ─ Debug messages ───────────────────────────────────────────
            else if (parsed.type === "debug") {
              console.log("🐞 NOVA DEBUG:", parsed.text);
            }
            // ─ Text messages ─────────────────────────────────────────────
            else if (parsed.type === "text") {
              console.log("💬 NOVA TEXT:", parsed.text);
              socket.emit("text-message", { text: parsed.text });
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
            if (line.includes("User:") || line.includes("Assistant:")) {
              socket.emit("text-message", { text: line });
            }
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

  // ─── Start Voice Session (WebRTC) ─────────────────────────────────────────
  // When VOICE_AGENT_ENDPOINT is set, signaling is proxied to the agentcore
  // voice agent container. Otherwise, falls back to the local MediaBridge +
  // nova_sonic.py child process path.
  socket.on("start-voice-session", async (config = {}) => {
    console.log("🚀 Starting WebRTC voice session for client:", socket.id);

    // ── Agent-proxied path ────────────────────────────────────────────────
    if (VOICE_AGENT_ENDPOINT) {
      console.log("🔀 Using voice agent adapter:", VOICE_AGENT_ENDPOINT);

      // Clean up any previous agent session
      if (socket.agentPcId) {
        try { await callVoiceAgent("disconnect", { pc_id: socket.agentPcId }); } catch {}
        socket.agentPcId = null;
      }

      try {
        // Fetch ICE servers from the agent (KVS TURN credentials)
        const iceConfig = await callVoiceAgent("ice_config");
        socket.emit("ice-servers", { iceServers: iceConfig.iceServers });
        console.log("🧊 Sent agent ICE servers to client:", socket.id);
      } catch (error) {
        console.error("❌ Voice agent ice_config failed:", error.message);
        socket.emit("nova-error", { error: "Failed to get ICE configuration from voice agent" });
      }
      return;
    }

    // ── Legacy MediaBridge path (unchanged) ───────────────────────────────

    // Kill any previous nova process
    if (novaProcess) {
      novaProcess.kill();
      novaProcess = null;
    }
    novaReady = false;

    // Clean up any existing MediaBridge
    if (socket.mediaBridge) {
      socket.mediaBridge.close();
      socket.mediaBridge = null;
    }

    // Get Cognito Identity Pool credentials
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

    // Spawn nova_sonic.py child process (same logic as start-nova-sonic)
    const pythonCmd = process.env.PYTHON_CMD || "python3";
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

    // Store nova process reference on socket
    socket.novaProcess = novaProcess;

    novaProcess.stderr.on("data", (data) => {
      console.warn("⚠️ Nova stderr:", data.toString().trim());
    });

    novaProcess.on("error", (error) => {
      console.error("❌ Nova process error:", error.message);
      socket.emit("nova-error", { error: error.message });
    });

    novaProcess.on("close", (code) => {
      console.log("🔚 Nova process closed with code:", code);
      novaProcess = null;
      socket.novaProcess = null;
      novaReady = false;
    });

    // Create MediaBridge with ICE server config and nova process
    const iceServers = getIceServers(socket.userId);
    const mediaBridge = new MediaBridge(iceServers, novaProcess);
    socket.mediaBridge = mediaBridge;

    // Wire non-audio Nova messages (text, diagnosis) through Socket.IO
    mediaBridge.onNovaMessage((parsed) => {
      if (parsed.type === "text") {
        console.log("💬 NOVA TEXT:", parsed.text);
        socket.emit("text-message", { text: parsed.text });
        if (parsed.text && parsed.text.includes("Nova Sonic ready")) {
          novaReady = true;
          socket.emit("nova-started", {
            status: "Nova Sonic session started",
          });
        }
      } else if (parsed.type === "diagnosis_complete") {
        console.log("🎯 DIAGNOSIS COMPLETE:", parsed.text);
        socket.emit("diagnosis-complete", { message: parsed.text });
      } else if (parsed.type === "diagnosis_verdict") {
        console.log("🩺 DIAGNOSIS VERDICT:", parsed.verdict);
        if (parsed.verdict) {
          socket.emit("diagnosis-complete", {
            message: "Session completed successfully",
          });
        }
      } else if (parsed.type === "raw") {
        // Plain-text fallback from Nova
        const line = parsed.text || "";
        if (line.includes("Nova Sonic ready")) {
          novaReady = true;
          socket.emit("nova-started", {
            status: "Nova Sonic session started",
          });
        }
        if (line.includes("User:") || line.includes("Assistant:")) {
          socket.emit("text-message", { text: line });
        }
        if (line.includes("SESSION COMPLETED")) {
          socket.emit("diagnosis-complete", {
            message: "Session completed successfully",
          });
        }
      }
    });

    // Relay server-side ICE candidates to the client
    mediaBridge.onIceCandidate((candidate) => {
      socket.emit("webrtc-ice-candidate", { candidate });
    });

    // Emit ICE server config to client
    socket.emit("ice-servers", { iceServers });
    console.log("🧊 Sent ICE server config to client:", socket.id);
  });

  // ─── WebRTC Offer ─────────────────────────────────────────────────────────
  socket.on("webrtc-offer", async ({ sdp } = {}) => {
    console.log("📨 Received WebRTC offer from client:", socket.id);

    // ── Agent-proxied path ────────────────────────────────────────────────
    if (VOICE_AGENT_ENDPOINT) {
      try {
        const result = await callVoiceAgent("offer", {
          sdp: sdp.sdp || sdp,
          type: sdp.type || "offer",
        });
        socket.agentPcId = result.pc_id;
        socket.emit("webrtc-answer", { sdp: { sdp: result.sdp, type: result.type } });
        console.log("📤 Sent agent WebRTC answer to client:", socket.id);
      } catch (error) {
        console.error("❌ Voice agent offer failed:", error.message);
        socket.emit("nova-error", { error: error.message });
      }
      return;
    }

    // ── Legacy MediaBridge path ───────────────────────────────────────────
    if (!socket.mediaBridge) {
      socket.emit("nova-error", { error: "No active voice session" });
      return;
    }

    try {
      const timeoutMs = 5000;
      const answerPromise = socket.mediaBridge.handleOffer(sdp);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SDP answer timed out after 5 seconds")), timeoutMs)
      );

      const { sdpAnswer } = await Promise.race([answerPromise, timeoutPromise]);
      socket.emit("webrtc-answer", { sdp: sdpAnswer });
      console.log("📤 Sent WebRTC answer to client:", socket.id);
    } catch (error) {
      console.error("❌ WebRTC offer handling failed:", error.message);
      socket.emit("nova-error", { error: error.message });
    }
  });

  // ─── WebRTC ICE Candidate ─────────────────────────────────────────────────
  socket.on("webrtc-ice-candidate", ({ candidate } = {}) => {
    // ── Agent-proxied path ────────────────────────────────────────────────
    if (VOICE_AGENT_ENDPOINT && socket.agentPcId) {
      callVoiceAgent("ice_candidate", {
        pc_id: socket.agentPcId,
        candidates: [{
          candidate: candidate.candidate,
          sdp_mid: candidate.sdpMid,
          sdp_mline_index: candidate.sdpMLineIndex,
        }],
      }).catch((err) => console.error("❌ Voice agent ICE candidate failed:", err.message));
      return;
    }

    // ── Legacy MediaBridge path ───────────────────────────────────────────
    if (!socket.mediaBridge) return;

    try {
      socket.mediaBridge.addIceCandidate(candidate);
    } catch (error) {
      console.error("❌ ICE candidate error:", error.message);
    }
  });

  // ─── WebRTC Connected ─────────────────────────────────────────────────────
  socket.on("webrtc-connected", () => {
    console.log("✅ WebRTC connection established for client:", socket.id);
  });

  // ─── End Voice Session ────────────────────────────────────────────────────
  socket.on("end-voice-session", () => {
    console.log("🛑 Ending voice session for client:", socket.id);

    // ── Agent-proxied path ────────────────────────────────────────────────
    if (VOICE_AGENT_ENDPOINT && socket.agentPcId) {
      callVoiceAgent("disconnect", { pc_id: socket.agentPcId })
        .catch((err) => console.error("❌ Voice agent disconnect failed:", err.message));
      socket.agentPcId = null;
      return;
    }

    // ── Legacy MediaBridge path ───────────────────────────────────────────
    if (socket.mediaBridge) {
      socket.mediaBridge.close();
      socket.mediaBridge = null;
    }

    if (socket.novaProcess) {
      socket.novaProcess.kill();
      socket.novaProcess = null;
    }

    novaReady = false;
  });

  // ─── Audio‑input from client ──────────────────────────────────────────────
  let audioStarted = false;
  socket.on("audio-input", (msg) => {
    console.log(
      "🎤 Received audio-input, size:",
      msg.data ? msg.data.length : "no data",
    );
    if (novaProcess && novaProcess.stdin.writable && novaReady) {
      if (!audioStarted) {
        novaProcess.stdin.write(JSON.stringify({ type: "start_audio" }) + "\n");
        audioStarted = true;
        console.log("🎬 Sent start_audio to Nova process");
      }
      novaProcess.stdin.write(
        JSON.stringify({ type: "audio", data: msg.data }) + "\n",
      );
      console.log("📤 Sent audio to Nova process");
    } else {
      console.log("❌ Cannot send audio - not ready or stdin closed");
    }
  });

  // ─── Text‑input from client ───────────────────────────────────────────────
  socket.on("text-input", (msg) => {
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
    if (novaProcess && novaProcess.stdin.writable && novaReady) {
      novaProcess.stdin.write(JSON.stringify({ type: "end_audio" }) + "\n");
      audioStarted = false;
      console.log("🛑 Sent end_audio to Nova process");
    }
  });

  // ─── Optional Stop event ────────────────────────────────────────────────
  socket.on("stop-nova-sonic", () => {
    console.log("🛑 Stop requested by client");
    if (novaProcess) {
      novaProcess.kill();
      novaProcess = null;
      novaReady = false;
    }
  });

  // ─── Disconnect cleanup ──────────────────────────────────────────────────
  // Socket.IO audio sessions: Nova process is intentionally kept alive across
  // brief disconnects. WebRTC sessions: clean up MediaBridge since the peer
  // connection is no longer usable after disconnect.
  socket.on("disconnect", () => {
    console.log("🔌 CLIENT DISCONNECTED:", socket.id, "- Nova still running");

    // Clean up agent-proxied session if present
    if (VOICE_AGENT_ENDPOINT && socket.agentPcId) {
      callVoiceAgent("disconnect", { pc_id: socket.agentPcId })
        .catch((err) => console.error("❌ Voice agent disconnect on socket close:", err.message));
      socket.agentPcId = null;
    }

    // Clean up WebRTC MediaBridge resources if present
    if (socket.mediaBridge) {
      console.log("🧹 Cleaning up MediaBridge for disconnected client:", socket.id);
      socket.mediaBridge.close();
      socket.mediaBridge = null;
    }
  });
});

// ─── Start HTTP server on port 80 ─────────────────────────────────────────
const PORT = process.env.PORT || 80;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket server running on port ${PORT}`);
});
