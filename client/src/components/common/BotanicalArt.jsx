// Restrained botanical illustrations & silhouettes in the Sylvan Folio palette (DESIGN.md).

export function ForestCanopyArt({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 640 240"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <defs>
        <linearGradient id="canopy-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2e1a" />
          <stop offset="100%" stopColor="#2d4a2d" />
        </linearGradient>
        <linearGradient id="hill-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#354a34" />
          <stop offset="100%" stopColor="#2d4a2d" />
        </linearGradient>
        <linearGradient id="hill-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b6344" />
          <stop offset="100%" stopColor="#344b2e" />
        </linearGradient>
        <linearGradient id="hill-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ca67a" />
          <stop offset="100%" stopColor="#4b6344" />
        </linearGradient>
      </defs>

      <rect width="640" height="240" fill="url(#canopy-sky)" />

      {/* Soft moon glow */}
      <circle cx="515" cy="54" r="32" fill="#c2deb7" opacity="0.14" />
      <circle cx="515" cy="54" r="14" fill="#cfebba" opacity="0.82" />

      {/* Subtle atmospheric stars */}
      <circle cx="110" cy="42" r="1.5" fill="#c2deb7" opacity="0.45" />
      <circle cx="238" cy="28" r="1.2" fill="#c2deb7" opacity="0.35" />
      <circle cx="372" cy="48" r="1.6" fill="#c2deb7" opacity="0.4" />
      <circle cx="585" cy="36" r="1.2" fill="#c2deb7" opacity="0.35" />

      {/* Distant mountain ridge */}
      <path d="M0 175 L115 110 L215 148 L335 78 L455 145 L565 102 L640 135 L640 240 L0 240 Z" fill="url(#hill-far)" />

      {/* Cypress & pine silhouettes */}
      <ellipse cx="78" cy="135" rx="22" ry="62" fill="#344b2e" />
      <ellipse cx="116" cy="148" rx="16" ry="48" fill="#4b6344" />
      <ellipse cx="536" cy="128" rx="20" ry="64" fill="#344b2e" />
      <ellipse cx="574" cy="146" rx="15" ry="44" fill="#4b6344" />
      <ellipse cx="442" cy="150" rx="18" ry="42" fill="#344b2e" />

      {/* Rolling sage & moss hills */}
      <path d="M0 185 Q110 138 220 182 T450 176 T640 165 L640 240 L0 240 Z" fill="url(#hill-mid)" />
      <path d="M-20 220 Q95 162 210 208 Q320 155 445 206 Q545 170 660 212 L660 245 L-20 245 Z" fill="url(#hill-near)" opacity="0.88" />
    </svg>
  );
}

export function BotanicalSprig({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      className={className}
    >
      <path
        d="M22 104 C38 80 56 54 94 22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M44 76 C30 70 24 58 28 46 C40 48 48 60 44 76 Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M60 58 C74 62 86 56 92 44 C78 40 66 46 60 58 Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M68 46 C56 38 54 26 60 16 C70 22 74 34 68 46 Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M84 30 C94 30 102 24 106 14 C96 12 88 18 84 30 Z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function LeafMark({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
