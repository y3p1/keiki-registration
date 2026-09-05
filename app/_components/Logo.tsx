// Keiki Coders honu mark — a top-down Hawaiian sea-turtle whose shell carries a
// </> code glyph. Original, brand-colored placeholder until the client ships real logo art.
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 40) / 44} viewBox="0 0 44 40" fill="none" aria-hidden="true">
      {/* flippers */}
      <ellipse cx="9" cy="15" rx="5" ry="3.4" transform="rotate(-35 9 15)" fill="#0F5740" />
      <ellipse cx="35" cy="15" rx="5" ry="3.4" transform="rotate(35 35 15)" fill="#0F5740" />
      <ellipse cx="10" cy="32" rx="4.8" ry="3.1" transform="rotate(32 10 32)" fill="#0F5740" />
      <ellipse cx="34" cy="32" rx="4.8" ry="3.1" transform="rotate(-32 34 32)" fill="#0F5740" />
      {/* head */}
      <circle cx="22" cy="7" r="4.6" fill="#197A5A" />
      <circle cx="20.2" cy="6.2" r="0.85" fill="#fff" />
      <circle cx="23.8" cy="6.2" r="0.85" fill="#fff" />
      {/* shell */}
      <ellipse cx="22" cy="23" rx="13.5" ry="12" fill="#197A5A" />
      <ellipse cx="22" cy="23" rx="9.6" ry="8.4" fill="none" stroke="#2E9E74" strokeWidth="1.4" />
      {/* </> code glyph */}
      <path
        d="M18 20.4 L15.4 23 L18 25.6 M26 20.4 L28.6 23 L26 25.6"
        stroke="#EAF6F9"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
