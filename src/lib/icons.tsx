/* One icon family: 24px grid, 2px round strokes, no fills. Ported from the original site. */
export const ICONS: Record<string, string> = {
  ramen: '<path d="M3.5 11.5h17c0 4.4-3.8 7.5-8.5 7.5s-8.5-3.1-8.5-7.5Z"/><path d="M9 9 19 3M11.5 9.5 21 5.5M9 19.8h6"/>',
  sushi: '<path d="M4 13.5c0-2.5 3.6-4.5 8-4.5s8 2 8 4.5v1.2c0 1.5-3.6 2.8-8 2.8s-8-1.3-8-2.8Z"/><path d="M10 9.4v8M14 9.4v8"/>',
  cafe: '<path d="M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 10.5h1.2a2.3 2.3 0 0 1 0 4.6H16M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/>',
  sweets: '<path d="M12 21V3"/><circle cx="12" cy="6.5" r="2.6"/><circle cx="12" cy="11.6" r="2.6"/><circle cx="12" cy="16.7" r="2.6"/>',
  bar: '<path d="M5.5 4h13L12 12Z"/><path d="M12 12v7.5M8.5 20h7"/>',
  dining: '<path d="M7.5 3v7.5M5 3v4.5a2.5 2.5 0 0 0 5 0V3M7.5 10.5V21"/><ellipse cx="16.5" cy="6.8" rx="2.6" ry="3.8"/><path d="M16.5 10.6V21"/>', // fork and spoon
  shop: '<path d="M5 8h14l-1.1 12H6.1Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  books: '<path d="M3.5 5.5c2.6-1.2 5.8-1.2 8.5.6 2.7-1.8 5.9-1.8 8.5-.6v13c-2.6-1.2-5.8-1.2-8.5.6-2.7-1.8-5.9-1.8-8.5-.6Z"/><path d="M12 6.1v13"/>',
  art: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.5-.9 1-1.7-.7-1 0-2.1 1.1-2.1h2.4a4 4 0 0 0 4-4c0-5.1-3.8-9.2-8.5-9.2Z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
  temple: '<path d="M3 6.2c3.6.9 14.4.9 18 0M5 9.5h14M7 6.8V20M17 6.8V20M12 9.5V7"/>',
  church: '<path d="M12 2.5v4.5M10 4.6h4M5.5 21v-8.5L12 7l6.5 5.5V21Z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  museum: '<path d="M3 9.2 12 4l9 5.2Z"/><path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20h17"/>',
  theater: '<path d="M4.5 4.5h15v6.3a7.5 7.5 0 0 1-15 0Z"/><path d="M9 9h.01M15 9h.01M9 13c1.6 1.3 4.4 1.3 6 0"/>',
  music: '<path d="M9 18V5.5l11-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8M16 5.3a2.7 2.7 0 0 1 0 5.4M18 14.5c1.7.6 2.8 2.6 2.8 5.5"/>',
  lantern: '<path d="M9 3h6M12 3v2.2M7 8c0-1.8 2.2-2.8 5-2.8s5 1 5 2.8v6.5c0 1.8-2.2 2.8-5 2.8s-5-1-5-2.8Z"/><path d="M7 11.2h10M10 17.3v2.2h4v-2.2"/>',
  star: '<path d="m12 3.5 2.5 5.3 5.8.6-4.3 3.9 1.2 5.7L12 16.1 6.8 19l1.2-5.7-4.3-3.9 5.8-.6Z"/>',
  park: '<path d="M8 20V4h5a4.5 4.5 0 0 1 0 9H8"/>',
  wc: '<circle cx="12" cy="4.5" r="2"/><path d="M8.5 21v-5.5H7l1.6-6.3a1.5 1.5 0 0 1 1.4-1.2h4a1.5 1.5 0 0 1 1.4 1.2l1.6 6.3h-1.5V21"/>',
  metro: '<path d="M6 19V5l6 8 6-8v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.9-6 7.5-6s6.7 2.2 7.5 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
  ticket: '<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 0 0-4V4H4Z"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  store: '<path d="M4 9h16l-1-5H5ZM5 9v11h14V9M10 20v-5h4v5"/>',
  dir: '<path d="M5 12h12M13 6l6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  compose: '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
};

export function Icon({
  name,
  size = 16,
  stroke = "currentColor",
  fill = "none",
  strokeWidth = 2,
  className,
}: {
  name: string;
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      style={{ stroke }}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.star }}
    />
  );
}
