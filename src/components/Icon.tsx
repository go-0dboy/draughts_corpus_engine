import type { SVGProps } from 'react';

export type IconName =
  | 'games'
  | 'position'
  | 'import'
  | 'tools'
  | 'search'
  | 'back'
  | 'flip'
  | 'first'
  | 'previous'
  | 'next'
  | 'last'
  | 'up'
  | 'upload'
  | 'openings'
  | 'tactics'
  | 'evaluation'
  | 'players'
  | 'settings'
  | 'close';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 24, ...props }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...props,
  };

  switch (name) {
    case 'games':
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>;
    case 'position':
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 4v16M4 12h16" /><circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1.8" fill="currentColor" stroke="none" /></svg>;
    case 'import':
    case 'upload':
      return <svg {...common}><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M5 18v1.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V18" /></svg>;
    case 'tools':
      return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
    case 'flip':
      return <svg {...common}><path d="M7 7h10l-3-3M17 17H7l3 3" /><path d="M19 9a7 7 0 0 1-1.2 7M5 15A7 7 0 0 1 6.2 8" /></svg>;
    case 'first':
      return <svg {...common}><path d="M6 5v14M18 6l-7 6 7 6V6Z" /></svg>;
    case 'previous':
      return <svg {...common}><path d="m15 18-7-6 7-6v12Z" /></svg>;
    case 'next':
      return <svg {...common}><path d="m9 6 7 6-7 6V6Z" /></svg>;
    case 'last':
      return <svg {...common}><path d="M18 5v14M6 6l7 6-7 6V6Z" /></svg>;
    case 'up':
      return <svg {...common}><path d="m6 14 6-6 6 6" /></svg>;
    case 'openings':
      return <svg {...common}><path d="M6 20V8m0 0 5-4v12m-5-8 5 3 7-4v13" /><circle cx="6" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="11" cy="4" r="1.5" fill="currentColor" stroke="none" /><circle cx="18" cy="7" r="1.5" fill="currentColor" stroke="none" /></svg>;
    case 'tactics':
      return <svg {...common}><path d="m12 3 2.2 5.2L20 10l-4.3 3.7L17 20l-5-3-5 3 1.3-6.3L4 10l5.8-1.8L12 3Z" /></svg>;
    case 'evaluation':
      return <svg {...common}><path d="M4 18h16M6 15l3-4 3 2 5-7 1 2" /></svg>;
    case 'players':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M4 19c.5-3.2 2.2-5 5-5s4.5 1.8 5 5" /><circle cx="17" cy="9" r="2" /><path d="M15.5 14.5c2.4.3 3.8 1.8 4.1 4.5" /></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21H9.6v-.08a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.8 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2V9.6h.08a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.14 3.4l.06.06A1.7 1.7 0 0 0 8.08 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2h4.04v.08a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.32 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4H21v4.04h-.08a1.7 1.7 0 0 0-1 .4 1.7 1.7 0 0 0-.52 1.16Z" /></svg>;
    case 'close':
      return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  }
}
