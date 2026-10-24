/** Duplicate / near-duplicate story detection and clustering. Pure functions. */
import { KNOWN_ENTITIES } from "./constants";
import { jaccard, tokens } from "./text";

export interface Candidate {
  title: string;
  snippet?: string;
  url?: string;
  entities?: string[];
}

export function detectEntities(text: string): string[] {
  const out: string[] = [];
  for (const e of KNOWN_ENTITIES) {
    const re = new RegExp(`(?<![A-Za-z0-9])${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i");
    if (re.test(text)) out.push(e);
  }
  return out;
}

/** Strip tracking parameters and fragments so the same URL from two feeds compares equal. */
export function canonicalUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) x.searchParams.delete(k);
    x.hostname = x.hostname.replace(/^www\./, "");
    return x.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

export interface Similarity { score: number; reasons: string[] }

/**
 * Combines headline similarity, body overlap, shared entities and identical URLs.
 * Scores ≥ 0.55 are treated as the same event.
 */
export function similarity(a: Candidate, b: Candidate): Similarity {
  const reasons: string[] = [];
  if (a.url && b.url && canonicalUrl(a.url) === canonicalUrl(b.url)) return { score: 1, reasons: ["Same URL"] };
  const ta = tokens(a.title);
  const tb = tokens(b.title);
  const head = jaccard(ta, tb);
  const body = jaccard(tokens(`${a.title} ${a.snippet ?? ""}`), tokens(`${b.title} ${b.snippet ?? ""}`));
  const ea = new Set((a.entities ?? detectEntities(`${a.title} ${a.snippet ?? ""}`)).map((e) => e.toLowerCase()));
  const eb = new Set((b.entities ?? detectEntities(`${b.title} ${b.snippet ?? ""}`)).map((e) => e.toLowerCase()));
  const sharedEntities = [...ea].filter((e) => eb.has(e));
  const entityOverlap = ea.size && eb.size ? sharedEntities.length / Math.min(ea.size, eb.size) : 0;

  // Same company alone is not same event; require real text overlap on top of it.
  const hasTextOverlap = head >= 0.14 || body >= 0.14;
  let score = head * 0.45 + body * 0.35 + (hasTextOverlap ? entityOverlap * 0.2 : entityOverlap * 0.05);
  if (head >= 0.6) reasons.push("Near-identical headlines");
  else if (head >= 0.28) reasons.push("Similar headlines");
  if (body >= 0.25) reasons.push("Similar summaries");
  if (sharedEntities.length) reasons.push(`Shared: ${sharedEntities.join(", ")}`);

  // Distinctive shared tokens (versions, numbers, or rare technical terms in both headlines)
  const distinct = ta.filter((t) => (/\d/.test(t) || t.length >= 6) && tb.includes(t) && !["update", "report", "announces", "launches", "releases"].includes(t));
  if (distinct.length && (sharedEntities.length || head >= 0.18)) {
    score += Math.min(0.2, distinct.length * 0.08);
    reasons.push(`Same identifier: ${distinct.join(", ")}`);
  }
  return { score: Math.min(1, score), reasons };
}

export const SAME_EVENT_THRESHOLD = 0.5;

export function isSameEvent(a: Candidate, b: Candidate): boolean {
  return similarity(a, b).score >= SAME_EVENT_THRESHOLD;
}

/** Greedy clustering for a batch; returns groups of indexes. */
export function clusterCandidates(items: Candidate[]): number[][] {
  const groups: number[][] = [];
  items.forEach((item, i) => {
    let best = -1;
    let bestScore = 0;
    groups.forEach((g, gi) => {
      const s = Math.max(...g.map((j) => similarity(item, items[j]).score));
      if (s >= SAME_EVENT_THRESHOLD && s > bestScore) {
        best = gi;
        bestScore = s;
      }
    });
    if (best >= 0) groups[best].push(i);
    else groups.push([i]);
  });
  return groups;
}
