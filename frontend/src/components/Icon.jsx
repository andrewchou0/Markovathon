export default function Icon({ name, size = 18, ...props }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    network: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="2" y="16" width="6" height="5" rx="1" /><rect x="16" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M5 16v-4h14v4" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    refresh: <path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    plug: <><path d="M8 3v5M16 3v5M5 8h14v2a7 7 0 0 1-14 0V8ZM12 17v4" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
