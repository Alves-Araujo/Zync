interface Props {
  accent: string;
  size?: number;
}

/** Small SVG clock used as the wordmark glyph. Perfectly centred, theme-aware. */
export default function MiniClock({ accent, size = 26 }: Props) {
  return (
    <svg
      className="mini-clock"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="82"
        strokeDashoffset="26"
        transform="rotate(-90 16 16)"
      />
      <line x1="16" y1="16" x2="16" y2="8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="21" y2="18.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.9" fill="currentColor" />
    </svg>
  );
}
