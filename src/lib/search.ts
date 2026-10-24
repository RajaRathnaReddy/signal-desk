/** In-memory typo-tolerant search. Works identically on SQLite and PostgreSQL; swap for OpenSearch at scale. */
import { levenshtein, tokens } from "./text";

export interface SearchDoc {
  id: string;
  title: string;
  deck: string;
  body: string;
  tags: string[];
  companies: string[];
  category: string;
  publishedAt: Date | null;
}

const SYNONYMS: Record<string, string[]> = {
  llm: ["model", "language", "gpt", "gemini", "claude"],
  gpu: ["graphics", "nvidia", "accelerator", "chip"],
  chip: ["semiconductor", "processor", "silicon"],
  cpu: ["processor", "chip"],
  ai: ["artificial", "intelligence", "machine", "learning"],
  vuln: ["vulnerability", "cve", "exploit"],
  cve: ["vulnerability", "security", "patch"],
  quantum: ["qubit"],
  ev: ["electric", "vehicle"],
  vr: ["virtual", "reality", "xr"],
  ar: ["augmented", "reality", "xr"],
  oss: ["open", "source"],
  agent: ["agents", "agentic"],
  cloud: ["aws", "azure", "infrastructure"],
};

export function expandQuery(q: string): { terms: string[]; related: string[] } {
  const terms = tokens(q);
  const related = new Set<string>();
  for (const t of terms) for (const r of SYNONYMS[t] ?? []) related.add(r);
  return { terms, related: [...related] };
}

function fieldScore(term: string, words: string[], tolerant: boolean): number {
  let best = 0;
  for (const w of words) {
    if (w === term) return 1;
    if (w.startsWith(term) && term.length >= 3) best = Math.max(best, 0.8);
    else if (tolerant && term.length >= 5 && Math.abs(w.length - term.length) <= 2) {
      const d = levenshtein(term, w, 2);
      if (d <= (term.length >= 8 ? 2 : 1)) best = Math.max(best, d === 1 ? 0.6 : 0.45);
    }
  }
  return best;
}

export function searchDocs(docs: SearchDoc[], query: string, now = new Date()): { doc: SearchDoc; score: number }[] {
  const { terms, related } = expandQuery(query);
  if (!terms.length) return [];
  const results: { doc: SearchDoc; score: number }[] = [];
  for (const doc of docs) {
    const title = tokens(doc.title);
    const deck = tokens(doc.deck);
    const body = tokens(doc.body);
    const meta = tokens(`${doc.tags.join(" ")} ${doc.companies.join(" ")} ${doc.category}`);
    let score = 0;
    let matched = 0;
    for (const t of terms) {
      const s = fieldScore(t, title, true) * 5 + fieldScore(t, meta, true) * 4 + fieldScore(t, deck, true) * 2.5 + fieldScore(t, body, false) * 1;
      if (s > 0) matched++;
      score += s;
    }
    for (const r of related) score += (fieldScore(r, title, false) * 1.2 + fieldScore(r, meta, false) * 1 + fieldScore(r, body, false) * 0.3) * 0.5;
    if (!matched) continue;
    score *= 0.5 + 0.5 * (matched / terms.length);
    if (doc.publishedAt) {
      const days = (now.getTime() - doc.publishedAt.getTime()) / 86_400_000;
      score *= 1 + Math.max(0, 0.15 - days * 0.005);
    }
    results.push({ doc, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

/** "Did you mean": closest vocabulary word for the first unmatched term. */
export function suggest(docs: SearchDoc[], query: string): string | null {
  const vocab = new Set<string>();
  for (const d of docs) for (const t of tokens(`${d.title} ${d.tags.join(" ")} ${d.companies.join(" ")}`)) vocab.add(t);
  const out: string[] = [];
  let changed = false;
  for (const term of tokens(query)) {
    if (vocab.has(term) || term.length < 4) {
      out.push(term);
      continue;
    }
    let best: string | null = null;
    let bd = 3;
    for (const v of vocab) {
      const d = levenshtein(term, v, 2);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (best && bd <= 2) {
      out.push(best);
      changed = true;
    } else out.push(term);
  }
  return changed ? out.join(" ") : null;
}
