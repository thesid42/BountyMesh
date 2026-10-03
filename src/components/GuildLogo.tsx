"use client";

interface GuildLogoProps {
  size?: number;
  className?: string;
}

export function GuildLogo({ size = 36, className = "" }: GuildLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Shield Background Gradient */}
        <linearGradient id="shieldGrad" x1="20" y1="2" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3d2a1e" />
          <stop offset="50%" stopColor="#251b14" />
          <stop offset="100%" stopColor="#140d09" />
        </linearGradient>

        {/* Outer Gold Rim Gradient */}
        <linearGradient id="goldRim" x1="6" y1="2" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#d4b86a" />
          <stop offset="80%" stopColor="#997a38" />
          <stop offset="100%" stopColor="#d4b86a" />
        </linearGradient>

        {/* Central Gem Radiant Glow */}
        <linearGradient id="gemGrad" x1="16" y1="16" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="50%" stopColor="#84a96e" />
          <stop offset="100%" stopColor="#4d7c0f" />
        </linearGradient>
      </defs>

      {/* Drop Shadow Base */}
      <path
        d="M20 38.5C20 38.5 34 30.5 34 16.5V6L20 2L6 6V16.5C6 30.5 20 38.5 20 38.5Z"
        fill="#070504"
        transform="translate(0, 1.5)"
        opacity="0.65"
      />

      {/* Main Guild Crest Shield Contour */}
      <path
        d="M20 38C20 38 34 30 34 16V5.5L20 1.5L6 5.5V16C6 30 20 38 20 38Z"
        fill="url(#shieldGrad)"
        stroke="url(#goldRim)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Inner Inlay Ridge */}
      <path
        d="M20 34.5C20 34.5 31 27.5 31 16.5V7.5L20 4L9 7.5V16.5C9 27.5 20 34.5 20 34.5Z"
        stroke="#4a3a30"
        strokeWidth="1.2"
        strokeDasharray="2 1"
        fill="none"
      />

      {/* Interlocking Autonomous Mesh Lattice Lines */}
      <path d="M20 8.5L28 14.5M20 8.5L12 14.5" stroke="#7a6245" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 14.5L12 23M28 14.5L28 23" stroke="#7a6245" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 23L20 29.5M28 23L20 29.5" stroke="#7a6245" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 8.5L20 15M20 25L20 29.5" stroke="#997a38" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 14.5L16 18M28 14.5L24 18" stroke="#997a38" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 23L16 22M28 23L24 22" stroke="#997a38" strokeWidth="1.2" strokeLinecap="round" />

      {/* Outer Lattice Nodes */}
      <circle cx="20" cy="8.5" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />
      <circle cx="28" cy="14.5" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />
      <circle cx="28" cy="23" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />
      <circle cx="20" cy="29.5" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />
      <circle cx="12" cy="23" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />
      <circle cx="12" cy="14.5" r="1.8" fill="#d4b86a" stroke="#140d09" strokeWidth="0.8" />

      {/* Central Heart Diamond Gem (Escrow Core Node) */}
      <polygon
        points="20,15 24.5,20 20,25 15.5,20"
        fill="url(#gemGrad)"
        stroke="#d4b86a"
        strokeWidth="1.4"
      />

      {/* Gem Specular Facet Sparkle */}
      <polygon points="20,16 22,20 20,20 19,18" fill="#ecfccb" opacity="0.9" />
    </svg>
  );
}
