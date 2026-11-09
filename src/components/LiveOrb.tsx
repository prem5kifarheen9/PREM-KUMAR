import React, { useEffect, useRef } from 'react';

interface LiveOrbProps {
  state: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
  userVolume?: number; // 0 to 1
  modelVolume?: number; // 0 to 1
  onClick?: () => void;
  size?: number;
}

export const LiveOrb: React.FC<LiveOrbProps> = ({
  state,
  userVolume = 0,
  modelVolume = 0,
  onClick,
  size = 220,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.035;
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Intensity based on state
      let activeVolume = 0;
      if (state === 'speaking') {
        activeVolume = Math.max(0.15, modelVolume);
      } else if (state === 'listening') {
        activeVolume = Math.max(0.08, userVolume);
      } else if (state === 'thinking') {
        activeVolume = 0.25;
      } else if (state === 'connecting') {
        activeVolume = 0.15;
      }

      const baseRadius = (size / 2) * 0.62;
      const dynamicRadius = baseRadius + activeVolume * 28;

      // Glow backdrop
      const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, dynamicRadius * 1.55);
      if (state === 'error') {
        glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)');
        glowGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else if (state === 'speaking') {
        glowGrad.addColorStop(0, 'rgba(59, 130, 246, 0.55)');
        glowGrad.addColorStop(0.4, 'rgba(168, 85, 247, 0.35)');
        glowGrad.addColorStop(0.7, 'rgba(236, 72, 153, 0.2)');
        glowGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      } else if (state === 'listening') {
        glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
        glowGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.3)');
        glowGrad.addColorStop(0.7, 'rgba(59, 130, 246, 0.15)');
        glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      } else if (state === 'thinking') {
        glowGrad.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
        glowGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      } else {
        // Idle
        glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
        glowGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
        glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // Fluid Organic Rings
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        ctx.beginPath();
        const numPoints = 64;
        const speed = (r + 1) * 0.8;
        const currentRingRadius = dynamicRadius - r * 10;

        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const wobble =
            Math.sin(angle * (3 + r) + time * speed) * (4 + activeVolume * 16) +
            Math.cos(angle * 2 - time * 0.5) * (3 + activeVolume * 10);
          const rad = Math.max(10, currentRingRadius + wobble);
          const px = cx + Math.cos(angle) * rad;
          const py = cy + Math.sin(angle) * rad;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(
          cx - currentRingRadius,
          cy - currentRingRadius,
          cx + currentRingRadius,
          cy + currentRingRadius
        );

        if (state === 'speaking') {
          grad.addColorStop(0, `rgba(56, 189, 248, ${0.7 - r * 0.18})`);
          grad.addColorStop(0.5, `rgba(168, 85, 247, ${0.75 - r * 0.18})`);
          grad.addColorStop(1, `rgba(244, 63, 94, ${0.7 - r * 0.18})`);
        } else if (state === 'listening') {
          grad.addColorStop(0, `rgba(52, 211, 153, ${0.75 - r * 0.18})`);
          grad.addColorStop(0.5, `rgba(6, 182, 212, ${0.7 - r * 0.18})`);
          grad.addColorStop(1, `rgba(99, 102, 241, ${0.65 - r * 0.18})`);
        } else if (state === 'thinking') {
          grad.addColorStop(0, `rgba(251, 191, 36, ${0.7 - r * 0.18})`);
          grad.addColorStop(0.5, `rgba(192, 132, 252, ${0.65 - r * 0.18})`);
          grad.addColorStop(1, `rgba(239, 68, 68, ${0.6 - r * 0.18})`);
        } else if (state === 'error') {
          grad.addColorStop(0, `rgba(248, 113, 113, ${0.8 - r * 0.2})`);
          grad.addColorStop(1, `rgba(220, 38, 38, ${0.6 - r * 0.2})`);
        } else {
          grad.addColorStop(0, `rgba(129, 140, 248, ${0.6 - r * 0.15})`);
          grad.addColorStop(0.5, `rgba(96, 165, 250, ${0.5 - r * 0.15})`);
          grad.addColorStop(1, `rgba(192, 132, 252, ${0.4 - r * 0.15})`);
        }

        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Center high-energy core
      const coreRadius = Math.max(8, baseRadius * 0.35 + activeVolume * 15);
      const coreGrad = ctx.createRadialGradient(cx - coreRadius * 0.2, cy - coreRadius * 0.2, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(0.6, 'rgba(224, 231, 255, 0.8)');
      coreGrad.addColorStop(1, 'rgba(147, 197, 253, 0.1)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, userVolume, modelVolume, size]);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none transition-transform duration-300 ${
        state === 'listening' || state === 'speaking' ? 'scale-105' : 'hover:scale-102'
      }`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        className="w-full h-full drop-shadow-2xl"
      />
    </div>
  );
};
