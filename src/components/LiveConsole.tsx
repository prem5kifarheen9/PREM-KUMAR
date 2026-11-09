import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Settings2,
  Send,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Eye,
  Trash2,
} from 'lucide-react';
import { LiveOrb } from './LiveOrb';
import { AudioWaveform } from './AudioWaveform';
import {
  downsampleAndConvertToInt16,
  int16ToBase64,
  LiveAudioPlayer,
} from '../utils/audio';

interface TranscriptItem {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: string;
}

const PRESET_PERSONAS = [
  {
    name: 'PC Tech & Copilot',
    instruction:
      'You are Gemini Live running natively on this PC. You specialize in computer troubleshooting, performance optimization, workflow automation, and general tech assistance. Keep spoken answers concise, direct, and conversational.',
  },
  {
    name: 'General Conversationalist',
    instruction:
      'You are Gemini Live, a friendly, witty, and engaging voice assistant on PC. Speak naturally, keep answers concise, and interact as a human conversation partner.',
  },
  {
    name: 'Coding & Architecture Coach',
    instruction:
      'You are an interactive senior software architect on this PC. Review screen shares of code, explain bugs, and recommend clean patterns concisely.',
  },
];

export const LiveConsole: React.FC<{
  onOpenDiagnostics: () => void;
  serverStatus: any;
}> = ({ onOpenDiagnostics, serverStatus }) => {
  // Session State
  const [sessionState, setSessionState] = useState<
    'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings
  const [voice, setVoice] = useState<string>('Puck');
  const [model, setModel] = useState<string>('gemini-3.8-live');
  const [systemInstruction, setSystemInstruction] = useState<string>(
    PRESET_PERSONAS[0].instruction
  );
  const [showSettings, setShowSettings] = useState(false);

  // Audio / Media toggles
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScreenActive, setIsScreenActive] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Audio levels for visualization
  const [userVolume, setUserVolume] = useState(0);
  const [modelVolume, setModelVolume] = useState(0);

  // Transcripts
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentInterimUserText, setCurrentInterimUserText] = useState('');
  const [currentInterimModelText, setCurrentInterimModelText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // Latency & stats
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [activeDuration, setActiveDuration] = useState('00:00');

  // Refs for WebSocket, Web Audio, Video
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  // Timer loop for active session duration
  useEffect(() => {
    let interval: number;
    if (sessionState !== 'idle' && sessionStartTime) {
      interval = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        setActiveDuration(`${mins}:${secs}`);
      }, 1000);
    } else {
      setActiveDuration('00:00');
    }
    return () => clearInterval(interval);
  }, [sessionState, sessionStartTime]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, currentInterimUserText, currentInterimModelText]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  // Initialize Audio Player
  useEffect(() => {
    playerRef.current = new LiveAudioPlayer();
    playerRef.current.onPlayStateChange = (isPlaying) => {
      setSessionState((prev) => {
        if (prev === 'idle' || prev === 'connecting' || prev === 'error') return prev;
        return isPlaying ? 'speaking' : 'listening';
      });
    };
    playerRef.current.onVolumeUpdate = (vol) => {
      setModelVolume(vol);
    };

    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  const startSession = async () => {
    setErrorMessage(null);
    setSessionState('connecting');
    setSessionStartTime(Date.now());

    try {
      // 1. Setup Audio Input
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      const sourceNode = audioCtx.createMediaStreamSource(micStream);
      // ScriptProcessorNode buffer size: 2048 or 4096 gives ~40-80ms frames
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMicMuted) {
          setUserVolume(0);
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Compute RMS volume for live visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        setUserVolume(Math.min(1, rms * 5));

        // Downsample to 16kHz Int16 PCM Little Endian
        const int16Data = downsampleAndConvertToInt16(
          inputChannel,
          audioCtx.sampleRate,
          16000
        );
        const base64Audio = int16ToBase64(int16Data);

        // Send over WebSocket if connected
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Audio,
            })
          );
        }
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);

      // 2. Establish WebSocket connection to backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send session initialization
        ws.send(
          JSON.stringify({
            type: 'start',
            model,
            voice,
            systemInstruction,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setSessionState('listening');
          } else if (msg.type === 'audio' && msg.audio) {
            playerRef.current?.enqueueChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            playerRef.current?.interrupt();
            setSessionState('listening');
          } else if (msg.type === 'user_transcript' && msg.text) {
            setCurrentInterimUserText((prev) => prev + ' ' + msg.text);
          } else if (msg.type === 'model_transcript' && msg.text) {
            setCurrentInterimModelText((prev) => prev + msg.text);
          } else if (msg.type === 'turn_complete') {
            // Commit transcripts to history
            finalizeTurn();
          } else if (msg.type === 'error') {
            console.error('Live session server error:', msg.error);
            setErrorMessage(msg.error);
            setSessionState('error');
          } else if (msg.type === 'session_closed') {
            stopSession();
          }
        } catch (e) {
          console.error('Error parsing live WS message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setErrorMessage('Failed to connect to Live API WebSocket.');
        setSessionState('error');
      };

      ws.onclose = () => {
        if (sessionState !== 'idle' && sessionState !== 'error') {
          setSessionState('idle');
        }
      };

      // Start Video snapshot sender (1 FPS)
      startVideoSender();
    } catch (err: any) {
      console.error('Error starting live session:', err);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser or PC settings.'
          : err?.message || 'Could not start Gemini Live session on this PC.'
      );
      setSessionState('error');
      stopSession();
    }
  };

  const finalizeTurn = () => {
    setCurrentInterimUserText((u) => {
      const trimmedU = u.trim();
      if (trimmedU) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: 'u-' + Date.now(),
            sender: 'user',
            text: trimmedU,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          },
        ]);
      }
      return '';
    });

    setCurrentInterimModelText((m) => {
      const trimmedM = m.trim();
      if (trimmedM) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: 'm-' + Date.now(),
            sender: 'model',
            text: trimmedM,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          },
        ]);
      }
      return '';
    });
  };

  const stopSession = () => {
    // Stop WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    // Stop audio capture
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop player
    playerRef.current?.interrupt();

    // Stop video interval
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    stopCamera();
    stopScreen();

    finalizeTurn();
    setSessionState('idle');
    setSessionStartTime(null);
    setUserVolume(0);
    setModelVolume(0);
  };

  // Video Streaming Loop (Webcam or Screen Share at 1 FPS)
  const startVideoSender = () => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }

    videoIntervalRef.current = window.setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const activeVideoEl = isScreenActive
        ? screenRef.current
        : isCameraActive
        ? videoRef.current
        : null;

      if (!activeVideoEl || activeVideoEl.readyState < 2) return;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(activeVideoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          const base64Data = dataUrl.split(',')[1];
          if (base64Data) {
            wsRef.current.send(
              JSON.stringify({
                type: 'video',
                data: base64Data,
              })
            );
          }
        }
      } catch (e) {
        console.error('Error capturing video frame:', e);
      }
    }, 1000); // 1 frame per second
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
      setIsCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      // Turn off screen if camera on
      if (isScreenActive) {
        stopScreen();
        setIsScreenActive(false);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMessage('Could not activate webcam.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const toggleScreen = async () => {
    if (isScreenActive) {
      stopScreen();
      setIsScreenActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
      });
      if (screenRef.current) {
        screenRef.current.srcObject = stream;
        screenRef.current.play().catch(() => {});
      }
      setIsScreenActive(true);
      if (isCameraActive) {
        stopCamera();
        setIsCameraActive(false);
      }

      stream.getVideoTracks()[0].onended = () => {
        setIsScreenActive(false);
      };
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        console.error('Screen share error:', err);
        setErrorMessage('Could not share screen.');
      }
    }
  };

  const stopScreen = () => {
    if (screenRef.current && screenRef.current.srcObject) {
      (screenRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      screenRef.current.srcObject = null;
    }
  };

  const handleSendTextMessage = () => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput('');

    // Append to local transcript
    setTranscripts((prev) => [
      ...prev,
      {
        id: 'u-' + Date.now(),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    }
  };

  const copyAllTranscripts = () => {
    const fullText = transcripts
      .map((t) => `[${t.timestamp}] ${t.sender.toUpperCase()}: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const clearTranscripts = () => {
    setTranscripts([]);
    setCurrentInterimUserText('');
    setCurrentInterimModelText('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Session Control Card */}
      <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Glowing aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Status bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${
                sessionState === 'listening'
                  ? 'bg-emerald-400 shadow-md shadow-emerald-500/50'
                  : sessionState === 'speaking'
                  ? 'bg-cyan-400 shadow-md shadow-cyan-500/50'
                  : sessionState === 'connecting' || sessionState === 'thinking'
                  ? 'bg-amber-400 shadow-md shadow-amber-500/50'
                  : sessionState === 'error'
                  ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                  : 'bg-slate-600'
              }`}
            />
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Session Status:
              </span>{' '}
              <span className="text-sm font-semibold text-white capitalize">
                {sessionState === 'idle'
                  ? 'Ready to Start'
                  : sessionState === 'listening'
                  ? 'Listening to PC Microphone...'
                  : sessionState === 'speaking'
                  ? 'Gemini Live Speaking...'
                  : sessionState === 'connecting'
                  ? 'Establishing Live WebSocket...'
                  : sessionState === 'thinking'
                  ? 'Reasoning...'
                  : 'Session Error'}
              </span>
            </div>
            {sessionState !== 'idle' && (
              <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                {activeDuration}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Voice & Model</span>
            </button>
            <button
              onClick={onOpenDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>PC Mic & Audio Test</span>
            </button>
          </div>
        </div>

        {/* Collapsible Settings Drawer */}
        {showSettings && (
          <div className="relative z-10 mt-5 p-5 bg-slate-950/80 border border-slate-800 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fade-in">
            {/* Voice */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Gemini Voice Persona</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={sessionState !== 'idle'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="Puck">Puck (Energetic, natural male)</option>
                <option value="Aoede">Aoede (Warm, melodic female)</option>
                <option value="Charon">Charon (Calm, deep male)</option>
                <option value="Fenrir">Fenrir (Authoritative, clear male)</option>
                <option value="Kore">Kore (Soft, thoughtful female)</option>
                <option value="Zephyr">Zephyr (Balanced, conversational)</option>
              </select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Live API Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={sessionState !== 'idle'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="gemini-3.8-live">gemini-3.8-live (Standard Voice & Video)</option>
                <option value="gemini-3.8-live-extended-thinking">
                  gemini-3.8-live-extended-thinking (Deep Reasoning)
                </option>
              </select>
            </div>

            {/* Persona Preset */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Preset Assistant Mode</label>
              <select
                onChange={(e) => {
                  const p = PRESET_PERSONAS.find((item) => item.name === e.target.value);
                  if (p) setSystemInstruction(p.instruction);
                }}
                disabled={sessionState !== 'idle'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {PRESET_PERSONAS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Center Orb & Visualizer Area */}
        <div className="relative z-10 py-8 flex flex-col items-center justify-center space-y-6">
          <LiveOrb
            state={sessionState}
            userVolume={userVolume}
            modelVolume={modelVolume}
            size={220}
            onClick={sessionState === 'idle' ? startSession : stopSession}
          />

          {/* Quick Subtitle or helper */}
          <div className="text-center max-w-lg space-y-1">
            <p className="text-base font-semibold text-white">
              {sessionState === 'idle' && 'Click the Orb or Press Start to Begin'}
              {sessionState === 'connecting' && 'Connecting to Google Gemini Live...'}
              {sessionState === 'listening' && 'Listening... Speak naturally anytime'}
              {sessionState === 'speaking' && 'Gemini is speaking (You can interrupt anytime)'}
              {sessionState === 'error' && 'Encountered an issue'}
            </p>
            <p className="text-xs text-slate-400">
              {sessionState === 'idle'
                ? 'Uses your PC microphone (16kHz) and plays Gemini audio (24kHz) with natural interruption.'
                : 'Say anything or ask to inspect your screen or camera.'}
            </p>
          </div>

          {/* Error Banner if any */}
          {errorMessage && (
            <div className="w-full max-w-xl bg-rose-950/50 border border-rose-800/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-300 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-rose-200">Session Notice</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {sessionState === 'idle' ? (
              <button
                onClick={startSession}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Gemini Live on PC
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/30 transition cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                End Live Session
              </button>
            )}

            {/* Mic Mute Toggle */}
            <button
              onClick={() => setIsMicMuted(!isMicMuted)}
              disabled={sessionState === 'idle'}
              className={`p-3 rounded-2xl border transition ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              } disabled:opacity-40`}
              title={isMicMuted ? 'Unmute PC Mic' : 'Mute PC Mic'}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Webcam Vision Toggle */}
            <button
              onClick={toggleCamera}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-semibold transition ${
                isCameraActive
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              <span>{isCameraActive ? 'Cam Active' : 'Webcam'}</span>
            </button>

            {/* Screen Share Vision Toggle */}
            <button
              onClick={toggleScreen}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-semibold transition ${
                isScreenActive
                  ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isScreenActive ? (
                <MonitorOff className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
              <span>{isScreenActive ? 'Sharing Screen' : 'Share Screen'}</span>
            </button>
          </div>

          {/* Real-time Audio Spectrum Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl pt-4">
            <AudioWaveform
              level={userVolume}
              isActive={sessionState === 'listening' && !isMicMuted}
              color="emerald"
              label="PC Microphone Audio (16kHz PCM)"
            />
            <AudioWaveform
              level={modelVolume}
              isActive={sessionState === 'speaking'}
              color="cyan"
              label="Gemini Live Voice Audio (24kHz PCM)"
            />
          </div>
        </div>

        {/* Video Preview Feed (Picture-in-Picture) */}
        {(isCameraActive || isScreenActive) && (
          <div className="relative z-10 mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col items-center gap-2 animate-fade-in">
            <div className="flex items-center justify-between w-full text-xs text-slate-400 px-2">
              <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                <Eye className="w-3.5 h-3.5" />
                Live Multimodal Vision Feed (Streaming to Gemini at 1 FPS)
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                {isScreenActive ? 'Desktop / Window' : 'Webcam'}
              </span>
            </div>
            <div className="w-full max-w-md h-48 bg-black rounded-xl overflow-hidden border border-slate-800 relative">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                playsInline
                muted
              />
              <video
                ref={screenRef}
                className={`w-full h-full object-contain bg-slate-950 ${
                  isScreenActive ? 'block' : 'hidden'
                }`}
                playsInline
                muted
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Ask Gemini: &quot;What do you see on my screen?&quot; or &quot;Help me with this window.&quot;
            </p>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">Quick Spoken Starters:</span>
        {[
          'How can I speed up my PC boot time?',
          'What is the difference between Gemini Live and standard chat?',
          'Can you see what is on my screen right now?',
          'How do I test my audio lag on this computer?',
        ].map((promptText, i) => (
          <button
            key={i}
            onClick={() => {
              if (sessionState === 'idle') {
                startSession();
              }
              setTextInput(promptText);
            }}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            &quot;{promptText}&quot;
          </button>
        ))}
      </div>

      {/* Live Conversation Transcript */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">Real-Time Spoken Transcript</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAllTranscripts}
              disabled={transcripts.length === 0}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
            >
              {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={clearTranscripts}
              disabled={transcripts.length === 0}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 disabled:opacity-40 transition"
              title="Clear transcript"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="max-h-80 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {transcripts.length === 0 && !currentInterimUserText && !currentInterimModelText ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No conversation yet. Click &quot;Start Gemini Live on PC&quot; and speak into your microphone.
            </div>
          ) : (
            <>
              {transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-col ${
                    t.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-1 mb-0.5">
                    <span>{t.sender === 'user' ? 'You (PC Mic)' : `Gemini Live (${voice})`}</span>
                    <span>•</span>
                    <span>{t.timestamp}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      t.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/60'
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))}

              {/* Streaming Interim text */}
              {currentInterimUserText && (
                <div className="flex flex-col items-end animate-pulse">
                  <span className="text-[10px] text-indigo-400 px-1 mb-0.5">You (speaking...)</span>
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs bg-indigo-700/60 text-white border border-indigo-500/40 rounded-tr-none">
                    {currentInterimUserText}
                  </div>
                </div>
              )}

              {currentInterimModelText && (
                <div className="flex flex-col items-start animate-pulse">
                  <span className="text-[10px] text-cyan-400 px-1 mb-0.5">Gemini Live (speaking...)</span>
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs bg-slate-800 text-slate-100 border border-cyan-500/40 rounded-tl-none">
                    {currentInterimModelText}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={transcriptBottomRef} />
        </div>

        {/* Text fallback input during live session */}
        <div className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
            placeholder={
              sessionState === 'listening'
                ? 'Type to Gemini Live or simply speak into your PC mic...'
                : 'Start session above, or type a query...'
            }
            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={handleSendTextMessage}
            disabled={!textInput.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
