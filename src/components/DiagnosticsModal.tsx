import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Volume2,
  Camera,
  Monitor,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
} from 'lucide-react';
import { playTestChime } from '../utils/audio';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverStatus: {
    status: string;
    hasApiKey: boolean;
    defaultModel: string;
    environment?: { platform: string; nodeVersion: string };
  } | null;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  serverStatus,
}) => {
  const [micActive, setMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [screenActive, setScreenActive] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const [isPlayingChime, setIsPlayingChime] = useState(false);
  const [speakerTested, setSpeakerTested] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopAllDiagnostics();
    }
  }, [isOpen]);

  const stopAllDiagnostics = () => {
    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setMicActive(false);
    setMicVolume(0);

    // Stop camera
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);

    // Stop screen
    if (screenRef.current && screenRef.current.srcObject) {
      const stream = screenRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      screenRef.current.srcObject = null;
    }
    setScreenActive(false);
  };

  const testMicrophone = async () => {
    if (micActive) {
      stopAllDiagnostics();
      return;
    }

    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      micCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setMicActive(true);

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setMicVolume(avg);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err: any) {
      console.error('Mic check error:', err);
      setMicError(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied by browser or PC settings.'
          : err?.message || 'Could not access PC microphone.'
      );
      setMicActive(false);
    }
  };

  const testSpeaker = async () => {
    setIsPlayingChime(true);
    await playTestChime();
    setIsPlayingChime(false);
    setSpeakerTested(true);
  };

  const testCamera = async () => {
    if (cameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
      return;
    }

    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied.'
          : err?.message || 'Could not access PC camera.'
      );
    }
  };

  const testScreen = async () => {
    if (screenActive) {
      if (screenRef.current && screenRef.current.srcObject) {
        (screenRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        screenRef.current.srcObject = null;
      }
      setScreenActive(false);
      return;
    }

    setScreenError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 10 },
      });
      if (screenRef.current) {
        screenRef.current.srcObject = stream;
        screenRef.current.play().catch(() => {});
      }
      setScreenActive(true);
      stream.getVideoTracks()[0].onended = () => {
        setScreenActive(false);
      };
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setScreenError(err?.message || 'Screen capture canceled or unsupported.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/90">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-400" />
              PC Hardware & Environment Diagnostics
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Verify your microphone, audio playback, camera, and API connectivity for Gemini Live
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Server / API Status */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  serverStatus?.hasApiKey ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {serverStatus?.hasApiKey ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-semibold text-white text-sm">
                  Gemini Live Server Engine
                </div>
                <div className="text-xs text-slate-400">
                  {serverStatus?.hasApiKey
                    ? `Ready • Live Model: ${serverStatus?.defaultModel || 'gemini-3.8-live'}`
                    : 'API Key missing in environment (Settings > Secrets)'}
                </div>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                serverStatus?.hasApiKey
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {serverStatus?.hasApiKey ? 'API Ready' : 'Key Needed'}
            </span>
          </div>

          {/* Test 1: Microphone */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">
                    PC Microphone Input
                  </div>
                  <div className="text-xs text-slate-400">
                    Captures 16kHz PCM audio for real-time speech input
                  </div>
                </div>
              </div>
              <button
                onClick={testMicrophone}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
                  micActive
                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                }`}
              >
                {micActive ? 'Stop Mic Test' : 'Test Microphone'}
              </button>
            </div>

            {micActive && (
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Input Signal Level:</span>
                  <span className="text-emerald-400 font-semibold">{Math.round(micVolume * 100)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, micVolume * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-emerald-400/90 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Speak into your PC mic — the bar responds to your voice!
                </p>
              </div>
            )}

            {micError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                {micError}
              </div>
            )}
          </div>

          {/* Test 2: Speaker Output */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">
                    PC Audio Playback (Speakers / Headphones)
                  </div>
                  <div className="text-xs text-slate-400">
                    Plays 24kHz PCM synthesis for Gemini Live's natural voice
                  </div>
                </div>
              </div>
              <button
                onClick={testSpeaker}
                disabled={isPlayingChime}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition flex items-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                {isPlayingChime ? 'Playing...' : 'Play Test Chime'}
              </button>
            </div>
            {speakerTested && (
              <p className="text-xs text-slate-400 pt-1">
                Did you hear the 4-tone chime? If not, check your PC sound volume or output device.
              </p>
            )}
          </div>

          {/* Test 3: Camera & Screen Share */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Camera */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-white">Webcam Vision</span>
                </div>
                <button
                  onClick={testCamera}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  {cameraActive ? 'Stop' : 'Test Cam'}
                </button>
              </div>
              <div className="h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                  playsInline
                  muted
                />
                {!cameraActive && (
                  <span className="text-xs text-slate-500">Camera preview inactive</span>
                )}
              </div>
              {cameraError && (
                <p className="text-xs text-rose-400">{cameraError}</p>
              )}
            </div>

            {/* Screen Share */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">Screen Share</span>
                </div>
                <button
                  onClick={testScreen}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  {screenActive ? 'Stop' : 'Test Screen'}
                </button>
              </div>
              <div className="h-32 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                <video
                  ref={screenRef}
                  className={`w-full h-full object-cover ${screenActive ? 'block' : 'hidden'}`}
                  playsInline
                  muted
                />
                {!screenActive && (
                  <span className="text-xs text-slate-500">Screen preview inactive</span>
                )}
              </div>
              {screenError && (
                <p className="text-xs text-rose-400">{screenError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
