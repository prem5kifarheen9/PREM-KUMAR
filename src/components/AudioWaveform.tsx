import React from 'react';

interface AudioWaveformProps {
  level: number; // 0 to 1
  isActive: boolean;
  color?: 'emerald' | 'indigo' | 'cyan' | 'amber' | 'rose';
  barCount?: number;
  label?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  level,
  isActive,
  color = 'indigo',
  barCount = 24,
  label,
}) => {
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Generate organic heights distributed across the center
    const centerFactor = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
    const noise = Math.sin(i * 0.8 + Date.now() * 0.005) * 0.2 + 0.8;
    const heightPercent = isActive ? Math.max(10, level * 100 * centerFactor * noise) : 8;
    return Math.min(100, Math.max(8, heightPercent));
  });

  const colorClasses = {
    indigo: 'bg-indigo-400 group-hover:bg-indigo-300',
    emerald: 'bg-emerald-400 group-hover:bg-emerald-300',
    cyan: 'bg-cyan-400 group-hover:bg-cyan-300',
    amber: 'bg-amber-400 group-hover:bg-amber-300',
    rose: 'bg-rose-400 group-hover:bg-rose-300',
  }[color];

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {label && (
        <div className="flex items-center justify-between w-full text-xs text-slate-400 font-mono px-1">
          <span>{label}</span>
          <span className="text-slate-500">{isActive ? `${Math.round(level * 100)}%` : 'MUTED'}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-1 h-10 w-full px-2 py-1 bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
        {bars.map((h, idx) => (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-75 ${colorClasses} ${
              isActive ? 'opacity-90 shadow-sm shadow-current' : 'opacity-25'
            }`}
            style={{
              height: `${h}%`,
              transitionDuration: isActive ? '80ms' : '200ms',
            }}
          />
        ))}
      </div>
    </div>
  );
};
