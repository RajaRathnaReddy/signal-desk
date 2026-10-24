/**
 * Abstract typographic composition used only where a story has no approved image.
 * Deterministic from the slug, purely geometric, carries no text and makes no claim about the story —
 * it is decoration, and is marked decorative for assistive technology.
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
  const bars = Array.from({ length: 14 }, (_, i) => ({ x: 40 + i * 52, h: 60 + rnd() * 300, o: 0.15 + rnd() * 0.65 }));
  const dot = { x: 120 + rnd() * 520, y: 70 + rnd() * 160, r: 18 + rnd() * 34 };
  return (
    <svg className="art" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="800" height="450" fill="var(--ink)" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={410 - b.h} width="30" height={b.h} fill="var(--bg)" opacity={b.o} />
      ))}
      <circle cx={dot.x} cy={dot.y} r={dot.r} fill="var(--accent)" />
      <line x1="0" y1="410" x2="800" y2="410" stroke="var(--bg)" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}
