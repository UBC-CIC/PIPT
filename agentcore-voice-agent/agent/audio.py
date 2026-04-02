"""Audio conversion and output track for WebRTC <-> Nova Sonic.

Nova Sonic expects 16kHz/16-bit/mono PCM input and produces 24kHz/16-bit/mono
PCM output. This module handles the format conversions and provides a WebRTC
audio track that streams Nova Sonic responses back to the browser.
"""

import asyncio
import fractions
import logging
import time

import av
from aiortc.mediastreams import AudioFrame, MediaStreamTrack

logger = logging.getLogger(__name__)

# Audio format constants
INPUT_SAMPLE_RATE = 16000  # What Nova Sonic expects
OUTPUT_SAMPLE_RATE = 24000  # What Nova Sonic produces
BYTES_PER_SAMPLE = 2  # 16-bit PCM
FRAME_DURATION_MS = 20  # WebRTC frame size
SAMPLES_PER_FRAME = OUTPUT_SAMPLE_RATE * FRAME_DURATION_MS // 1000  # 480
SILENCE_BYTES = bytes(SAMPLES_PER_FRAME * BYTES_PER_SAMPLE)


def _make_silence(pts, time_base):
    """Create a fresh silence frame with correct timestamps."""
    frame = AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_FRAME)
    frame.sample_rate = OUTPUT_SAMPLE_RATE
    frame.planes[0].update(SILENCE_BYTES)
    frame.pts = pts
    frame.time_base = time_base
    return frame


def create_resampler():
    """Create a fresh resampler instance — must be per-session, not global."""
    return av.AudioResampler(format="s16", layout="mono", rate=INPUT_SAMPLE_RATE)


class InputResampler:
    """Per-session audio resampler for WebRTC input → Nova Sonic format.

    The av.AudioResampler is stateful — reusing a single global instance
    across sessions corrupts the audio stream. Each voice session must
    create its own InputResampler.
    """

    def __init__(self):
        self._resampler = av.AudioResampler(
            format="s16", layout="mono", rate=INPUT_SAMPLE_RATE
        )
        self._format_logged = False

    def convert(self, frame):
        """Convert a WebRTC audio frame to 16kHz/16-bit/mono PCM bytes."""
        if not self._format_logged:
            logger.info(
                f"Input audio: rate={frame.sample_rate} "
                f"channels={len(frame.layout.channels)} "
                f"format={frame.format.name} samples={frame.samples}"
            )
            self._format_logged = True
        resampled = self._resampler.resample(frame)
        return b"".join(f.planes[0] for f in resampled) if resampled else b""


class OutputTrack(MediaStreamTrack):
    """WebRTC audio track that plays Nova Sonic responses to the browser.

    Audio bytes are queued via add_audio() into an av.AudioFifo, which
    handles chunking into exact frame sizes. recv() reads fixed-size
    frames paced to real-time, returning silence when the buffer is empty.

    A small jitter buffer (100ms) absorbs network timing variations to
    reduce crackling from gaps between audio chunk arrivals.
    """

    kind = "audio"
    JITTER_BUFFER_FRAMES = 5  # 100ms at 20ms per frame

    def __init__(self):
        super().__init__()
        self._fifo = av.AudioFifo()
        self._start_time = None
        self._timestamp = 0
        self._frame_count = 0
        self._muted = False
        self._buffering = True
        self._total_samples_written = 0
        self._time_base = fractions.Fraction(1, OUTPUT_SAMPLE_RATE)

    async def recv(self):
        """Return the next 20ms audio frame, paced to real-time."""
        if self._start_time is None:
            self._start_time = time.time()

        # Pace to real-time
        target = self._start_time + self._frame_count * (FRAME_DURATION_MS / 1000)
        delay = target - time.time()
        if delay > 0:
            await asyncio.sleep(delay)

        # Decide what to play
        if self._muted:
            frame = _make_silence(self._timestamp, self._time_base)
        elif self._buffering:
            if self._total_samples_written >= SAMPLES_PER_FRAME * self.JITTER_BUFFER_FRAMES:
                self._buffering = False
                frame = self._fifo.read(SAMPLES_PER_FRAME, partial=False)
                if frame is None:
                    frame = _make_silence(self._timestamp, self._time_base)
            else:
                frame = _make_silence(self._timestamp, self._time_base)
        else:
            frame = self._fifo.read(SAMPLES_PER_FRAME, partial=False)
            if frame is None:
                frame = _make_silence(self._timestamp, self._time_base)

        frame.pts = self._timestamp
        frame.time_base = self._time_base
        self._timestamp += SAMPLES_PER_FRAME
        self._frame_count += 1
        return frame

    def clear(self):
        """Stop playback and discard all buffered audio (barge-in)."""
        self._muted = True
        self._buffering = True
        self._total_samples_written = 0
        self._fifo = av.AudioFifo()

    def add_audio(self, audio_bytes):
        """Buffer PCM bytes from Nova Sonic. AudioFifo handles chunking."""
        self._muted = False
        num_samples = len(audio_bytes) // BYTES_PER_SAMPLE
        frame = AudioFrame(format="s16", layout="mono", samples=num_samples)
        frame.planes[0].update(audio_bytes)
        frame.sample_rate = OUTPUT_SAMPLE_RATE
        self._fifo.write(frame)
        self._total_samples_written += num_samples
