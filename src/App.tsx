import React, { useState, useEffect } from 'react';
import {
  Mic,
  Sparkles,
  Radio,
  BookOpen,
  Laptop,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { LiveConsole } from './components/LiveConsole';
import { GuideHub } from './components/GuideHub';
import { DiagnosticsModal } from './components/DiagnosticsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'guide'>('console');
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch((err) => console.error('Failed to query status API:', err));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  Gemini Live
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                  PC Edition
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Real-Time Voice, Vision & Desktop Setup
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'console'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Console</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>How-To Guide</span>
            </button>
          </div>

          {/* Right Status & Diagnostics button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
              title="Test PC Microphone, Speakers & Camera"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Hardware Test</span>
            </button>

            {serverStatus && (
              <div
                className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  serverStatus.hasApiKey
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}
              >
                {serverStatus.hasApiKey ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                <span>{serverStatus.hasApiKey ? 'Live API Online' : 'Check API Key'}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'console' ? (
          <LiveConsole
            onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
            serverStatus={serverStatus}
          />
        ) : (
          <GuideHub onLaunchLiveConsole={() => setActiveTab('console')} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-indigo-400" />
            <span>Gemini Live PC Client • 16kHz PCM Audio In / 24kHz PCM Out</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-indigo-400 transition"
            >
              Installation Methods
            </button>
            <span>•</span>
            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="hover:text-indigo-400 transition"
            >
              Microphone & Speakers Test
            </button>
            <span>•</span>
            <a
              href="https://gemini.google.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-indigo-400 transition"
            >
              gemini.google.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* PC Hardware & Environment Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        serverStatus={serverStatus}
      />
    </div>
  );
}
