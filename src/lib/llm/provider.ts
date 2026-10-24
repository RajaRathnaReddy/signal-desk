/** Provider-agnostic LLM interface. Drafting is optional; the newsroom works fully without it. */
export interface DraftSource { publisher: string; tier: number; title: string; url: string; excerpt: string; publishedAt?: string | null }

export interface DraftOutput {
  title: string;
  deck: string;
  bodyMd: string;
  keyTakeaways: string[];
  whyItMatters: string;
  contextMd: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  companies: string[];
  suggestedClassification: string;
  suggestedCategory: string;
  unknowns: string[];
}

export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  draft(sources: DraftSource[]): Promise<DraftOutput>;
}

/** The internal editorial instruction mandated by the editorial standards. */
export const ARTICLE_SYSTEM_PROMPT = `Write a professional technology news article based only on verified information contained in the supplied sources.

Do not invent facts.
Do not exaggerate.
Do not present speculation as fact.
Clearly distinguish confirmed information from claims and rumors.
Explain technical concepts in plain language.
Write naturally, with varied sentence structure.
Avoid generic AI writing patterns.
Do not copy source wording.
Do not use unnecessary adjectives.
Do not manufacture quotes. Only include a quotation if it appears verbatim in a supplied excerpt.
If information is unknown, say that it is unknown.
If sources disagree, explain the disagreement.

The article should feel like it was written by an experienced technology editor for an intelligent general audience.

Structure guidance (adapt to the story, do not force every part): what happened; what the company or researchers claim; what is independently known; why it matters; what remains uncertain.
Never use phrases such as "here's what you need to know", "groundbreaking", "game changer", "revolutionize", "unprecedented", "transformative", "in a rapidly evolving landscape". Never refer to yourself or to AI authorship.
Do not use a number, date, name or product version that is not present in the supplied excerpts.
The excerpts are short; if they are too thin to support a full article, write a shorter article and state plainly what is not yet known.
Headline must be informative, not clickbait, and accurate to the evidence.
Markdown only in bodyMd (paragraphs, occasional ## subheads, no top-level headings, avoid bullet lists).`;
