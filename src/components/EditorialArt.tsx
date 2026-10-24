/**
 * High-tech abstract schematic composition used where a story has no approved image.
 * Deterministic from the slug, purely geometric, carries no text and makes no claim about the story —
 * marked decorative for assistive technology.
 */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function EditorialArt({ seed }: { seed: string }) {
  let h = hash(seed);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>> 0) % 10000) / 10000;
  };

  const id = `art-grad-${hash(seed)}`;
  const bars = Array.from({ length: 16 }, (_, i) => ({
    x: 30 + i * 48,
    h: 50 + rnd() * 260,
    o: 0.15 + rnd() * 0.5,
  }));
  const node = { x: 180 + rnd() * 440, y: 80 + rnd() * 180, r: 16 + rnd() * 22 };

  return (
    <svg className="art" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="800" y2="450" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0b101e" />
          <stop offset="50%" stopColor="#141c2e" />
          <stop offset="100%" stopColor="#07090e" />
        </linearGradient>
        <pattern id={`grid-${id}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <radialGradient id={`glow-${id}`} cx={node.x} cy={node.y} r="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Futuristic Background Canvas */}
      <rect width="800" height="450" fill={`url(#${id})`} />
      <rect width="800" height="450" fill={`url(#grid-${id})`} />

      {/* Luminous Ambient Glow */}
      <rect width="800" height="450" fill={`url(#glow-${id})`} />

      {/* Spectrum Wave bars */}
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={410 - b.h}
          width="24"
          height={b.h}
          rx="4"
          fill="var(--accent)"
          opacity={b.o}
        />
      ))}

      {/* Telemetry Axis */}
      <line x1="0" y1="410" x2="800" y2="410" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 8" />
      <line x1="0" y1="260" x2="800" y2="260" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 8" />

      {/* Key Signal Node */}
      <circle cx={node.x} cy={node.y} r={node.r * 2} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
      <circle cx={node.x} cy={node.y} r={node.r} fill="var(--accent)" opacity="0.8" />
      <circle cx={node.x} cy={node.y} r="4" fill="#ffffff" />
    </svg>
  );
}
