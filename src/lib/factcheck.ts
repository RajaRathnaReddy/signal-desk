/**
 * Automated fact-check heuristics.
 *
 * These checks never *prove* an article correct. They find claims in a draft that the supplied
 * sources do not support, and conflicts between the sources themselves, so a human editor can resolve them.
 * Everything is deterministic and runs without network access.
 */
import { KNOWN_ENTITIES } from "./constants";
import { stripMarkdown } from "./text";

export type Severity = "CRITICAL" | "WARNING" | "INFO";
export type FactCheckKind =
  | "UNSUPPORTED_NUMBER" | "UNSUPPORTED_DATE" | "UNSUPPORTED_QUOTE" | "SPECIFICATION_CONFLICT"
  | "NAME_MISMATCH" | "LINK_BROKEN" | "SPECULATION_AS_FACT" | "SOURCE_INCONSISTENCY";

export interface FactFlag { kind: FactCheckKind; severity: Severity; message: string; detail: string }

export interface SourceMaterial {
  publisher: string;
  title: string;
  /** Short excerpt/summary captured at ingestion, plus anything the editor pasted as notes. */
  text: string;
  url: string;
  tier: number;
  publishedAt?: Date | null;
  linkOk?: boolean | null;
}

export interface DraftText {
  title: string;
  deck: string;
  body: string;
  confidence: string;
  classification: string;
  /** Explainers carry no event claims; numeric/date support checks are relaxed for them. */
  evergreen?: boolean;
}

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
const UNITS = "GB|TB|MB|KB|GHz|MHz|W|kW|MW|GW|mAh|nm|TOPS|TFLOPS|PFLOPS|cores?|Hz|inch(?:es)?|%|percent|billion|million|trillion|x|fps|Gbps|Mbps|tokens?|parameters?|qubits?";

const NUM_RE = new RegExp(`(?:[$€£₹]\\s?)?\\d[\\d,]*(?:\\.\\d+)?\\s?(?:${UNITS})?`, "gi");
const DATE_RE = new RegExp(`\\b(?:(?:${MONTHS})\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+(?:${MONTHS})\\.?(?:\\s+\\d{4})?)\\b`, "g");

export function normaliseNumber(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[,\s]/g, "")
    .replace(/percent/, "%")
    .replace(/bn$/, "billion")
    .replace(/(\d)m$/, "$1million")
    .replace(/tokens?$/, "token")
    .replace(/parameters?$/, "parameter")
    .replace(/cores?$/, "core")
    .replace(/inch(es)?$/, "inch")
    .replace(/qubits?$/, "qubit")
    .replace(/\.0+(?=\D|$)/, "");
}

function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const raw = m[0].trim();
    out.push(normaliseNumber(raw));
  }
  return out;
}

/** Bare small integers ("two", "3") and calendar years are too noisy to verify individually. */
function isTrivial(n: string): boolean {
  if (/^(19|20)\d{2}$/.test(n)) return true;
  return /^\d{1,2}$/.test(n);
}

function corpusOf(sources: SourceMaterial[]): string {
  return sources.map((s) => `${s.publisher} ${s.title} ${s.text}`).join(" \n ");
}

function stripNumberPunct(s: string) {
  return s.toLowerCase().replace(/[,\s]/g, "");
}

export function checkUnsupportedNumbers(d: DraftText, sources: SourceMaterial[]): FactFlag[] {
  if (d.evergreen || !sources.length) return [];
  const corpus = stripNumberPunct(corpusOf(sources));
  const flags: FactFlag[] = [];
  const text = stripMarkdown(`${d.title}. ${d.deck}. ${d.body}`);
  const seen = new Set<string>();
  for (const raw of numbersIn(text)) {
    if (!raw || isTrivial(raw) || seen.has(raw)) continue;
    seen.add(raw);
    const core = raw.replace(/[^\d.]/g, "");
    const supported = corpus.includes(raw) || (core.length >= 3 && corpus.includes(core));
    if (!supported) {
      const isMoney = new RegExp(`[$€£₹]\\s?${core.replace(".", "\\.")}`).test(text);
      flags.push({
        kind: "UNSUPPORTED_NUMBER",
        severity: isMoney || /%|billion|million|trillion/.test(raw) ? "CRITICAL" : "WARNING",
        message: `The figure "${raw}" does not appear in any attached source.`,
        detail: "Every figure must be traceable to a source. Add the supporting source, correct the number, or remove it.",
      });
    }
  }
  return flags;
}

export function checkUnsupportedDates(d: DraftText, sources: SourceMaterial[]): FactFlag[] {
  if (d.evergreen || !sources.length) return [];
  const corpus = corpusOf(sources).toLowerCase();
  const flags: FactFlag[] = [];
  const text = stripMarkdown(`${d.deck}. ${d.body}`);
  const seen = new Set<string>();
  for (const m of text.matchAll(DATE_RE)) {
    const d1 = m[0].toLowerCase().replace(/\./g, "").replace(/,/g, "");
    if (seen.has(d1)) continue;
    seen.add(d1);
    const day = (d1.match(/\b\d{1,2}\b/) ?? [""])[0];
    const mon = (d1.match(/[a-z]{3,9}/) ?? [""])[0].slice(0, 3);
    const hit = corpus.includes(d1) || new RegExp(`(${mon}[a-z]*\\.?\\s+${day}\\b|\\b${day}\\s+${mon})`, "i").test(corpus) ||
      sources.some((s) => {
        if (!s.publishedAt) return false;
        const p = s.publishedAt;
        return p.getUTCDate() === Number(day) && p.toLocaleString("en", { month: "short", timeZone: "UTC" }).toLowerCase() === mon;
      });
    if (!hit) {
      flags.push({
        kind: "UNSUPPORTED_DATE",
        severity: "WARNING",
        message: `The date "${m[0]}" is not found in the sources or their publication dates.`,
        detail: "Confirm the date against the primary source.",
      });
    }
  }
  return flags;
}

export function extractQuotes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[“"]([^”"\n]{20,400})[”"]/g)) out.push(m[1].trim());
  return out;
}

function squash(s: string) {
  return s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function checkQuotes(d: DraftText, sources: SourceMaterial[]): FactFlag[] {
  const corpus = squash(corpusOf(sources));
  const flags: FactFlag[] = [];
  for (const q of extractQuotes(stripMarkdown(`${d.deck}. ${d.body}`))) {
    if (!corpus.includes(squash(q))) {
      flags.push({
        kind: "UNSUPPORTED_QUOTE",
        severity: "CRITICAL",
        message: `Quotation could not be matched to a source: “${q.slice(0, 80)}${q.length > 80 ? "…" : ""}”`,
        detail: "Quotes must be verbatim and traceable. Paste the source passage into the source notes or remove the quote.",
      });
    }
  }
  return flags;
}

const DEFINITIVE_FUTURE = /\b(?:will|is going to|are going to)\s+(?:launch|release|unveil|announce|ship|introduce|acquire|buy|reveal|debut)\b/i;
const HEDGES = /\b(?:reportedly|according to|said|says|plans? to|planned|expected|may|might|could|is reported|were reported|unconfirmed|not confirmed|has not confirmed|rumou?r|people familiar|claims?)\b/i;

export function checkSpeculation(d: DraftText): FactFlag[] {
  if (d.confidence === "VERIFIED" && !["RUMOR", "REPORT"].includes(d.classification)) return [];
  const flags: FactFlag[] = [];
  const text = stripMarkdown(`${d.title}. ${d.deck}. ${d.body}`);
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (DEFINITIVE_FUTURE.test(sentence) && !HEDGES.test(sentence)) {
      flags.push({
        kind: "SPECULATION_AS_FACT",
        severity: "CRITICAL",
        message: `Possible speculation stated as fact: “${sentence.slice(0, 120)}${sentence.length > 120 ? "…" : ""}”`,
        detail: "This story is not marked VERIFIED. Attribute the claim to its source and use hedged language.",
      });
    }
  }
  return flags;
}

export function checkEntities(d: DraftText, sources: SourceMaterial[]): FactFlag[] {
  if (d.evergreen || !sources.length) return [];
  const corpus = corpusOf(sources).toLowerCase();
  const text = stripMarkdown(`${d.title}. ${d.body}`);
  const flags: FactFlag[] = [];
  for (const e of KNOWN_ENTITIES) {
    const re = new RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text) && !corpus.includes(e.toLowerCase())) {
      flags.push({
        kind: "NAME_MISMATCH",
        severity: "WARNING",
        message: `"${e}" appears in the article but not in any attached source.`,
        detail: "Check that the company or product is relevant to this story and correctly named.",
      });
    }
  }
  return flags;
}

const SPEC_RE = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s?(GB|TB|MB|GHz|MHz|mAh|nm|TOPS|TFLOPS|cores?|Hz|inch(?:es)?|fps|Gbps|Mbps|qubits?|billion|million|trillion|%)`, "gi");

/** Detect when attached sources give *different* values for the same unit class — e.g. "32GB" vs "64GB". */
export function checkSourceConflicts(sources: SourceMaterial[]): FactFlag[] {
  if (sources.length < 2) return [];
  const byUnit = new Map<string, Map<string, Set<string>>>();
  for (const s of sources) {
    const text = `${s.title} ${s.text}`;
    for (const m of text.matchAll(SPEC_RE)) {
      const unit = m[2].toLowerCase().replace(/s$/, "").replace(/inches/, "inch");
      if (unit === "%" || unit === "billion" || unit === "million" || unit === "trillion") continue; // too context dependent
      const val = m[1].replace(/,/g, "").replace(/\.0+$/, "");
      if (!byUnit.has(unit)) byUnit.set(unit, new Map());
      const per = byUnit.get(unit)!;
      if (!per.has(s.publisher)) per.set(s.publisher, new Set());
      per.get(s.publisher)!.add(val);
    }
  }
  const flags: FactFlag[] = [];
  for (const [unit, per] of byUnit) {
    if (per.size < 2) continue;
    const sets = [...per.values()];
    const all = new Set(sets.flatMap((s) => [...s]));
    const common = [...all].filter((v) => sets.every((s) => s.has(v)));
    if (common.length === 0) {
      const detail = [...per.entries()].map(([p, v]) => `${p}: ${[...v].join(", ")} ${unit}`).join(" · ");
      flags.push({
        kind: "SPECIFICATION_CONFLICT",
        severity: "WARNING",
        message: `Sources disagree on a ${unit} value.`,
        detail: `${detail}. Resolve against the primary source and say so in the article if the disagreement persists.`,
      });
    }
  }
  return flags;
}

export function checkLinks(sources: SourceMaterial[]): FactFlag[] {
  return sources
    .filter((s) => s.linkOk === false)
    .map((s) => ({
      kind: "LINK_BROKEN" as const,
      severity: "WARNING" as const,
      message: `Source link is not reachable: ${s.publisher}`,
      detail: s.url,
    }));
}

export function runFactChecks(d: DraftText, sources: SourceMaterial[]): FactFlag[] {
  return [
    ...checkSpeculation(d),
    ...checkQuotes(d, sources),
    ...checkUnsupportedNumbers(d, sources),
    ...checkUnsupportedDates(d, sources),
    ...checkEntities(d, sources),
    ...checkSourceConflicts(sources),
    ...checkLinks(sources),
  ];
}
