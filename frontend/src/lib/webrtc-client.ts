/**
 * WebRTC Voice Chat Client
 *
 * Manages RTCPeerConnection lifecycle for student-to-AI-persona voice chat.
 * Uses Socket.IO as the signaling channel for SDP offer/answer and ICE candidate exchange.
 *
 * State machine: idle → connecting → active → disconnected | error
 */

// Socket.IO client type — imported as a type-only reference.
// The actual Socket instance is provided by the consumer at construction time.
// If socket.io-client is not yet installed, this type falls back to a minimal interface.
interface SocketLike {
  emit(event: string, ...args: unknown[]): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener?: (...args: unknown[]) => void): void;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type VoiceSessionState = 'idle' | 'connecting' | 'active' | 'disconnected' | 'error';

/**
 * Error codes emitted by WebRTCClient so the UI can differentiate
 * between timeout errors, connection failures, and other issues
 * without parsing error message strings.
 */
export type WebRTCErrorCode =
  | 'CONNECTION_FAILED'       // RTCPeerConnection.connectionState went to "failed"
  | 'CONNECTION_TIMEOUT'      // disconnected state exceeded 10-second grace period
  | 'SIGNALING_TIMEOUT'       // SDP answer not received within 10 seconds
  | 'ICE_SERVER_TIMEOUT'      // ICE server config not received within 10 seconds
  | 'ICE_NEGOTIATION_FAILED'  // ICE negotiation failed with no TURN relay
  | 'UNKNOWN';                // catch-all for unexpected errors

export class WebRTCError extends Error {
  public readonly code: WebRTCErrorCode;

  constructor(code: WebRTCErrorCode, message: string) {
    super(message);
    this.name = 'WebRTCError';
    this.code = code;
  }
}

export interface WebRTCClientConfig {
  /** The Socket.IO connection used for signaling. */
  socket: SocketLike;
  /** Initial ICE servers (may be overridden by server-sent `ice-servers` event). */
  iceServers: RTCIceServer[];
  /** Called whenever the session state changes. */
  onStateChange: (state: VoiceSessionState) => void;
  /** Called when a remote audio track is received from the Media_Bridge. */
  onRemoteTrack: (track: MediaStreamTrack) => void;
  /** Called on any error during the session. */
  onError: (error: Error) => void;
  /**
   * Called when ICE negotiation fails after 15 seconds and no TURN relay is available.
   * The consumer should switch to Socket.IO audio transport when this fires.
   */
  onFallbackToSocketIO?: () => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class WebRTCClient {
  private config: WebRTCClientConfig;
  private state: VoiceSessionState = 'idle';
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private muted = false;

  /** Timeout id for the 10-second connection failure watchdog. */
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Timeout id for the 15-second ICE negotiation failure watchdog. */
  private iceNegotiationTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Bound listener references so we can remove them on disconnect.
  private boundOnIceServers: ((data: { iceServers: RTCIceServer[] }) => void) | null = null;
  private boundOnWebRTCAnswer: ((data: { sdp: RTCSessionDescriptionInit }) => void) | null = null;
  private boundOnRemoteIceCandidate: ((data: { candidate: RTCIceCandidateInit }) => void) | null = null;

  constructor(config: WebRTCClientConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start a WebRTC voice session.
   *
   * 1. Set state → connecting
   * 2. Capture mono microphone audio via getUserMedia
   * 3. Emit `start-voice-session` so the server spawns Nova Sonic
   * 4. Wait for `ice-servers` from the server
   * 5. Create RTCPeerConnection with the received ICE servers
   * 6. Add local audio track
   * 7. Wire ontrack / onicecandidate / connectionstatechange
   * 8. Create SDP offer → send via `webrtc-offer`
   * 9. Wait for `webrtc-answer` → set remote description
   * 10. Relay ICE candidates bidirectionally
   * 11. When connectionState === 'connected' → emit `webrtc-connected`, state → active
   */
  async connect(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot connect: current state is "${this.state}"`);
    }

    this.setState('connecting');

    try {
      // 1. Capture local mono audio
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });

      // 2. Wait for ICE servers from the server
      const iceServers = await this.requestIceServers();

      // 3. Create peer connection
      this.peerConnection = new RTCPeerConnection({ iceServers });

      // 4. Add local audio track
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.peerConnection.addTrack(audioTrack, this.localStream);
      }

      // 5. Handle remote audio track
      this.peerConnection.ontrack = (event) => {
        const remoteTrack = event.track;
        if (remoteTrack.kind === 'audio') {
          this.config.onRemoteTrack(remoteTrack);
        }
      };

      // 6. Relay local ICE candidates to the server
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.config.socket.emit('webrtc-ice-candidate', {
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // 7. Monitor connection state
      this.peerConnection.onconnectionstatechange = () => {
        this.handleConnectionStateChange();
      };

      // 7a. Monitor ICE connection state for granular ICE failure detection
      this.peerConnection.oniceconnectionstatechange = () => {
        this.handleIceConnectionStateChange();
      };

      // 8. Listen for remote ICE candidates from the server
      this.boundOnRemoteIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
        if (this.peerConnection && data.candidate) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) => {
            console.warn('[WebRTCClient] Failed to add remote ICE candidate:', err);
          });
        }
      };
      this.config.socket.on('webrtc-ice-candidate', this.boundOnRemoteIceCandidate as (...args: unknown[]) => void);

      // 9. Create SDP offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // 10. Send offer and wait for answer
      const answer = await this.requestAnswer(offer);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      // 11. Start the 10-second connection watchdog
      this.startConnectionTimeout();

      // 12. Start the 15-second ICE negotiation watchdog (triggers Socket.IO fallback)
      this.startIceNegotiationTimeout();
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * End the voice session — close peer connection, stop local tracks,
   * and notify the server.
   */
  disconnect(): void {
    this.cleanup();
    this.config.socket.emit('end-voice-session', {});
    this.setState('disconnected');
  }

  /** Mute the local microphone (sets track.enabled = false). */
  mute(): void {
    this.setTrackEnabled(false);
    this.muted = true;
  }

  /** Unmute the local microphone (sets track.enabled = true). */
  unmute(): void {
    this.setTrackEnabled(true);
    this.muted = false;
  }

  /** Returns true if the local microphone is muted. */
  isMuted(): boolean {
    return this.muted;
  }

  /** Returns the current session state. */
  getState(): VoiceSessionState {
    return this.state;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Emit `start-voice-session` and wait for the server to respond with
   * ICE server configuration via the `ice-servers` event.
   */
  private requestIceServers(): Promise<RTCIceServer[]> {
    return new Promise<RTCIceServer[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.config.socket.off('ice-servers', handler as (...args: unknown[]) => void);
        reject(new WebRTCError('ICE_SERVER_TIMEOUT', 'Timed out waiting for ICE server configuration'));
      }, 10_000);

      const handler = (data: { iceServers: RTCIceServer[] }) => {
        clearTimeout(timeout);
        this.config.socket.off('ice-servers', handler as (...args: unknown[]) => void);
        resolve(data.iceServers ?? this.config.iceServers);
      };

      this.boundOnIceServers = handler;
      this.config.socket.on('ice-servers', handler as (...args: unknown[]) => void);

      // Tell the server to start the voice session (spawns Nova Sonic, creates MediaBridge)
      this.config.socket.emit('start-voice-session', {});
    });
  }

  /**
   * Send the SDP offer to the server and wait for the SDP answer.
   */
  private requestAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    return new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.config.socket.off('webrtc-answer', handler as (...args: unknown[]) => void);
        reject(new WebRTCError('SIGNALING_TIMEOUT', 'Timed out waiting for SDP answer'));
      }, 10_000);

      const handler = (data: { sdp: RTCSessionDescriptionInit }) => {
        clearTimeout(timeout);
        this.config.socket.off('webrtc-answer', handler as (...args: unknown[]) => void);
        resolve(data.sdp);
      };

      this.boundOnWebRTCAnswer = handler;
      this.config.socket.on('webrtc-answer', handler as (...args: unknown[]) => void);

      this.config.socket.emit('webrtc-offer', { sdp: offer });
    });
  }

  /**
   * React to RTCPeerConnection.connectionState changes.
   */
  private handleConnectionStateChange(): void {
    if (!this.peerConnection) return;

    const connState = this.peerConnection.connectionState;

    switch (connState) {
      case 'connected':
        this.clearConnectionTimeout();
        this.clearIceNegotiationTimeout();
        this.config.socket.emit('webrtc-connected', {});
        this.setState('active');
        break;

      case 'failed':
        this.handleError(new WebRTCError('CONNECTION_FAILED', 'WebRTC connection failed'));
        break;

      case 'disconnected':
        // Start a 10-second grace period — the connection may recover.
        this.startConnectionTimeout();
        break;

      case 'closed':
        if (this.state === 'active' || this.state === 'connecting') {
          this.setState('disconnected');
        }
        break;
    }
  }

  /**
   * React to RTCPeerConnection.iceConnectionState changes.
   * Provides more granular ICE-specific failure detection than connectionState alone.
   */
  private handleIceConnectionStateChange(): void {
    if (!this.peerConnection) return;

    const iceState = this.peerConnection.iceConnectionState;

    switch (iceState) {
      case 'connected':
      case 'completed':
        // ICE negotiation succeeded — cancel the 15-second fallback timer.
        this.clearIceNegotiationTimeout();
        break;

      case 'failed':
        // ICE negotiation failed outright — trigger fallback immediately.
        this.clearIceNegotiationTimeout();
        this.triggerSocketIOFallback();
        break;

      case 'disconnected':
        // ICE connectivity lost — the 15-second timer (if still running) will handle fallback.
        break;
    }
  }

  /**
   * Start (or restart) the 10-second watchdog timer.
   * If the connection doesn't reach "connected" within the window,
   * the session is ended with an error.
   */
  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeoutId = setTimeout(() => {
      if (this.state === 'connecting' || this.state === 'active') {
        this.handleError(new WebRTCError('CONNECTION_TIMEOUT', 'WebRTC connection timed out'));
      }
    }, 10_000);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId !== null) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  /**
   * Start the 15-second ICE negotiation watchdog.
   * If ICE doesn't reach "connected" or "completed" within 15 seconds,
   * trigger Socket.IO fallback (Requirement 10.2).
   */
  private startIceNegotiationTimeout(): void {
    this.clearIceNegotiationTimeout();
    this.iceNegotiationTimeoutId = setTimeout(() => {
      if (this.state === 'connecting') {
        this.triggerSocketIOFallback();
      }
    }, 15_000);
  }

  private clearIceNegotiationTimeout(): void {
    if (this.iceNegotiationTimeoutId !== null) {
      clearTimeout(this.iceNegotiationTimeoutId);
      this.iceNegotiationTimeoutId = null;
    }
  }

  /**
   * Clean up the WebRTC session and invoke the Socket.IO fallback callback.
   * Called when ICE negotiation fails after 15 seconds or ICE state goes to "failed".
   */
  private triggerSocketIOFallback(): void {
    this.cleanup();

    if (this.config.onFallbackToSocketIO) {
      this.setState('disconnected');
      this.config.onFallbackToSocketIO();
    } else {
      // No fallback handler registered — treat as a connection error.
      this.handleError(new WebRTCError('ICE_NEGOTIATION_FAILED', 'ICE negotiation failed and no TURN relay available'));
    }
  }

  /**
   * Toggle the enabled state of the local audio track.
   */
  private setTrackEnabled(enabled: boolean): void {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  /**
   * Transition to the error state, notify the consumer, and clean up.
   */
  private handleError(error: Error): void {
    this.cleanup();
    this.setState('error');
    // Wrap plain Errors with an UNKNOWN code so the consumer always gets a WebRTCError.
    const webrtcError =
      error instanceof WebRTCError ? error : new WebRTCError('UNKNOWN', error.message);
    this.config.onError(webrtcError);
  }

  /**
   * Update the session state and notify the consumer.
   */
  private setState(next: VoiceSessionState): void {
    if (this.state === next) return;
    this.state = next;
    this.config.onStateChange(next);
  }

  /**
   * Release all resources — peer connection, local media, Socket.IO listeners, timers.
   */
  private cleanup(): void {
    this.clearConnectionTimeout();
    this.clearIceNegotiationTimeout();

    // Remove Socket.IO listeners
    if (this.boundOnIceServers) {
      this.config.socket.off('ice-servers', this.boundOnIceServers as (...args: unknown[]) => void);
      this.boundOnIceServers = null;
    }
    if (this.boundOnWebRTCAnswer) {
      this.config.socket.off('webrtc-answer', this.boundOnWebRTCAnswer as (...args: unknown[]) => void);
      this.boundOnWebRTCAnswer = null;
    }
    if (this.boundOnRemoteIceCandidate) {
      this.config.socket.off('webrtc-ice-candidate', this.boundOnRemoteIceCandidate as (...args: unknown[]) => void);
      this.boundOnRemoteIceCandidate = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local media tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }
}


// ---------------------------------------------------------------------------
// Audio playback utility
// ---------------------------------------------------------------------------

/**
 * Play a remote audio track using an <audio> element.
 * Creates a hidden <audio> element, attaches the track via MediaStream,
 * and starts playback. Returns a cleanup function to stop playback.
 *
 * Must be called from a user gesture context (e.g., button click handler)
 * to satisfy browser autoplay restrictions.
 *
 * @param track - The remote MediaStreamTrack received via onRemoteTrack callback.
 * @returns A cleanup function that stops playback and removes the element from the DOM.
 */
export function playRemoteAudioTrack(track: MediaStreamTrack): () => void {
  const audio = document.createElement('audio');
  audio.srcObject = new MediaStream([track]);
  audio.autoplay = true;
  // Append to DOM to ensure playback works in all browsers
  audio.style.display = 'none';
  document.body.appendChild(audio);

  audio.play().catch((err) => {
    console.warn('[WebRTCClient] Audio autoplay blocked:', err);
  });

  // Return cleanup function
  return () => {
    audio.pause();
    audio.srcObject = null;
    audio.remove();
  };
}


// ---------------------------------------------------------------------------
// WebRTC support detection
// ---------------------------------------------------------------------------

/**
 * Check whether the current browser supports WebRTC.
 * Returns false if RTCPeerConnection is not available,
 * indicating the consumer should use Socket.IO audio transport instead.
 *
 * Validates: Requirements 10.1
 */
export function isWebRTCSupported(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}
