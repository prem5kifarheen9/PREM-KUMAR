/**
 * Audio processing utilities for Gemini Live API
 * - Input: 16kHz 16-bit Linear PCM Little-Endian
 * - Output: 24kHz 16-bit Linear PCM Little-Endian playback
 */

// Downsample Float32Array audio buffer to 16000Hz PCM Int16
export function downsampleAndConvertToInt16(
  buffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): Int16Array {
  if (inputSampleRate === targetSampleRate) {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  }

  const sampleRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / sampleRatio);
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRatio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    const val = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, val));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

// Convert Int16Array buffer to Base64 string
export function int16ToBase64(int16Array: Int16Array): string {
  const uint8 = new Uint8Array(
    int16Array.buffer,
    int16Array.byteOffset,
    int16Array.byteLength
  );
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// Convert Base64 string from Gemini Live to 24kHz AudioBuffer for gapless playback
export function base64ToAudioBuffer(
  base64: string,
  audioCtx: AudioContext,
  sampleRate = 24000
): AudioBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 16-bit PCM little-endian
  const int16 = new Int16Array(bytes.buffer);
  const audioBuffer = audioCtx.createBuffer(1, int16.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768.0;
  }

  return audioBuffer;
}

/**
 * Audio Queue Player for gapless streaming 24kHz audio playback
 */
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private gainNode: GainNode | null = null;
  private volume = 1.0;
  public onPlayStateChange?: (isPlaying: boolean) => void;
  public onVolumeUpdate?: (rms: number) => void;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.audioCtx) {
      // Gemini Live models stream at 24000Hz
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.volume;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;

      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.startAnalyserLoop();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  public enqueueChunk(base64Data: string) {
    this.initContext();
    if (!this.audioCtx || !this.gainNode) return;

    try {
      const audioBuffer = base64ToAudioBuffer(base64Data, this.audioCtx, 24000);
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      const currentTime = this.audioCtx.currentTime;
      // If queue fell behind current time, reset nextStartTime with a tiny 20ms cushion
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02;
      }

      source.start(this.nextStartTime);
      this.activeSources.push(source);
      this.nextStartTime += audioBuffer.duration;

      this.onPlayStateChange?.(true);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          this.onPlayStateChange?.(false);
        }
      };
    } catch (err) {
      console.error('Failed to play audio chunk:', err);
    }
  }

  public interrupt() {
    // Stop all queued chunks immediately when user speaks or interrupted
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // already stopped
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    this.onPlayStateChange?.(false);
  }

  private startAnalyserLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVolume = () => {
      if (this.analyser && this.activeSources.length > 0) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        this.onVolumeUpdate?.(avg);
      } else {
        this.onVolumeUpdate?.(0);
      }
      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  public getAnalyser(): AnalyserNode | null {
    this.initContext();
    return this.analyser;
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.interrupt();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
  }
}

// Play pleasant test tone for PC speaker verification
export function playTestChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.5);
      });

      setTimeout(() => {
        ctx.close();
        resolve();
      }, 1000);
    } catch (e) {
      resolve();
    }
  });
}
