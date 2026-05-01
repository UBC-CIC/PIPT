import { useState, useRef, useCallback } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
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

const DEFAULT_SAMPLE_TEXT =
  "Hello, I'm your patient today. I've been having some chest pain for the past few days and I'm a little worried about it.";

type PreviewState = 'idle' | 'connecting' | 'playing' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoicePreview() {
  const [selectedVoice, setSelectedVoice] = useState<string>('amy');
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for cleanup
  const socketRef = useRef<Socket | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clean up socket connection and audio context.
   */
  const cleanup = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
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
  }, []);

  /**
   * Play a base64-encoded 24kHz PCM audio chunk through the AudioContext.
   */
  const playAudioChunk = useCallback((base64Data: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Convert 16-bit signed PCM to float32
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
   * Start a voice preview session — pure TTS, no agent/DB involved.
   */
  const handlePreview = useCallback(async () => {
    if (!sampleText.trim()) return;

    cleanup();
    setPreviewState('connecting');
    setErrorMessage(null);

    try {
      // Create playback context BEFORE any async work so it's within the
      // user-gesture window and won't be auto-suspended by the browser.
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      // Explicitly resume in case the browser still suspends it.
      if (playbackCtxRef.current.state === 'suspended') {
        await playbackCtxRef.current.resume();
      }
      nextPlayTimeRef.current = 0;

      const token = await authService.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const socketUrl = appConfig.socket.url;
      if (!socketUrl) throw new Error('Socket server URL not configured');

      // Connect to Socket.IO
      const socket = io(socketUrl, {
        transports: ['websocket'],
        auth: { token },
      });
      socketRef.current = socket;

      // Listen for audio chunks
      socket.on('audio-chunk', (data: { data: string }) => {
        playAudioChunk(data.data);

        // Reset auto-stop timer on each chunk — stop 3s after last chunk
        if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = setTimeout(() => {
          setPreviewState('idle');
          cleanup();
        }, 3000);
      });

      // TTS process is ready and streaming
      socket.on('voice-preview-ready', () => {
        setPreviewState('playing');
      });

      // TTS process finished
      socket.on('voice-preview-done', () => {
        // Let the last audio chunks finish playing before cleaning up.
        // The auto-stop timer on audio-chunk handles this — if no more
        // chunks arrive within 3s it will clean up automatically.
        // If we never got any audio, clean up now.
        if (!autoStopTimerRef.current) {
          setPreviewState('idle');
          cleanup();
        }
      });

      // Listen for errors
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

      // Send the voice preview request — pure TTS, separate from start-nova-sonic
      socket.emit('voice-preview', {
        voice_id: selectedVoice,
        text: sampleText,
      });

      // Safety timeout — auto-disconnect after 30s max
      autoStopTimerRef.current = setTimeout(() => {
        setPreviewState('idle');
        cleanup();
      }, 30000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start preview');
      setPreviewState('error');
      cleanup();
    }
  }, [selectedVoice, sampleText, cleanup, playAudioChunk]);

  /**
   * Stop the current preview.
   */
  const handleStop = useCallback(() => {
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
          Select a voice to preview how it sounds with your patient personas.
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
                onClick={() => setSelectedVoice(voice.id)}
                className="rounded-lg p-4 text-left transition-all"
                style={{
                  backgroundColor: isSelected ? UI_COLORS.background.tableHeader : UI_COLORS.background.white,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: isSelected ? UI_COLORS.button.primary : UI_COLORS.border.default,
                  cursor: 'pointer',
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

      {/* Sample Text */}
      <div>
        <label className="text-sm font-medium mb-2 block" style={{ color: UI_COLORS.text.heading }}>
          Sample Text
        </label>
        <textarea
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="Enter text for the voice to speak..."
          rows={3}
          className="w-full px-4 py-3 rounded-md resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: UI_COLORS.border.default,
            backgroundColor: UI_COLORS.background.white,
            color: UI_COLORS.text.heading,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {previewState === 'idle' || previewState === 'error' ? (
          <Button
            onClick={handlePreview}
            disabled={!sampleText.trim()}
            className="px-6 gap-2 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            <Play className="w-4 h-4" />
            Preview Voice
          </Button>
        ) : previewState === 'connecting' ? (
          <div className="flex items-center gap-3">
            <LoadingIndicator size="sm" message="Connecting to voice server..." />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Playing animation */}
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
            <Button
              onClick={handleStop}
              variant="outline"
              className="px-4 gap-2"
              style={{ borderColor: UI_COLORS.border.default, color: UI_COLORS.text.heading }}
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm" style={{ color: UI_COLORS.status.error }}>
          {errorMessage}
        </p>
      )}

      {/* Inline keyframes (shared with LoadingIndicator) */}
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
