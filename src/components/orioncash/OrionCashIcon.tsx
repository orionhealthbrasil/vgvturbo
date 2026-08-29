import { cn } from '@/lib/utils';

interface OrionCashIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

// Hexágono dourado com o Cinto de Orion — identidade visual do VGVCash
export function OrionCashIcon({ size = 32, className, animated = false }: OrionCashIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && 'drop-shadow-[0_0_6px_rgba(255,215,0,0.6)]', className)}
      aria-label="VGVCash"
    >
      {animated && (
        <style>{`
          @keyframes orioncash-orbit {
            from { transform: rotate(0deg); transform-origin: 20px 20px; }
            to   { transform: rotate(360deg); transform-origin: 20px 20px; }
          }
          .oc-orbit { animation: orioncash-orbit 6s linear infinite; transform-origin: 20px 20px; }
        `}</style>
      )}
      {/* Hexágono dourado — estático */}
      <polygon
        points="20,2 36,11 36,29 20,38 4,29 4,11"
        fill="url(#gold-grad)"
        stroke="url(#gold-stroke)"
        strokeWidth="0.5"
      />
      {/* Hexágono interno escuro */}
      <polygon
        points="20,5.5 33,13.25 33,28.75 20,36.5 7,28.75 7,13.25"
        fill="url(#dark-grad)"
      />
      {/* Cinto de Orion — 3 estrelas orbitando */}
      <g className={animated ? 'oc-orbit' : undefined}>
        <circle cx="13.5" cy="23" r="2.5" fill="#FFD700" opacity="0.95" />
        <circle cx="20"   cy="20" r="3"   fill="#FFD700" />
        <circle cx="26.5" cy="17" r="2.5" fill="#FFD700" opacity="0.95" />
        <line x1="13.5" y1="23" x2="26.5" y2="17" stroke="#FFD700" strokeWidth="0.5" opacity="0.25" />
        <circle cx="30" cy="9" r="1.5" fill="#00D4AA" opacity="0.85" />
      </g>

      <defs>
        <linearGradient id="gold-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFD700" />
          <stop offset="40%"  stopColor="#F4C430" />
          <stop offset="70%"  stopColor="#B8860B" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <linearGradient id="gold-stroke" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFE566" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <radialGradient id="dark-grad" cx="38%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#1a2a1a" />
          <stop offset="100%" stopColor="#080f20" />
        </radialGradient>
      </defs>
    </svg>
  );
}
