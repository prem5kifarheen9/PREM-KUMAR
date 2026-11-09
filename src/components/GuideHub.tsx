import React, { useState } from 'react';
import {
  AppWindow,
  Terminal,
  Command,
  Settings,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Laptop,
  Mic,
  Monitor,
  Flame,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const GuideHub: React.FC<{ onLaunchLiveConsole: () => void }> = ({
  onLaunchLiveConsole,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'shortcut' | 'developer' | 'troubleshoot'>('pwa');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const pythonScriptCode = `# gemini_live_pc.py
# Real-time Gemini Live PC Audio Client
# Requirements: pip install google-genai pyaudio

import asyncio
import os
import pyaudio
from google import genai
from google.genai import types

# 1. Initialize Gemini Client with your API key
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options={"headers": {"User-Agent": "aistudio-build"}}
)

# Audio Parameters (Live API requires 16kHz input, delivers 24kHz output)
INPUT_RATE = 16000
OUTPUT_RATE = 24000
CHUNK_SIZE = 1024

p = pyaudio.PyAudio()

async def main():
    print("Connecting to Gemini Live on PC...")
    # Open microphone stream (16kHz, 16-bit PCM)
    mic_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=INPUT_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )
    # Open speaker stream (24kHz, 16-bit PCM)
    speaker_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=OUTPUT_RATE,
        output=True
    )

    async with client.aio.live.connect(
        model="gemini-3.8-live",
        config=types.LiveConnectConfig(
            response_modalities=[types.LiveModality.AUDIO],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                )
            ),
            system_instruction="You are Gemini Live running on my PC. Keep responses conversational and quick."
        )
    ) as session:
        print("Gemini Live is active! Speak into your PC mic (Ctrl+C to quit)...")

        # Task to send microphone audio to Gemini
        async def send_mic():
            while True:
                data = mic_stream.read(CHUNK_SIZE, exception_on_overflow=False)
                await session.send(input={"data": data, "mime_type": "audio/pcm;rate=16000"})
                await asyncio.sleep(0.01)

        # Task to receive and play Gemini speech
        async def receive_audio():
            async for response in session.receive():
                server_content = response.server_content
                if server_content is not None and server_content.model_turn is not None:
                    for part in server_content.model_turn.parts:
                        if part.inline_data:
                            speaker_stream.write(part.inline_data.data)

        await asyncio.gather(send_mic(), receive_audio())

if __name__ == "__main__":
    asyncio.run(main())
`;

  const nodeScriptCode = `// gemini-live-pc.ts
// Node.js PC client
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

async function runLive() {
  const session = await ai.live.connect({
    model: 'gemini-3.8-live',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
      },
      systemInstruction: 'You are Gemini Live running on this PC workstation.'
    },
    callbacks: {
      onmessage: (msg) => {
        // Handle 24kHz PCM chunks
        for (const part of msg.serverContent?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            // Send to audio device
          }
        }
      }
    }
  });
}
runLive();
`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/20 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Complete PC Setup & Workstation Guide
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              How to Start <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">Gemini Live</span> on Your PC
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Experience ultra-low latency, real-time voice and vision with Gemini. You can launch it right here in your browser, install it as a standalone Windows/Mac desktop app, bind it to a keyboard hotkey, or run custom desktop scripts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={onLaunchLiveConsole}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              Launch Live Console Now
            </button>
          </div>
        </div>
      </div>

      {/* 4 Methods Grid Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Method 1 */}
        <div
          onClick={onLaunchLiveConsole}
          className="group relative bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition">
              In-Browser Live Web App
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Run Gemini Live directly in this tab. Full 16kHz microphone capture, 24kHz audio synthesis, webcam, and live screen sharing.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400 gap-1 group-hover:gap-1.5 transition-all">
            <span>Open Console</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Method 2 */}
        <div
          onClick={() => setActiveTab('pwa')}
          className={`group relative bg-slate-900/70 hover:bg-slate-800/80 border rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-lg flex flex-col justify-between ${
            activeTab === 'pwa'
              ? 'border-cyan-500/60 ring-2 ring-cyan-500/20'
              : 'border-slate-800 hover:border-cyan-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-cyan-300 transition">
              Desktop PWA (Chrome/Edge)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Install Gemini as a dedicated standalone window with desktop notifications, pinned to your Windows Taskbar or Mac Dock.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-cyan-400 gap-1 group-hover:gap-1.5 transition-all">
            <span>View PWA Steps</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Method 3 */}
        <div
          onClick={() => setActiveTab('shortcut')}
          className={`group relative bg-slate-900/70 hover:bg-slate-800/80 border rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-lg flex flex-col justify-between ${
            activeTab === 'shortcut'
              ? 'border-purple-500/60 ring-2 ring-purple-500/20'
              : 'border-slate-800 hover:border-purple-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-purple-300 transition">
              Global PC Hotkeys
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configure a system-wide hotkey (e.g. Win+Alt+G) or remap the Windows Copilot key to summon Gemini Live instantly.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-400 gap-1 group-hover:gap-1.5 transition-all">
            <span>Configure Keys</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Method 4 */}
        <div
          onClick={() => setActiveTab('developer')}
          className={`group relative bg-slate-900/70 hover:bg-slate-800/80 border rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-lg flex flex-col justify-between ${
            activeTab === 'developer'
              ? 'border-emerald-500/60 ring-2 ring-emerald-500/20'
              : 'border-slate-800 hover:border-emerald-500/50'
          }`}
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              4
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition">
              Developer CLI / Python
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Run standalone background Python or Node.js Live API streaming directly from your PC PowerShell or terminal.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400 gap-1 group-hover:gap-1.5 transition-all">
            <span>Get Code Snippet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-md">
        <button
          onClick={() => setActiveTab('pwa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'pwa'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AppWindow className="w-4 h-4" />
          Option A: Desktop PWA Setup
        </button>
        <button
          onClick={() => setActiveTab('shortcut')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'shortcut'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Command className="w-4 h-4" />
          Option B: Keyboard Hotkeys
        </button>
        <button
          onClick={() => setActiveTab('developer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'developer'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Option C: Python / CLI Script
        </button>
        <button
          onClick={() => setActiveTab('troubleshoot')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'troubleshoot'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          Option D: PC Microphone & Audio Fixes
        </button>
      </div>

      {/* Tab 1: PWA */}
      {activeTab === 'pwa' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                <AppWindow className="w-5 h-5 text-indigo-400" />
                How to Install Gemini as a Native Desktop App on PC
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Both Google Chrome and Microsoft Edge allow you to run Gemini as a dedicated borderless desktop application.
              </p>
            </div>
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Open gemini.google.com <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h4 className="font-semibold text-white text-sm">Open in Chrome or Edge</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Open your browser on this PC and go to <strong className="text-slate-200">gemini.google.com</strong>. Log in with your Google account.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h4 className="font-semibold text-white text-sm">Click "Install App"</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                In the address bar on the right side, click the <strong>Install Gemini</strong> icon (or click the 3 dots <code className="text-slate-300">⋮</code> &gt; <strong>Save and share</strong> &gt; <strong>Install page as app...</strong>).
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h4 className="font-semibold text-white text-sm">Pin to Taskbar & Speak</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Right click the Gemini icon on your Windows Taskbar or Mac Dock and choose <strong>Pin to taskbar</strong>. Click the sparkling mic icon to start live voice!
              </p>
            </div>
          </div>

          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200 space-y-1">
              <div className="font-semibold text-white">Pro Tip: Microphone Permission in PWA</div>
              <p>
                When prompted for the first time, click <strong>Allow</strong> for Microphone access. If you accidentally denied it, click the lock icon in the top app header to toggle microphone permissions back on.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Shortcut */}
      {activeTab === 'shortcut' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Command className="w-5 h-5 text-indigo-400" />
              Bind Gemini Live to a PC Global Keyboard Hotkey
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Summon Gemini instantly anywhere in Windows or macOS with a single keystroke.
            </p>
          </div>

          <div className="space-y-4">
            {/* Windows Method */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-cyan-400" />
                  Windows 11 / 10 Native Desktop Shortcut
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  Ctrl + Alt + G
                </span>
              </div>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
                <li>Right-click on your Windows desktop &gt; <strong>New</strong> &gt; <strong>Shortcut</strong>.</li>
                <li>
                  In the location box, enter:
                  <div className="mt-1.5 p-2 bg-slate-900 rounded-lg font-mono text-cyan-300 flex items-center justify-between">
                    <span>chrome.exe --app=https://gemini.google.com</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          'chrome.exe --app=https://gemini.google.com',
                          'win-shortcut'
                        )
                      }
                      className="text-slate-400 hover:text-white p-1"
                    >
                      {copiedCode === 'win-shortcut' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </li>
                <li>Name the shortcut <strong>Gemini Live</strong> and click Finish.</li>
                <li>Right-click the newly created shortcut &gt; <strong>Properties</strong>.</li>
                <li>Click into the <strong>Shortcut key</strong> field and press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Alt</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">G</kbd>. Click OK.</li>
              </ol>
            </div>

            {/* Remap Copilot Key */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
              <span className="font-semibold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Remapping the Windows Copilot Key with Microsoft PowerToys
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                If your PC keyboard has a dedicated Copilot key (or you want to remap F12 / CapsLock):
                Install free <strong>Microsoft PowerToys</strong> from the Microsoft Store, go to <strong>Keyboard Manager</strong>, click <strong>Remap a key</strong>, and map your chosen key to launch your Gemini Live application shortcut!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Developer / Python */}
      {activeTab === 'developer' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-indigo-400" />
              Run Gemini Live Directly via Python or Node.js on PC
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Use the official <code className="text-indigo-300">@google/genai</code> or <code className="text-indigo-300">google-genai</code> SDK with raw bidirectional streaming over WebSockets.
            </p>
          </div>

          {/* Quick Install Command */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400">$</span>
              <span>pip install google-genai pyaudio</span>
            </div>
            <button
              onClick={() => copyToClipboard('pip install google-genai pyaudio', 'pip-cmd')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              {copiedCode === 'pip-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode === 'pip-cmd' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
              <span className="font-mono text-slate-300 font-medium">gemini_live_pc.py</span>
              <button
                onClick={() => copyToClipboard(pythonScriptCode, 'python-code')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
              >
                {copiedCode === 'python-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode === 'python-code' ? 'Copied Full Script' : 'Copy Python Script'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed">
              {pythonScriptCode}
            </pre>
          </div>

          <div className="text-xs text-slate-400">
            Set your key in PowerShell: <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">$env:GEMINI_API_KEY="YOUR_API_KEY"</code> then run <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">python gemini_live_pc.py</code>.
          </div>
        </div>
      )}

      {/* Tab 4: Troubleshooting */}
      {activeTab === 'troubleshoot' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-indigo-400" />
              PC Microphone, Audio & Permissions Troubleshooting
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Common Windows and macOS audio configuration steps to ensure crystal clear Gemini Live communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Windows Mic Privacy */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                <h4 className="font-semibold text-white text-sm">Windows Microphone Privacy</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If the browser or app cannot hear you, open Windows <strong>Settings</strong> &gt; <strong>Privacy & security</strong> &gt; <strong>Microphone</strong>:
              </p>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Ensure <strong>Microphone access</strong> is turned ON.</li>
                <li>Ensure <strong>Let desktop apps access your microphone</strong> is turned ON.</li>
              </ul>
            </div>

            {/* Browser Permissions */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h4 className="font-semibold text-white text-sm">Browser Permissions Reset</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                In Google Chrome, Brave, or Edge:
              </p>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Click the <strong>Tune / Padlock</strong> icon next to the address bar URL.</li>
                <li>Set <strong>Microphone</strong> and <strong>Camera</strong> to <strong>Allow</strong>.</li>
                <li>Refresh the tab to apply.</li>
              </ul>
            </div>

            {/* Bluetooth Headsets */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-purple-400" />
                <h4 className="font-semibold text-white text-sm">Bluetooth Headsets (AirPods / Sony)</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                When using Bluetooth headphones on Windows, Windows may switch to low-quality "Hands-Free AG Audio". For maximum fidelity, use your laptop or USB external mic as input, and keep headphones on high-fidelity Stereo output.
              </p>
            </div>

            {/* Echo & Feedback */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4 text-amber-400" />
                <h4 className="font-semibold text-white text-sm">Echo Cancellation</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Gemini Live supports natural conversational interruption. Wearing headphones prevents speaker audio from looping back into your microphone, allowing you to interrupt Gemini fluidly at any moment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
