import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UI_COLORS } from '@/lib/colors';
import { authService } from '@/lib/auth';
import LoadingIndicator from '@/components/LoadingIndicator';
import { io, type Socket } from 'socket.io-client';
import { appConfig } from '@/config/aws-config';

// ---------------------------------------------------------------------------
// Available Nova Sonic voices
// ---------------------------------------------------------------------------

interface VoiceOption {
  id: string;
  name: string;
  gender: 'Feminine' | 'Masculine';
}

const VOICES: VoiceOption[] = [
  { id: 'amy', name: 'Amy', gender: 'Feminine' },
  { id: 'tiffany', name: 'Tiffany', gender: 'Feminine' },
  { id: 'lupe', name: 'Lupe', gender: 'Feminine' },
  { id: 'matthew', name: 'Matthew', gender: 'Masculine' },
  { id: 'carlos', name: 'Carlos', gender: 'Masculine' },
];

type PreviewState = 'idle' | 'connecting' | 'ready' | 'recording' | 'playing' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoicePreview() {
  const [selectedVoice, setSelectedVoice] = useState<string>('amy');
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for cleanup
  const socketRef = useRef<Socket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Stop mic recording and release resources.
   */
  const stopMic = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
  }, []);

  /**
   * Full cleanup — socket, audio contexts, mic.
   */
  const cleanup = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    stopMic();
    if (socketRef.current) {
      socketRef.current.emit('stop-voice-preview', {});
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  }, [stopMic]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  /**
   * Play a base64-encoded 24kHz PCM audio chunk through the AudioContext.
   */
  const playAudioChunk = useCallback((base64Data: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
  }, []);

  /**
   * Connect to the socket server and start a voice preview session.
   * The session stays open so the instructor can tap the mic to speak.
   */
  const handleConnect = useCallback(async () => {
    cleanup();
    setPreviewState('connecting');
    setErrorMessage(null);

    try {
      // Create playback context within user gesture
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      if (playbackCtxRef.current.state === 'suspended') {
        await playbackCtxRef.current.resume();
      }
      nextPlayTimeRef.current = 0;

      const token = await authService.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const socketUrl = appConfig.socket.url;
      if (!socketUrl) throw new Error('Socket server URL not configured');

      const socket = io(socketUrl, {
        transports: ['websocket'],
        auth: { token },
      });
      socketRef.current = socket;

      socket.on('audio-chunk', (data: { data: string }) => {
        setPreviewState('playing');
        playAudioChunk(data.data);

        // Auto-return to ready state 2s after last audio chunk
        if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = setTimeout(() => {
          setPreviewState('ready');
        }, 2000);
      });

      socket.on('voice-preview-ready', () => {
        setPreviewState('ready');
      });

      socket.on('voice-preview-done', () => {
        // Session ended (one exchange complete) — go back to idle
        setPreviewState('idle');
        cleanup();
      });

      socket.on('nova-error', (data: { error: string }) => {
        setErrorMessage(data.error);
        setPreviewState('error');
        cleanup();
      });

      socket.on('connect_error', (err: Error) => {
        setErrorMessage(err.message || 'Failed to connect to voice server');
        setPreviewState('error');
        cleanup();
      });

      socket.emit('voice-preview', { voice_id: selectedVoice });

      // Safety timeout — 60s max session
      autoStopTimerRef.current = setTimeout(() => {
        setPreviewState('idle');
        cleanup();
      }, 60000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start preview');
      setPreviewState('error');
      cleanup();
    }
  }, [selectedVoice, cleanup, playAudioChunk]);

  /**
   * Start recording from the mic and streaming audio to the server.
   */
  const handleStartRecording = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      // Create an AudioContext at 16kHz for mic capture
      const micCtx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = micCtx;

      // Use a ScriptProcessor as a simple fallback for PCM capture
      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);

      // Tell the server we're starting audio
      socket.emit('voice-preview-start-audio');
      setPreviewState('recording');

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert float32 to 16-bit PCM
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(int16.buffer))
        );
        socket.emit('voice-preview-audio', { data: base64 });
      };

      source.connect(processor);
      processor.connect(micCtx.destination);

      // Store processor ref for cleanup (reuse workletNodeRef)
      workletNodeRef.current = processor as unknown as AudioWorkletNode;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Microphone access denied'
      );
      setPreviewState('error');
    }
  }, []);

  /**
   * Stop recording and wait for the model's response.
   */
  const handleStopRecording = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('voice-preview-end-audio');
    }
    stopMic();
    setPreviewState('ready');
  }, [stopMic]);

  /**
   * Disconnect the session entirely.
   */
  const handleDisconnect = useCallback(() => {
    cleanup();
    setPreviewState('idle');
  }, [cleanup]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: UI_COLORS.text.heading }}>
          Voice Preview
        </h2>
        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>
          Select a voice, connect, then tap the mic and say hello to hear how it sounds.
        </p>
      </div>

      {/* Voice Selection Grid */}
      <div>
        <label className="text-sm font-medium mb-3 block" style={{ color: UI_COLORS.text.heading }}>
          Select Voice
        </label>
        <div className="grid grid-cols-3 gap-3">
          {VOICES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            return (
              <button
                key={voice.id}
                onClick={() => {
                  if (previewState === 'idle' || previewState === 'error') {
                    setSelectedVoice(voice.id);
                  }
                }}
                disabled={previewState !== 'idle' && previewState !== 'error'}
                className="rounded-lg p-4 text-left transition-all"
                style={{
                  backgroundColor: isSelected ? UI_COLORS.background.tableHeader : UI_COLORS.background.white,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: isSelected ? UI_COLORS.button.primary : UI_COLORS.border.default,
                  cursor: previewState === 'idle' || previewState === 'error' ? 'pointer' : 'default',
                  opacity: previewState !== 'idle' && previewState !== 'error' && !isSelected ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isSelected ? UI_COLORS.button.primary : UI_COLORS.border.light,
                    }}
                  >
                    <Volume2
                      className="w-5 h-5"
                      style={{ color: isSelected ? '#fff' : UI_COLORS.text.muted }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: UI_COLORS.text.heading }}>
                      {voice.name}
                    </p>
                    <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
                      {voice.gender}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {previewState === 'idle' || previewState === 'error' ? (
          <Button
            onClick={handleConnect}
            className="px-6 gap-2 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            <Volume2 className="w-4 h-4" />
            Connect
          </Button>
        ) : previewState === 'connecting' ? (
          <LoadingIndicator size="sm" message="Connecting to voice server..." />
        ) : previewState === 'ready' ? (
          <div className="flex items-center gap-4">
            <Button
              onClick={handleStartRecording}
              className="px-6 gap-2 transition-colors"
              style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
            >
              <Mic className="w-4 h-4" />
              Hold to Speak
            </Button>
            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="px-4 gap-2"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              <Square className="w-4 h-4" />
              Disconnect
            </Button>
            <span className="text-sm" style={{ color: UI_COLORS.text.muted }}>
              Say hello and listen to the response
            </span>
          </div>
        ) : previewState === 'recording' ? (
          <div className="flex items-center gap-4">
            <Button
              onClick={handleStopRecording}
              className="px-6 gap-2 transition-colors animate-pulse"
              style={{ backgroundColor: UI_COLORS.status.error, color: '#fff' }}
            >
              <Mic className="w-4 h-4" />
              Recording — Click to Stop
            </Button>
            <div className="flex items-end gap-1">
              {[14, 22, 16, 26, 18].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    backgroundColor: UI_COLORS.status.error,
                    height: `${h}px`,
                    animation: `loadingPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : previewState === 'playing' ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1">
                {[14, 22, 16, 26, 18].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full"
                    style={{
                      backgroundColor: UI_COLORS.button.primary,
                      height: `${h}px`,
                      animation: `loadingPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span className="text-sm font-medium" style={{ color: UI_COLORS.text.body }}>
                Playing — {VOICES.find((v) => v.id === selectedVoice)?.name}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm" style={{ color: UI_COLORS.status.error }}>
          {errorMessage}
        </p>
      )}

      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
