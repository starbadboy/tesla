import type { CSSProperties, ReactNode } from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
}

interface BaseIconProps extends IconProps {
  d?: string;
  children?: ReactNode;
}

function Icon({ d, size = 16, stroke = 1.5, fill = 'none', style, className, children }: BaseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

export const IconCar = (p: IconProps) => (
  <Icon {...p}><path d="M5 17h14M6 17v2M18 17v2M4 13l2-6a2 2 0 012-2h8a2 2 0 012 2l2 6M4 13h16v4H4zM7 15h1M16 15h1" /></Icon>
);
export const IconPlate = (p: IconProps) => (
  <Icon {...p}><path d="M3 7h18v10H3zM7 11h2M11 11h2M15 11h2M7 14h10" /></Icon>
);
export const IconSound = (p: IconProps) => (
  <Icon {...p}><path d="M3 10v4h3l5 4V6l-5 4H3zM16 8c1.5 1.5 1.5 6.5 0 8M19 5c3 3 3 11 0 14" /></Icon>
);
export const IconLayers = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" /></Icon>
);
export const IconUpload = (p: IconProps) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>
);
export const IconDownload = (p: IconProps) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>
);
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></Icon>
);
export const IconRotate = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 1015 -6.7L21 8M21 3v5h-5" /></Icon>
);
export const IconScale = (p: IconProps) => (
  <Icon {...p}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Icon>
);
export const IconEye = (p: IconProps) => (
  <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></Icon>
);
export const IconGlobe = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></Icon>
);
export const IconShare = (p: IconProps) => (
  <Icon {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" /></Icon>
);
export const IconGrid = (p: IconProps) => (
  <Icon {...p}><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" /></Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}><path d="M18 6L6 18M6 6l12 12" /></Icon>
);
export const IconBattery = (p: IconProps) => (
  <Icon {...p}><rect x="2" y="7" width="18" height="10" rx="1" /><path d="M22 11v2M5 10v4M8 10v4M11 10v4" /></Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></Icon>
);
export const IconZap = (p: IconProps) => (
  <Icon {...p}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></Icon>
);
export const IconChevDown = (p: IconProps) => (
  <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const IconHeart = (p: IconProps) => (
  <Icon {...p}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /></Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}><path d="M20 6L9 17l-5-5" /></Icon>
);
export const IconSun = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Icon>
);
export const IconMoon = (p: IconProps) => (
  <Icon {...p}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></Icon>
);
export const IconSliders = (p: IconProps) => (
  <Icon {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Icon>
);
export const IconTarget = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Icon>
);
export const IconSettings = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></Icon>
);
