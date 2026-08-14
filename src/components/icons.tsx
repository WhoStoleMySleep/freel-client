interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const stroke = (p: IconProps) => ({
  width: p.size ?? 16,
  height: p.size ?? 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.color ?? 'currentColor',
  strokeWidth: p.strokeWidth ?? 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconClock = (p: IconProps) => (
  <svg {...stroke({ ...p, strokeWidth: p.strokeWidth ?? 2.4 })}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 1.7" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconMoon = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...stroke({ ...p, strokeWidth: p.strokeWidth ?? 3 })}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <svg {...stroke({ ...p, strokeWidth: p.strokeWidth ?? 2.4 })}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...stroke({ ...p, strokeWidth: p.strokeWidth ?? 2.4 })}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconPlay = ({ size = 12, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z" />
  </svg>
);

export const IconPause = ({ size = 12, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="6" y="5" width="4" height="14" rx="1.3" />
    <rect x="14" y="5" width="4" height="14" rx="1.3" />
  </svg>
);

export const IconInvoice = (p: IconProps) => (
  <svg {...stroke({ ...p, strokeWidth: p.strokeWidth ?? 2.2 })}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 15h6M9 11h2" />
  </svg>
);

export const IconTabDash = (p: IconProps) => (
  <svg {...stroke({ ...p, size: p.size ?? 22 })}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconTabProjects = (p: IconProps) => (
  <svg {...stroke({ ...p, size: p.size ?? 22 })}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconTabBilling = (p: IconProps) => (
  <svg {...stroke({ ...p, size: p.size ?? 22 })}>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-4 3 3 5-7" />
  </svg>
);

export const IconStop = (p: IconProps) => (
  <svg {...stroke(p)}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </svg>
);

/** Знак логотипа: кольцо-таймер и «f». Тот же контур, что в иконках сборки (app-icon.svg). */
export const LogoMark = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <defs>
      <linearGradient id="logoRing" x1="290" y1="270" x2="740" y2="750" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#8aa2ff" />
        <stop offset="0.5" stopColor="#6c8cff" />
        <stop offset="1" stopColor="#43d6a0" />
      </linearGradient>
    </defs>
    <g fill="none" strokeLinecap="round">
      <path d="M 589.6 222.2 A 300 300 0 1 0 783.9 385.2" stroke="url(#logoRing)" strokeWidth="70" />
      <path d="M 470 706 L 470 432 C 470 352 532 316 610 340" stroke="#fff" strokeWidth="76" />
      <path d="M 396 512 L 594 512" stroke="#f5c451" strokeWidth="70" />
    </g>
  </svg>
);
