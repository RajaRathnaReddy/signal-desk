/**
 * Editorial QC engine and final publishing gate.
 *
 * Pure functions: given an article snapshot, they return a checklist, a 100-point quality score and a list of
 * blocking reasons. Nothing here can publish anything — the publishing action in `workflow.ts` calls
 * `evaluateGate` and refuses to proceed unless a human with an editor role triggers it.
 */
import { LABELLED_UNCERTAIN, MIN_PUBLISH_SCORE } from "./constants";
import { jaccard, readingMinutes, stripMarkdown, tokens, wordCount } from "./text";
import type { FactFlag, SourceMaterial } from "./factcheck";

export interface QcArticle {
  title: string;
  slug: string;
  deck: string;
  seoTitle: string;
  metaDescription: string;
  bodyMd: string;
  keyTakeaways: string[];
  whyItMatters: string;
  contextMd: string;
  classification: string;
  confidence: string;
  hasCategory: boolean;
  hasAuthor: boolean;
}

export interface QcImage {
  url: string;
  alt: string;
  caption: string;
  kind: string;
  status: string;
  depictsRealEvent: boolean;
  credit: string;
}

export interface QcInput {
  article: QcArticle;
  sources: SourceMaterial[];
  image: QcImage | null;
  factChecks: Pick<FactFlag, "severity" | "kind" | "message">[] & { resolved?: boolean }[];
  unresolvedCritical: number;
  unresolvedWarnings: number;
  duplicateOfLiveArticle: boolean;
  evergreen: boolean;
}

export interface CheckItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  critical: boolean;
  note?: string;
}

export interface QcReport {
  score: number;
  breakdown: Record<string, { got: number; max: number; note?: string }>;
  checklist: CheckItem[];
  criticalFailures: string[];
  passes: boolean;
  generatedAt: string;
}

/** Phrases that read as machine-written or promotional. Flagged, not auto-edited. */
export const BANNED_PHRASES = [
  "here's what you need to know", "here’s what you need to know", "exciting times", "groundbreaking", "game changer", "game-changer",
  "paradigm-shifting", "paradigm shift", "rapidly evolving landscape", "revolutioniz", "unprecedented", "transformative",
  "delve", "in today's fast-paced", "in today’s fast-paced", "cutting-edge", "unlock the power", "as an ai", "ai-generated analysis",
  "our ai", "buckle up", "the future is here", "it's important to note", "it’s important to note", "tapestry", "ever-changing",
  "you won't believe", "you won’t believe", "this changes everything", "broke the internet", "mind-blowing",
];

const CLICKBAIT = /(you won['’]t believe|this changes everything|broke the internet|shocking|mind-?blowing|\bjust (?:dropped|broke)\b|!{2,})/i;

export function findBannedPhrases(text: string): string[] {
  const t = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => t.includes(p));
}

function sentences(text: string): string[] {
  return stripMarkdown(text).split(/(?<=[.!?])\s+/).filter((s) => s.length > 3);
}

export function repeatedOpenings(text: string): number {
  const paras = text.split(/\n{2,}/).map((p) => stripMarkdown(p)).filter((p) => p.length > 40);
  const starts = paras.map((p) => p.split(/\s+/).slice(0, 2).join(" ").toLowerCase());
  const counts = new Map<string, number>();
  for (const s of starts) counts.set(s, (counts.get(s) ?? 0) + 1);
  let repeats = 0;
  for (const c of counts.values()) if (c > 2) repeats += c - 2;
  return repeats;
}

export function duplicateParagraphs(text: string): number {
  const paras = text.split(/\n{2,}/).map((p) => tokens(stripMarkdown(p))).filter((p) => p.length > 8);
  let dup = 0;
  for (let i = 0; i < paras.length; i++) for (let j = i + 1; j < paras.length; j++) if (jaccard(paras[i], paras[j]) > 0.7) dup++;
  return dup;
}

function shingles(text: string, n = 5): Set<string> {
  const t = tokens(stripMarkdown(text));
  const out = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n).join(" "));
  return out;
}

/** Share of the article's 5-word sequences that also occur in any single source. High values indicate copying. */
export function copyRatio(body: string, sources: SourceMaterial[]): number {
  const mine = shingles(body);
  if (!mine.size) return 0;
  let worst = 0;
  for (const s of sources) {
    const theirs = shingles(`${s.title}. ${s.text}`);
    let hit = 0;
    for (const sh of mine) if (theirs.has(sh)) hit++;
    worst = Math.max(worst, hit / mine.size);
  }
  return worst;
}

export function evaluateQc(input: QcInput): QcReport {
  const { article: a, sources, image, evergreen } = input;
  const checklist: CheckItem[] = [];
  const criticalFailures: string[] = [];
  const add = (c: CheckItem) => {
    checklist.push(c);
    if (c.critical && c.status === "fail") criticalFailures.push(c.label + (c.note ? ` — ${c.note}` : ""));
  };

  const fullText = `${a.deck}\n\n${a.bodyMd}\n\n${a.whyItMatters}\n\n${a.contextMd}`;
  const words = wordCount(a.bodyMd);
  const tier1 = sources.filter((s) => s.tier === 1).length;
  const tier2 = sources.filter((s) => s.tier === 2).length;
  const reputable = tier1 + tier2;
  const banned = findBannedPhrases(`${a.title} ${fullText}`);
  const copy = copyRatio(a.bodyMd, sources);
  const uncertain = a.confidence === "UNCONFIRMED" || a.confidence === "RUMOR" || a.confidence === "LIKELY";
  const labelled = LABELLED_UNCERTAIN.includes(a.classification as never);

  // ── Source & claim checks ───────────────────────────────────────────────
  add({ id: "sources-present", label: "Source references are available", status: sources.length ? "pass" : "fail", critical: !evergreen || sources.length === 0 && !evergreen });
  add({
    id: "source-legit", label: "At least one legitimate (Tier 1 or Tier 2) source",
    status: reputable ? "pass" : "fail", critical: !evergreen,
    note: reputable ? undefined : "Only lead-level or no sources attached.",
  });
  add({
    id: "multi-source", label: "Major claims are corroborated by more than one source",
    status: tier1 >= 1 || reputable >= 2 ? "pass" : "warn", critical: false,
    note: tier1 >= 1 || reputable >= 2 ? undefined : "Single reputable source. Acceptable only for non-contested reporting.",
  });
  add({
    id: "links-working", label: "Source links are working",
    status: sources.some((s) => s.linkOk === false) ? "fail" : sources.every((s) => s.linkOk === true) ? "pass" : "warn",
    critical: false,
    note: sources.some((s) => s.linkOk == null) ? "Some links have not been checked yet." : undefined,
  });
  add({
    id: "facts-supported", label: "Claims are supported (no unresolved critical fact-check flags)",
    status: input.unresolvedCritical ? "fail" : input.unresolvedWarnings ? "warn" : "pass", critical: true,
    note: input.unresolvedCritical ? `${input.unresolvedCritical} critical flag(s) open` : input.unresolvedWarnings ? `${input.unresolvedWarnings} warning(s) open` : undefined,
  });
  add({
    id: "confidence-ok", label: "Editorial confidence permits publication",
    status: a.confidence === "DO NOT PUBLISH" ? "fail" : "pass", critical: true,
  });
  add({
    id: "uncertain-labelled", label: "Unverified information is labelled for readers",
    status: !uncertain || a.confidence === "LIKELY" || labelled ? "pass" : "fail", critical: true,
    note: uncertain && a.confidence !== "LIKELY" && !labelled ? "UNCONFIRMED/RUMOR stories must be classified RUMOR or REPORT so the label is shown." : undefined,
  });
  add({ id: "not-duplicate", label: "Story is not a duplicate of an already-published article", status: input.duplicateOfLiveArticle ? "fail" : "pass", critical: false, note: input.duplicateOfLiveArticle ? "Update the existing article instead." : undefined });
  add({ id: "original", label: "Article is original (not a rewrite of one source)", status: copy > 0.35 ? "fail" : copy > 0.2 ? "warn" : "pass", critical: copy > 0.35, note: `${Math.round(copy * 100)}% five-word overlap with the closest source` });

  // ── Language & structure ────────────────────────────────────────────────
  add({ id: "headline-accurate", label: "Headline is informative, not clickbait", status: CLICKBAIT.test(a.title) || (a.title === a.title.toUpperCase() && a.title.length > 12) ? "fail" : "pass", critical: false });
  add({ id: "no-ai-phrasing", label: "No machine-style or promotional wording", status: banned.length ? "fail" : "pass", critical: false, note: banned.length ? `Found: ${banned.slice(0, 5).join(", ")}` : undefined });
  const dupP = duplicateParagraphs(a.bodyMd);
  const repOpen = repeatedOpenings(a.bodyMd);
  add({ id: "no-repetition", label: "No repetitive paragraphs or openings", status: dupP || repOpen ? "fail" : "pass", critical: false, note: dupP || repOpen ? `${dupP} near-duplicate paragraph pair(s), ${repOpen} repeated opening(s)` : undefined });
  add({ id: "substance", label: "Article has enough substance", status: words >= (evergreen ? 500 : 180) ? "pass" : "fail", critical: words < 60, note: `${words} words` });
  add({ id: "context", label: "Provides context and says what is unknown", status: a.whyItMatters.trim().length > 40 && (a.contextMd.trim().length > 40 || /unknown|unclear|not (?:yet )?(?:confirmed|disclosed|said|clear)|remains to be|has not/i.test(fullText)) ? "pass" : "warn", critical: false });

  // ── Image ───────────────────────────────────────────────────────────────
  add({ id: "image-present", label: "Hero image is attached", status: image ? "pass" : "fail", critical: false });
  add({ id: "image-approved", label: "Image passed authenticity & relevance review", status: image?.status === "APPROVED" ? "pass" : "fail", critical: false });
  add({ id: "image-alt", label: "Image has alt text and caption", status: image && image.alt.trim().length >= 10 && image.caption.trim().length >= 5 ? "pass" : "fail", critical: false });
  const misleading = !!image && image.depictsRealEvent && (image.kind === "ILLUSTRATION" || image.kind === "CONCEPTUAL");
  add({ id: "image-honest", label: "Image does not misrepresent a real event", status: misleading ? "fail" : "pass", critical: misleading, note: misleading ? "A conceptual image is flagged as depicting a real event." : undefined });
  add({ id: "image-credit", label: "Image credit/licence recorded", status: image && (image.kind === "ILLUSTRATION" || image.kind === "CONCEPTUAL" || image.credit.trim()) ? "pass" : "warn", critical: false });

  // ── SEO ─────────────────────────────────────────────────────────────────
  add({ id: "seo-title", label: "SEO title ≤ 65 characters", status: a.seoTitle.trim() && a.seoTitle.length <= 65 ? "pass" : "fail", critical: false });
  add({ id: "seo-meta", label: "Meta description 70–160 characters", status: a.metaDescription.length >= 70 && a.metaDescription.length <= 160 ? "pass" : "fail", critical: false });
  add({ id: "seo-slug", label: "Clean URL slug", status: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) && a.slug.length >= 8 ? "pass" : "fail", critical: false });
  add({ id: "metadata", label: "Category and byline assigned", status: a.hasCategory && a.hasAuthor ? "pass" : "fail", critical: true });

  // ── Score ───────────────────────────────────────────────────────────────
  const breakdown: QcReport["breakdown"] = {};
  const sourceScore = evergreen && !reputable ? (sources.length ? 14 : 8) : tier1 >= 1 && reputable >= 2 ? 20 : tier1 >= 1 ? 18 : reputable >= 2 ? 17 : reputable === 1 ? 12 : 0;
  breakdown["Source reliability"] = { got: sourceScore, max: 20 };
  const factScore = input.unresolvedCritical ? 0 : Math.max(0, 20 - input.unresolvedWarnings * 4);
  breakdown["Fact accuracy"] = { got: factScore, max: 20, note: `${input.unresolvedWarnings} open warning(s)` };
  const origScore = copy > 0.35 ? 0 : Math.round(15 * (1 - Math.max(0, copy - 0.05) / 0.3));
  breakdown["Originality"] = { got: Math.max(0, Math.min(15, origScore)), max: 15 };
  const sl = sentences(a.bodyMd);
  const avgLen = sl.length ? sl.reduce((n, s) => n + s.split(/\s+/).length, 0) / sl.length : 0;
  let clarity = 15;
  clarity -= Math.min(6, banned.length * 2);
  clarity -= Math.min(4, dupP * 2 + repOpen);
  if (avgLen > 28) clarity -= 3;
  if (words < (evergreen ? 500 : 180)) clarity -= 3;
  breakdown["Editorial clarity"] = { got: Math.max(0, clarity), max: 15, note: `avg sentence ${Math.round(avgLen)} words` };
  const ctx = (a.whyItMatters.trim().length > 40 ? 4 : 0) + (a.contextMd.trim().length > 40 || /unknown|unclear|not (?:yet )?(?:confirmed|disclosed)|remains to be/i.test(fullText) ? 3 : 0) + (a.keyTakeaways.length >= 2 ? 3 : a.keyTakeaways.length ? 1 : 0);
  breakdown["Context"] = { got: ctx, max: 10 };
  const hl = (CLICKBAIT.test(a.title) ? 0 : 3) + (a.title.length >= 30 && a.title.length <= 110 ? 2 : 0);
  breakdown["Headline accuracy"] = { got: hl, max: 5 };
  const seo = (a.seoTitle && a.seoTitle.length <= 65 ? 2 : 0) + (a.metaDescription.length >= 70 && a.metaDescription.length <= 160 ? 2 : 0) + (checklist.find((c) => c.id === "seo-slug")?.status === "pass" ? 1 : 0);
  breakdown["SEO"] = { got: seo, max: 5 };
  const img = image ? (image.status === "APPROVED" ? 3 : 1) + (image.alt.length >= 10 && image.caption.length >= 5 ? 2 : 0) : 0;
  breakdown["Image quality & relevance"] = { got: Math.min(5, img), max: 5 };
  const read = (avgLen >= 8 && avgLen <= 26 ? 3 : 1) + (readingMinutes(a.bodyMd) >= 1 ? 2 : 0);
  breakdown["Readability"] = { got: Math.min(5, read), max: 5 };

  const score = Object.values(breakdown).reduce((n, b) => n + b.got, 0);
  return {
    score,
    breakdown,
    checklist,
    criticalFailures,
    passes: criticalFailures.length === 0 && score >= MIN_PUBLISH_SCORE,
    generatedAt: new Date().toISOString(),
  };
}

// ── Final publishing gate ───────────────────────────────────────────────────

export interface GateInput {
  qc: QcReport;
  confidence: string;
  classification: string;
  approvals: { FACT_CHECK: boolean; EDITOR: boolean; IMAGE: boolean; SEO: boolean };
  actorIsHuman: boolean;
  actorCanPublish: boolean;
  sourcesCount: number;
  hasImageApproved: boolean;
  unresolvedCritical: number;
}

export interface GateResult {
  allowed: boolean;
  questions: { n: number; q: string; ok: boolean; critical: boolean }[];
  blockers: string[];
}

export function evaluateGate(g: GateInput): GateResult {
  const byId = (id: string) => g.qc.checklist.find((c) => c.id === id);
  const ok = (id: string) => byId(id)?.status === "pass" || byId(id)?.status === "warn";
  const questions = [
    { n: 1, q: "Is the story real?", ok: g.confidence !== "DO NOT PUBLISH" && g.unresolvedCritical === 0, critical: true },
    { n: 2, q: "Is the source trustworthy?", ok: ok("source-legit"), critical: true },
    { n: 3, q: "Is the information current?", ok: g.approvals.FACT_CHECK, critical: true },
    { n: 4, q: "Are the important facts verified?", ok: g.approvals.FACT_CHECK && ok("facts-supported") && byId("facts-supported")?.status !== "fail", critical: true },
    { n: 5, q: "Are claims correctly attributed?", ok: g.sourcesCount > 0 && g.unresolvedCritical === 0, critical: true },
    { n: 6, q: "Are rumors clearly labelled?", ok: ok("uncertain-labelled"), critical: true },
    { n: 7, q: "Is the headline accurate?", ok: ok("headline-accurate"), critical: true },
    { n: 8, q: "Is the article original?", ok: ok("original"), critical: true },
    { n: 9, q: "Is it easy to understand?", ok: ok("no-ai-phrasing") && ok("no-repetition") && ok("substance"), critical: false },
    { n: 10, q: "Does it provide useful context?", ok: ok("context"), critical: false },
    { n: 11, q: "Is the image relevant?", ok: g.hasImageApproved && g.approvals.IMAGE, critical: true },
    { n: 12, q: "Could the image mislead the reader?", ok: ok("image-honest"), critical: true },
    { n: 13, q: "Are source links available?", ok: g.sourcesCount > 0, critical: true },
    { n: 14, q: "Is SEO complete?", ok: ok("seo-title") && ok("seo-meta") && ok("seo-slug") && g.approvals.SEO, critical: true },
    { n: 15, q: "Does the article feel professionally edited?", ok: g.approvals.EDITOR && g.qc.score >= MIN_PUBLISH_SCORE, critical: true },
  ];
  const blockers: string[] = [];
  if (!g.actorIsHuman) blockers.push("Automation cannot publish. A human editor must trigger publication.");
  else if (!g.actorCanPublish) blockers.push("Your role cannot publish articles.");
  if (g.qc.criticalFailures.length) blockers.push(...g.qc.criticalFailures.map((c) => `Critical: ${c}`));
  if (g.qc.score < MIN_PUBLISH_SCORE) blockers.push(`Quality score ${g.qc.score} is below the ${MIN_PUBLISH_SCORE} minimum.`);
  for (const q of questions) if (!q.ok && q.critical) blockers.push(`Gate ${q.n}: ${q.q}`);
  return { allowed: blockers.length === 0, questions, blockers: [...new Set(blockers)] };
}
