const {
  RTCPeerConnection,
  RTCIceCandidate,
  MediaStreamTrack,
  RtpPacket,
  RtpHeader,
} = require("werift");
const OpusScript = require("opusscript");

/**
 * Downsample 48 kHz 16-bit mono PCM to 16 kHz 16-bit mono PCM.
 *
 * Uses simple decimation (pick every 3rd sample). This is acceptable
 * because Opus already band-limits the signal before encoding.
 *
 * @param {Buffer} pcm48 — 48 kHz 16-bit LE mono PCM buffer
 * @returns {Buffer} — 16 kHz 16-bit LE mono PCM buffer
 */
function downsampleTo16kHz(pcm48) {
  const sampleCount48 = pcm48.length / 2; // 16-bit = 2 bytes per sample
  const sampleCount16 = Math.floor(sampleCount48 / 3);
  const pcm16 = Buffer.alloc(sampleCount16 * 2);
  for (let i = 0; i < sampleCount16; i++) {
    const srcOffset = i * 3 * 2; // every 3rd sample, 2 bytes each
    pcm16.writeInt16LE(pcm48.readInt16LE(srcOffset), i * 2);
  }
  return pcm16;
}

/**
 * Upsample 24 kHz 16-bit mono PCM to 48 kHz 16-bit mono PCM.
 *
 * Uses linear interpolation (duplicate each sample once) since 48/24 = 2.
 *
 * @param {Buffer} pcm24 — 24 kHz 16-bit LE mono PCM buffer
 * @returns {Buffer} — 48 kHz 16-bit LE mono PCM buffer
 */
function upsampleTo48kHz(pcm24) {
  const sampleCount24 = pcm24.length / 2; // 16-bit = 2 bytes per sample
  const sampleCount48 = sampleCount24 * 2;
  const pcm48 = Buffer.alloc(sampleCount48 * 2);
  for (let i = 0; i < sampleCount24; i++) {
    const sample = pcm24.readInt16LE(i * 2);
    // Duplicate each sample to double the rate
    pcm48.writeInt16LE(sample, i * 2 * 2);
    pcm48.writeInt16LE(sample, (i * 2 + 1) * 2);
  }
  return pcm48;
}

/**
 * MediaBridge — server-side WebRTC termination.
 *
 * Manages a werift RTCPeerConnection that terminates the student's
 * WebRTC session on ECS Fargate.  Handles the inbound audio pipeline
 * (Opus → LPCM → Nova stdin), the outbound audio pipeline
 * (Nova stdout LPCM → Opus → RTP), and peer-connection lifecycle.
 */
class MediaBridge {
  /**
   * @param {Array<{urls: string, username?: string, credential?: string}>} iceServers
   * @param {import("child_process").ChildProcess} novaProcess
   */
  constructor(iceServers, novaProcess) {
    this.novaProcess = novaProcess;
    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers || [],
    });

    this._iceCandidateCallback = null;
    this._connectionStateCallback = null;
    this._novaMessageCallback = null;
    this._audioStarted = false;
    this._opusDecoder = null;
    this._rtpSubscription = null;

    // Outbound audio state
    this._opusEncoder = null;
    this._outboundTrack = null;
    this._outboundSeqNum = 0;
    this._outboundTimestamp = 0;
    this._outboundSsrc = Math.floor(Math.random() * 0xffffffff);
    this._stdoutBuffer = "";

    // Create outbound audio track and add to peer connection
    this._outboundTrack = new MediaStreamTrack({ kind: "audio" });
    this.peerConnection.addTrack(this._outboundTrack);

    // Create Opus encoder for outbound audio: 48 kHz, mono
    this._opusEncoder = new OpusScript(48000, 1, OpusScript.Application.VOIP);

    // Wire up Nova stdout for outbound audio pipeline
    this._setupOutboundAudio();

    // Forward server-side ICE candidates to the registered callback
    this.peerConnection.onIceCandidate.subscribe((candidate) => {
      if (this._iceCandidateCallback && candidate) {
        this._iceCandidateCallback(candidate.toJSON());
      }
    });

    // Forward connection state changes to the registered callback
    this.peerConnection.connectionStateChange.subscribe((state) => {
      if (this._connectionStateCallback) {
        this._connectionStateCallback(state);
      }
    });

    // Listen for incoming audio tracks from the client
    this.peerConnection.onTrack.subscribe((track) => {
      if (track.kind === "audio") {
        this._setupInboundAudio(track);
      }
    });
  }

  /**
   * Set up the inbound audio pipeline for an incoming audio track.
   *
   * Pipeline: RTP Opus → decode to 48 kHz PCM → downsample to 16 kHz →
   *           base64 encode → JSON to Nova stdin
   *
   * @param {import("werift").MediaStreamTrack} track
   */
  _setupInboundAudio(track) {
    // Create Opus decoder: 48 kHz sample rate, mono channel
    this._opusDecoder = new OpusScript(48000, 1, OpusScript.Application.VOIP);

    this._rtpSubscription = track.onReceiveRtp.subscribe((rtpPacket) => {
      try {
        if (!this.novaProcess || !this.novaProcess.stdin.writable) return;

        const opusPayload = rtpPacket.payload;
        if (!opusPayload || opusPayload.length === 0) return;

        // Decode Opus to 48 kHz 16-bit mono PCM
        const pcm48 = this._opusDecoder.decode(opusPayload);

        // Downsample from 48 kHz to 16 kHz
        const pcm16 = downsampleTo16kHz(Buffer.from(pcm48.buffer, pcm48.byteOffset, pcm48.byteLength));

        // Send start_audio on first audio packet
        if (!this._audioStarted) {
          this.novaProcess.stdin.write(
            JSON.stringify({ type: "start_audio" }) + "\n",
          );
          this._audioStarted = true;
        }

        // Base64-encode and write as JSON to Nova stdin
        const base64Data = pcm16.toString("base64");
        this.novaProcess.stdin.write(
          JSON.stringify({ type: "audio", data: base64Data }) + "\n",
        );
      } catch (err) {
        console.error("MediaBridge inbound audio error:", err.message);
      }
    });

    // Poll for track stop since werift doesn't have a dedicated onEnded event
    const stopCheck = setInterval(() => {
      if (track.stopped || track.muted) {
        this._sendEndAudio();
        clearInterval(stopCheck);
      }
    }, 500);

    // Store the interval so we can clean it up on close
    this._stopCheckInterval = stopCheck;
  }

  /**
   * Send end_audio to Nova stdin if audio was previously started.
   */
  _sendEndAudio() {
    if (
      this._audioStarted &&
      this.novaProcess &&
      this.novaProcess.stdin.writable
    ) {
      this.novaProcess.stdin.write(
        JSON.stringify({ type: "end_audio" }) + "\n",
      );
      this._audioStarted = false;
    }
  }

  /**
   * Set up the outbound audio pipeline by listening to Nova stdout.
   *
   * Pipeline: Nova stdout JSON lines → parse → for "audio" type:
   *   decode base64 to 24 kHz LPCM → upsample to 48 kHz → Opus encode → RTP
   *
   * Non-audio messages (text, diagnosis_complete, diagnosis_verdict) are
   * forwarded via the registered _novaMessageCallback so server.js can
   * send them through Socket.IO.
   */
  _setupOutboundAudio() {
    if (!this.novaProcess || !this.novaProcess.stdout) return;

    this.novaProcess.stdout.on("data", (data) => {
      // Buffer incoming data and split on newlines (JSON lines protocol)
      this._stdoutBuffer += data.toString();
      const lines = this._stdoutBuffer.split("\n");
      // Keep the last incomplete line in the buffer
      this._stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "audio") {
            this._processOutboundAudio(parsed.data);
          } else {
            // Forward non-audio messages (text, diagnosis_complete, etc.)
            if (this._novaMessageCallback) {
              this._novaMessageCallback(parsed);
            }
          }
        } catch {
          // Plain-text fallback — forward as-is
          if (this._novaMessageCallback) {
            this._novaMessageCallback({ type: "raw", text: line });
          }
        }
      }
    });
  }

  /**
   * Process a single outbound audio chunk from Nova.
   *
   * @param {string} base64Data — base64-encoded 24 kHz 16-bit mono LPCM
   */
  _processOutboundAudio(base64Data) {
    try {
      if (!this._opusEncoder || !this._outboundTrack) return;

      // Decode base64 to 24 kHz 16-bit mono LPCM
      const pcm24 = Buffer.from(base64Data, "base64");

      // Upsample from 24 kHz to 48 kHz for Opus encoding
      const pcm48 = upsampleTo48kHz(pcm24);

      // Opus frame size: 960 samples at 48 kHz = 20 ms
      const frameSizeSamples = 960;
      const frameSizeBytes = frameSizeSamples * 2; // 16-bit = 2 bytes per sample

      // Process in 20 ms frames
      for (let offset = 0; offset + frameSizeBytes <= pcm48.length; offset += frameSizeBytes) {
        const frame = pcm48.subarray(offset, offset + frameSizeBytes);

        // Encode PCM frame to Opus
        const opusPayload = this._opusEncoder.encode(frame, frameSizeSamples);

        // Build RTP packet
        const header = new RtpHeader({
          payloadType: 111, // Opus dynamic payload type
          sequenceNumber: this._outboundSeqNum & 0xffff,
          timestamp: this._outboundTimestamp & 0xffffffff,
          ssrc: this._outboundSsrc,
          marker: offset === 0, // Mark first packet of a talkspurt
        });

        const rtpPacket = new RtpPacket(header, Buffer.from(opusPayload));

        // Send via the outbound track
        this._outboundTrack.writeRtp(rtpPacket);

        this._outboundSeqNum++;
        this._outboundTimestamp += frameSizeSamples; // 960 samples per 20 ms frame
      }
    } catch (err) {
      console.error("MediaBridge outbound audio error:", err.message);
    }
  }

  /**
   * Register a callback for non-audio Nova stdout messages.
   * These include "text", "diagnosis_complete", "diagnosis_verdict", etc.
   * @param {(message: object) => void} callback
   */
  onNovaMessage(callback) {
    this._novaMessageCallback = callback;
  }

  /**
   * Process an SDP offer from the client, create and return an SDP answer.
   * @param {string} sdpOffer — the SDP offer string from the browser
   * @returns {Promise<{sdpAnswer: string}>}
   */
  async handleOffer(sdpOffer) {
    await this.peerConnection.setRemoteDescription({
      type: "offer",
      sdp: sdpOffer,
    });

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return { sdpAnswer: answer.sdp };
  }

  /**
   * Forward a trickle ICE candidate from the client to the server peer connection.
   * @param {{candidate: string, sdpMid?: string, sdpMLineIndex?: number}} candidate
   */
  async addIceCandidate(candidate) {
    if (!candidate || !candidate.candidate) return;

    const iceCandidate = new RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });

    await this.peerConnection.addIceCandidate(iceCandidate);
  }

  /**
   * Register a callback to receive server-side ICE candidates.
   * @param {(candidate: {candidate: string, sdpMid?: string, sdpMLineIndex?: number}) => void} callback
   */
  onIceCandidate(callback) {
    this._iceCandidateCallback = callback;
  }

  /**
   * Register a callback for connection state transitions.
   * @param {(state: string) => void} callback
   */
  onConnectionStateChange(callback) {
    this._connectionStateCallback = callback;
  }

  /**
   * Tear down the peer connection and release resources.
   */
  close() {
    // Send end_audio if audio was active
    this._sendEndAudio();

    // Clean up the track stop polling interval
    if (this._stopCheckInterval) {
      clearInterval(this._stopCheckInterval);
      this._stopCheckInterval = null;
    }

    // Clean up Opus decoder (inbound)
    if (this._opusDecoder) {
      this._opusDecoder.delete();
      this._opusDecoder = null;
    }

    // Clean up Opus encoder (outbound)
    if (this._opusEncoder) {
      this._opusEncoder.delete();
      this._opusEncoder = null;
    }

    // Clean up outbound track
    if (this._outboundTrack) {
      this._outboundTrack.stop();
      this._outboundTrack = null;
    }

    try {
      this.peerConnection.close();
    } catch (err) {
      console.error("MediaBridge close error:", err.message);
    }
    this._iceCandidateCallback = null;
    this._connectionStateCallback = null;
    this._novaMessageCallback = null;
    this.novaProcess = null;
  }
}

module.exports = { MediaBridge, downsampleTo16kHz, upsampleTo48kHz };
