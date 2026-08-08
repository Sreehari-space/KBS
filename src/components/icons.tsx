import React from 'react';

/**
 * Icon set.
 *
 * Replaces the emoji the UI shipped with. Emoji render differently on every
 * platform, carry a consumer-app tone that is wrong for a till, and cannot
 * inherit weight or colour — these are stroked SVGs on a 24px grid using
 * `currentColor`, so they follow the text they sit beside.
 */

interface IconProps {
  className?: string;
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({
  className = 'w-5 h-5',
  children,
}) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

// ─── Navigation ─────────────────────────────────────────────────────────────

export const IconBilling: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V4a1 1 0 0 1 1-1Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
);

export const IconInventory: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
    <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
  </Svg>
);

export const IconLedger: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 4a1 1 0 0 1 1-1h13v18H6a1 1 0 0 1-1-1V4Z" />
    <path d="M5 17h14M9 3v18M12 8h4M12 12h4" />
  </Svg>
);

export const IconReports: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);

export const IconMore: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCustomers: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a3.2 3.2 0 0 1 0 6.2" />
  </Svg>
);

/** A shutter pulled down — "கடை சாத்து", closing up for the day. */
export const IconDayClose: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 4h18M4 4v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4" />
    <path d="M4 8h16M4 11.5h16" />
    <path d="M8 19h8M12 15v4" />
  </Svg>
);

export const IconLowStock: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const IconLabels: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z" />
    <path d="M7.5 7.5h.01" />
  </Svg>
);

export const IconSettings: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2.9a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V2.9a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const IconBills: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 4a1 1 0 0 1 1-1h9l6 6v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4Z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </Svg>
);

// ─── Actions ────────────────────────────────────────────────────────────────

export const IconScan: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 1h2M20 7V5a1 1 0 0 0-1-1h-2M20 17v2a1 1 0 0 1-1 1h-2" />
    <path d="M7.5 8v8M11 8v8M14.5 8v8M17.5 8v8" />
  </Svg>
);

export const IconMic: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </Svg>
);

export const IconPrint: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 8V3h10v5" />
    <path d="M5 8h14a2 2 0 0 1 2 2v6h-4v5H7v-5H3v-6a2 2 0 0 1 2-2Z" />
    <path d="M7 16h10" />
  </Svg>
);

export const IconWhatsApp: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-4-1L3 21l2.2-5.4a8.3 8.3 0 0 1-1.1-4.1A8.4 8.4 0 0 1 12.6 3 8.4 8.4 0 0 1 21 11.5Z" />
    <path d="M9.2 8.4c.3 0 .5.1.7.5l.6 1.2c.1.3 0 .5-.2.7l-.4.4c-.2.2-.2.4 0 .7a6 6 0 0 0 2.2 2.2c.3.2.5.2.7 0l.4-.4c.2-.2.4-.3.7-.2l1.2.6c.4.2.5.4.5.7 0 .9-.8 1.5-1.7 1.5-1 0-2.6-.7-3.9-2s-2-2.9-2-3.9c0-.9.6-1.7 1.5-1.7Z" />
  </Svg>
);

export const IconShare: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 15V3M8 7l4-4 4 4" />
  </Svg>
);

export const IconTorch: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M13 2 4.5 12.6a.8.8 0 0 0 .6 1.3H11l-1 8.1 8.5-10.6a.8.8 0 0 0-.6-1.3H12l1-8.1Z" />
  </Svg>
);

export const IconKeyboard: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" />
  </Svg>
);

export const IconClose: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconCheck: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Svg>
);

export const IconChevronRight: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconChevronDown: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m5 9 7 7 7-7" />
  </Svg>
);

export const IconBackspace: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9L2.5 12.7a1 1 0 0 1 0-1.4L9 5Z" />
    <path d="m13 10 4 4M17 10l-4 4" />
  </Svg>
);

export const IconPlus: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconMinus: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const IconSearch: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconTrash: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </Svg>
);
