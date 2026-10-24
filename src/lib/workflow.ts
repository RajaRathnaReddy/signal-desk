/**
 * Editorial workflow: COLLECTED → RESEARCHING → DRAFT → FACT CHECK → EDITOR REVIEW → IMAGE REVIEW → SEO REVIEW → SCHEDULED/PUBLISHED → UPDATED.
 *
 * Every transition is recorded as a PublishingEvent and every content change as an ArticleVersion.
 * `advance()` is the only path to publication and always runs the QC gate.
 */
import { db } from "./db";
import { can } from "./rbac";
import { audit } from "./audit";
import { LIVE_STATUSES, MIN_PUBLISH_SCORE, type Status } from "./constants";
import { runFactChecks, type SourceMaterial } from "./factcheck";
import { evaluateGate, evaluateQc, type GateResult, type QcInput, type QcReport } from "./qc";
import { isSameEvent } from "./dedupe";
import { parseJsonArray, readingMinutes, slugify, truncate } from "./text";
import { getProvider } from "./llm/gemini";
import type { DraftOutput } from "./llm/provider";
import { buildImageBrief } from "./imageprompt";

export interface Actor { id: string; role: string; name: string }

import type {
  Article,
  Author,
  Category,
  Tag,
  Image as ArticleImage,
  ArticleSource,
  EditorialReview,
  FactCheck,
  ArticleUpdate,
  ArticleVersion,
  Source,
} from "@prisma/client";

export class WorkflowError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
  }
}

const articleInclude = {
  category: true,
  author: true,
  tags: true,
  images: true,
  sources: { include: { source: true } },
  reviews: { orderBy: { createdAt: "desc" as const } },
  factChecks: true,
  updates: { orderBy: { at: "desc" as const } },
  versions: { orderBy: { version: "desc" as const } },
};

export type ArticleFull = Article & {
  category: Category;
  author: Author;
  tags: Tag[];
  images: ArticleImage[];
  sources: (ArticleSource & { source: Source | null })[];
  reviews: EditorialReview[];
  factChecks: FactCheck[];
  updates: ArticleUpdate[];
  versions: ArticleVersion[];
};

export async function loadArticle(id: string): Promise<ArticleFull | null> {
  return (await db.article.findUnique({ where: { id }, include: articleInclude })) as ArticleFull | null;
}

const EDITABLE = ["title", "deck", "seoTitle", "metaDescription", "bodyMd", "whyItMatters", "contextMd", "technicalMd", "keyTakeaways", "classification", "confidence", "slug", "categoryId", "authorId", "isDeveloping", "isLive", "editorsPick", "publishAt", "companies"] as const;

function snapshot(a: ArticleFull) {
  const s: Record<string, unknown> = {};
  for (const k of EDITABLE) s[k] = (a as Record<string, unknown>)[k];
  s.tags = a.tags.map((t) => t.name);
  s.sources = a.sources.map((x) => ({ title: x.title, url: x.url, publisher: x.publisher, tier: x.tier, kind: x.kind }));
  return s;
}

export async function recordVersion(articleId: string, editorId: string | null, note: string) {
  const a = await loadArticle(articleId);
  if (!a) return;
  const last = await db.articleVersion.findFirst({ where: { articleId }, orderBy: { version: "desc" } });
  await db.articleVersion.create({ data: { articleId, version: (last?.version ?? 0) + 1, snapshot: JSON.stringify(snapshot(a)), editorId, note } });
}

async function event(articleId: string, action: string, actor: Actor | null, from: string | null, to: string | null, note = "") {
  await db.publishingEvent.create({ data: { articleId, action, actorId: actor?.id ?? null, actorType: actor ? "USER" : "AUTOMATION", fromStatus: from, toStatus: to, note } });
}

export async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "story";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await db.article.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

export function toMaterial(a: ArticleFull): SourceMaterial[] {
  return a.sources.map((s) => ({
    publisher: s.publisher, title: s.title, text: s.notes, url: s.url, tier: s.tier, linkOk: s.linkOk,
    publishedAt: null,
  }));
}

export function isEvergreen(classification: string) {
  return classification === "EXPLAINER";
}

async function duplicateOfLive(a: ArticleFull): Promise<boolean> {
  const live = await db.article.findMany({ where: { status: { in: LIVE_STATUSES }, id: { not: a.id } }, select: { title: true, clusterId: true }, take: 300 });
  return live.some((l) => (a.clusterId && l.clusterId === a.clusterId) || (!isEvergreen(a.classification) && isSameEvent({ title: l.title }, { title: a.title })));
}

/** Recomputes fact-check flags (preserving human resolutions) and the QC report. */
export async function runChecks(articleId: string): Promise<QcReport> {
  const a = await loadArticle(articleId);
  if (!a) throw new WorkflowError("Article not found");
  const material = toMaterial(a);
  const flags = runFactChecks({ title: a.title, deck: a.deck, body: `${a.bodyMd}\n\n${a.whyItMatters}\n\n${a.contextMd}\n\n${a.technicalMd}`, confidence: a.confidence, classification: a.classification, evergreen: isEvergreen(a.classification) }, material);

  const key = (k: string, m: string) => `${k}::${m}`;
  const existing = new Map(a.factChecks.map((f) => [key(f.kind, f.message), f]));
  const fresh = new Set(flags.map((f) => key(f.kind, f.message)));
  for (const f of flags) if (!existing.has(key(f.kind, f.message))) await db.factCheck.create({ data: { articleId, kind: f.kind, severity: f.severity, message: f.message, detail: f.detail } });
  const stale = a.factChecks.filter((f) => !f.resolved && !fresh.has(key(f.kind, f.message))).map((f) => f.id);
  if (stale.length) await db.factCheck.deleteMany({ where: { id: { in: stale } } });

  const checks = await db.factCheck.findMany({ where: { articleId } });
  const open = checks.filter((c) => !c.resolved);
  const hero = a.images.find((i) => i.isHero) ?? a.images[0] ?? null;
  const input: QcInput = {
    article: {
      title: a.title, slug: a.slug, deck: a.deck, seoTitle: a.seoTitle, metaDescription: a.metaDescription, bodyMd: a.bodyMd,
      keyTakeaways: parseJsonArray(a.keyTakeaways), whyItMatters: a.whyItMatters, contextMd: a.contextMd,
      classification: a.classification, confidence: a.confidence, hasCategory: !!a.categoryId, hasAuthor: !!a.authorId,
    },
    sources: material,
    image: hero ? { url: hero.url, alt: hero.alt, caption: hero.caption, kind: hero.kind, status: hero.status, depictsRealEvent: hero.depictsRealEvent, credit: hero.credit } : null,
    factChecks: [],
    unresolvedCritical: open.filter((c) => c.severity === "CRITICAL").length,
    unresolvedWarnings: open.filter((c) => c.severity === "WARNING").length,
    duplicateOfLiveArticle: await duplicateOfLive(a),
    evergreen: isEvergreen(a.classification),
  };
  const report = evaluateQc(input);
  await db.article.update({ where: { id: articleId }, data: { qualityScore: report.score, qcReport: JSON.stringify(report), readingMinutes: readingMinutes(a.bodyMd), needsReview: !report.passes } });
  return report;
}

export async function gateFor(articleId: string, actor: Actor | null): Promise<{ qc: QcReport; gate: GateResult }> {
  const qc = await runChecks(articleId);
  const a = (await loadArticle(articleId))!;
  const approved = (stage: string) => {
    const latest = a.reviews.find((r) => r.stage === stage);
    return latest?.verdict === "APPROVED";
  };
  const hero = a.images.find((i) => i.isHero) ?? a.images[0];
  const open = a.factChecks.filter((c) => !c.resolved && c.severity === "CRITICAL").length;
  const gate = evaluateGate({
    qc, confidence: a.confidence, classification: a.classification,
    approvals: { FACT_CHECK: approved("FACT_CHECK"), EDITOR: approved("EDITOR"), IMAGE: approved("IMAGE"), SEO: approved("SEO") },
    actorIsHuman: !!actor, actorCanPublish: !!actor && can(actor.role, "article:publish"),
    sourcesCount: a.sources.length, hasImageApproved: hero?.status === "APPROVED", unresolvedCritical: open,
  });
  return { qc, gate };
}

// ── Creation ───────────────────────────────────────────────────────────────

export function suggestConfidence(tiers: number[]): "LIKELY" | "UNCONFIRMED" | "RUMOR" {
  const t1 = tiers.filter((t) => t === 1).length;
  const reputable = tiers.filter((t) => t <= 2).length;
  if (t1 >= 1 || reputable >= 2) return "LIKELY"; // VERIFIED is only ever set by a human editor
  if (reputable === 1) return "UNCONFIRMED";
  return "RUMOR";
}

async function editorialTeam() {
  return (await db.author.findFirst({ where: { isTeam: true } })) ?? (await db.author.create({ data: { slug: "editorial-team", name: "Editorial Team", isTeam: true, bio: "The Signal Desk newsroom." } }));
}

function sourceKindFor(tier: number): string {
  return tier === 1 ? "OFFICIAL" : "REPORT";
}

/** COLLECT → RESEARCHING. Never drafts text and never skips verification. */
export async function createFromCluster(clusterId: string, actor: Actor | null, opts: { useLlm: boolean }) {
  const cluster = await db.storyCluster.findUnique({ where: { id: clusterId }, include: { items: { include: { source: true } }, articles: true } });
  if (!cluster) throw new WorkflowError("Story cluster not found");
  if (cluster.articles.length) throw new WorkflowError("This story already has an article. Update that article instead of creating a duplicate.");
  const author = await editorialTeam();
  const category = (await db.category.findFirst({ where: { slug: cluster.items[0]?.source.categorySlug ?? "business" } })) ?? (await db.category.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }));
  const tiers = cluster.items.map((i: { source: { tier: number } }) => i.source.tier);
  const confidence = suggestConfidence(tiers);
  const article = await db.article.create({
    data: {
      slug: await uniqueSlug(cluster.headline), title: truncate(cluster.headline, 160), categoryId: category.id, authorId: author.id,
      classification: confidence === "RUMOR" ? "RUMOR" : confidence === "UNCONFIRMED" ? "REPORT" : "NEWS", status: "RESEARCHING", confidence,
      clusterId: cluster.id, automationDrafted: true, companies: cluster.entities,
      sources: {
        create: cluster.items.map((i: { sourceId: string; title: string; url: string; source: { name: string; tier: number }; snippet: string }) => ({ sourceId: i.sourceId, title: i.title, url: i.url, publisher: i.source.name, tier: i.source.tier, kind: sourceKindFor(i.source.tier), notes: i.snippet })),
      },
    },
  });
  await db.storyCluster.update({ where: { id: cluster.id }, data: { status: "DRAFTED" } });
  await event(article.id, "created-from-cluster", actor, null, "RESEARCHING", `${cluster.items.length} source item(s)`);
  await recordVersion(article.id, actor?.id ?? null, "Created from collected story");
  await audit("article.create", { userId: actor?.id, entity: "article", entityId: article.id, meta: { clusterId } });
  if (opts.useLlm) await draftWithLlm(article.id, actor).catch((e) => event(article.id, "draft-failed", actor, "RESEARCHING", "RESEARCHING", String(e.message ?? e).slice(0, 200)));
  return article.id;
}

export function llmAvailable() {
  return getProvider().isConfigured();
}

export async function draftWithLlm(articleId: string, actor: Actor | null) {
  const provider = getProvider();
  if (!provider.isConfigured()) throw new WorkflowError("AI-assisted drafting is not configured. Set GEMINI_API_KEY, or write the article manually.");
  const a = await loadArticle(articleId);
  if (!a) throw new WorkflowError("Article not found");
  if (!a.sources.length) throw new WorkflowError("Attach at least one source before drafting.");
  if (LIVE_STATUSES.includes(a.status as Status)) throw new WorkflowError("Live articles cannot be redrafted by automation.");
  const out: DraftOutput = await provider.draft(a.sources.map((s) => ({ publisher: s.publisher, tier: s.tier, title: s.title, url: s.url, excerpt: s.notes })));
  const category = (await db.category.findUnique({ where: { slug: out.suggestedCategory } })) ?? undefined;
  const cls = ["NEWS", "PRODUCT LAUNCH", "RESEARCH", "SECURITY", "POLICY", "INDUSTRY", "STARTUPS", "FUNDING", "REPORT", "RUMOR"].includes(out.suggestedClassification) ? out.suggestedClassification : "NEWS";
  // The model may soften but never harden the classification implied by the evidence.
  const classification = a.confidence === "RUMOR" ? "RUMOR" : a.confidence === "UNCONFIRMED" && !["RUMOR", "REPORT"].includes(cls) ? "REPORT" : cls;
  const tags = await Promise.all(out.tags.slice(0, 6).map((t) => db.tag.upsert({ where: { slug: slugify(t) || "tag" }, create: { slug: slugify(t) || "tag", name: t }, update: {} })));
  await db.article.update({
    where: { id: articleId },
    data: {
      title: truncate(out.title, 160), deck: out.deck, bodyMd: out.bodyMd, keyTakeaways: JSON.stringify(out.keyTakeaways), whyItMatters: out.whyItMatters,
      contextMd: [out.contextMd, out.unknowns.length ? `**Not yet known:** ${out.unknowns.join(" ")}` : ""].filter(Boolean).join("\n\n"),
      seoTitle: truncate(out.seoTitle || out.title, 65), metaDescription: truncate(out.metaDescription || out.deck, 160), classification,
      companies: JSON.stringify(out.companies), categoryId: category?.id ?? a.categoryId, status: "DRAFT", automationDrafted: true,
      tags: { set: tags.map((t) => ({ id: t.id })) }, readingMinutes: readingMinutes(out.bodyMd),
    },
  });
  await event(articleId, "draft-generated", actor, a.status, "DRAFT", `Draft prepared by ${provider.name}; requires human fact-check`);
  await recordVersion(articleId, actor?.id ?? null, `Draft generated (${provider.name})`);
  await ensureImageBrief(articleId);
  await runChecks(articleId);
}

export async function ensureImageBrief(articleId: string) {
  const a = await loadArticle(articleId);
  if (!a || a.images.length) return;
  const companies = parseJsonArray(a.companies);
  const brief = buildImageBrief({ title: a.title, category: a.category.name, classification: a.classification, company: companies[0] });
  await db.image.create({ data: { articleId, url: "", kind: brief.recommendedKind, prompt: brief.prompt, status: "PENDING" } });
}

// ── Editing ────────────────────────────────────────────────────────────────

export interface ArticlePatch {
  title?: string; deck?: string; seoTitle?: string; metaDescription?: string; bodyMd?: string; whyItMatters?: string; contextMd?: string; technicalMd?: string;
  keyTakeaways?: string[]; classification?: string; confidence?: string; slug?: string; categoryId?: string; authorId?: string;
  isDeveloping?: boolean; isLive?: boolean; editorsPick?: boolean; publishAt?: Date | null; tags?: string[]; companies?: string[];
}

export async function updateArticle(id: string, patch: ArticlePatch, actor: Actor, note = "Edited") {
  const a = await loadArticle(id);
  if (!a) throw new WorkflowError("Article not found");
  if (!can(actor.role, "article:write")) throw new WorkflowError("Your role cannot edit articles.");
  const live = LIVE_STATUSES.includes(a.status as Status);
  if (live && !can(actor.role, "article:publish")) throw new WorkflowError("Only editors can change a published article.");
  if ((patch.confidence || patch.editorsPick !== undefined) && !can(actor.role, "article:review")) throw new WorkflowError("Only editors can change confidence or editor's picks.");
  if (patch.confidence === "VERIFIED" && a.automationDrafted && !a.reviews.some((r) => r.stage === "FACT_CHECK")) {
    // Allowed, but only by an editor; the FACT_CHECK approval is still required before publication.
  }
  const data: Record<string, unknown> = {};
  for (const k of ["title", "deck", "seoTitle", "metaDescription", "bodyMd", "whyItMatters", "contextMd", "technicalMd", "classification", "confidence", "categoryId", "authorId", "isDeveloping", "isLive", "editorsPick", "publishAt"] as const) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (patch.keyTakeaways) data.keyTakeaways = JSON.stringify(patch.keyTakeaways.filter(Boolean));
  if (patch.companies) data.companies = JSON.stringify(patch.companies);
  if (patch.slug && patch.slug !== a.slug) {
    if (live) throw new WorkflowError("The URL of a published article cannot be changed.");
    data.slug = await uniqueSlug(patch.slug, id);
  }
  if (patch.bodyMd !== undefined) data.readingMinutes = readingMinutes(patch.bodyMd);
  if (patch.tags) {
    const tags = await Promise.all(patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 10).map((t) => db.tag.upsert({ where: { slug: slugify(t) || "tag" }, create: { slug: slugify(t) || "tag", name: t }, update: {} })));
    data.tags = { set: tags.map((t) => ({ id: t.id })) };
  }
  // Editing substantive content after approval invalidates earlier approvals (except when only metadata changes).
  const contentChanged = ["title", "bodyMd", "deck", "whyItMatters", "contextMd", "classification", "confidence"].some((k) => patch[k as keyof ArticlePatch] !== undefined && patch[k as keyof ArticlePatch] !== (a as Record<string, unknown>)[k]);
  await db.article.update({ where: { id }, data: { ...data, ...(live ? { modifiedAt: new Date(), status: "UPDATED" } : {}) } });
  if (contentChanged && !live) await db.editorialReview.deleteMany({ where: { articleId: id, stage: { in: ["FACT_CHECK", "EDITOR"] } } });
  await recordVersion(id, actor.id, note);
  const report = await runChecks(id);
  if (live && !report.passes) {
    // Restore the previous version so a bad edit can never degrade a live article.
    const prev = await db.articleVersion.findFirst({ where: { articleId: id }, orderBy: { version: "desc" }, skip: 1 });
    if (prev) {
      const s = JSON.parse(prev.snapshot) as Record<string, unknown>;
      const restore: Record<string, unknown> = {};
      for (const k of EDITABLE) if (k !== "slug" && s[k] !== undefined) restore[k] = k === "publishAt" && s[k] ? new Date(s[k] as string) : s[k];
      await db.article.update({ where: { id }, data: { ...restore, status: a.status, modifiedAt: a.modifiedAt } });
      await recordVersion(id, actor.id, "Edit reverted: failed QC on a live article");
      await runChecks(id);
    }
    throw new WorkflowError("This edit would take a live article below the publication standard, so it was not applied.", report.criticalFailures.length ? report.criticalFailures : [`Quality score ${report.score}/${MIN_PUBLISH_SCORE}`]);
  }
  if (live) await event(id, "live-edit", actor, a.status, "UPDATED", note);
  await audit("article.update", { userId: actor.id, entity: "article", entityId: id });
}

export async function addLiveUpdate(id: string, text: string, actor: Actor) {
  if (!can(actor.role, "article:publish")) throw new WorkflowError("Only editors can post updates.");
  const clean = text.trim();
  if (clean.length < 8) throw new WorkflowError("Write the update in a full sentence.");
  await db.articleUpdate.create({ data: { articleId: id, text: clean, authorName: actor.name } });
  await db.article.update({ where: { id }, data: { modifiedAt: new Date(), isDeveloping: true } });
  await event(id, "update-posted", actor, null, null, clean.slice(0, 120));
  await audit("article.update-posted", { userId: actor.id, entity: "article", entityId: id });
}

// ── Workflow transitions ───────────────────────────────────────────────────

const ORDER: Status[] = ["COLLECTED", "RESEARCHING", "DRAFT", "FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW"];

export async function advance(id: string, actor: Actor, notes = ""): Promise<{ status: Status; published?: boolean }> {
  const a = await loadArticle(id);
  if (!a) throw new WorkflowError("Article not found");
  const from = a.status as Status;
  const idx = ORDER.indexOf(from);
  if (idx < 0) throw new WorkflowError(`An article in ${from} cannot be advanced.`);
  const needReview = (stage: string) => {
    if (!can(actor.role, "article:review")) throw new WorkflowError(`Only editors can approve the ${stage.toLowerCase().replace("_", " ")} stage.`);
  };

  if (from === "COLLECTED" || from === "RESEARCHING") {
    if (!can(actor.role, "article:write")) throw new WorkflowError("Your role cannot edit articles.");
    return move(a, "DRAFT", actor, notes);
  }
  if (from === "DRAFT") {
    if (!can(actor.role, "article:write")) throw new WorkflowError("Your role cannot edit articles.");
    const problems: string[] = [];
    if (a.bodyMd.trim().split(/\s+/).length < 60) problems.push("The body needs at least 60 words.");
    if (!isEvergreen(a.classification) && !a.sources.length) problems.push("Attach at least one source.");
    if (a.confidence === "DO NOT PUBLISH") problems.push("Confidence is set to DO NOT PUBLISH.");
    if (problems.length) throw new WorkflowError("Not ready for fact-check.", problems);
    await runChecks(id);
    return move(a, "FACT CHECK", actor, notes);
  }

  const report = await runChecks(id);
  const fresh = (await loadArticle(id))!;
  if (from === "FACT CHECK") {
    needReview("FACT_CHECK");
    const open = fresh.factChecks.filter((f) => !f.resolved && f.severity === "CRITICAL");
    if (open.length) throw new WorkflowError("Resolve or correct every critical fact-check flag first.", open.map((f) => f.message));
    if (a.confidence === "DO NOT PUBLISH") throw new WorkflowError("Confidence is DO NOT PUBLISH.");
    await review(id, actor, "FACT_CHECK", "APPROVED", notes);
    return move(a, "EDITOR REVIEW", actor, notes);
  }
  if (from === "EDITOR REVIEW") {
    needReview("EDITOR");
    const blockers = report.checklist.filter((c) => c.critical && c.status === "fail").map((c) => c.label);
    if (blockers.length) throw new WorkflowError("Editorial QC found critical problems.", blockers);
    await review(id, actor, "EDITOR", "APPROVED", notes);
    return move(a, "IMAGE REVIEW", actor, notes);
  }
  if (from === "IMAGE REVIEW") {
    needReview("IMAGE");
    const hero = fresh.images.find((i) => i.isHero) ?? fresh.images[0];
    if (!hero || !hero.url) throw new WorkflowError("Attach a hero image first.");
    if (hero.status !== "APPROVED") throw new WorkflowError("Approve the image after checking authenticity and relevance.");
    if (hero.alt.trim().length < 10 || hero.caption.trim().length < 5) throw new WorkflowError("The image needs alt text and a caption.");
    await review(id, actor, "IMAGE", "APPROVED", notes);
    return move(a, "SEO REVIEW", actor, notes);
  }
  // SEO REVIEW → publish or schedule, behind the final gate.
  needReview("SEO");
  await review(id, actor, "SEO", "APPROVED", notes);
  const { gate } = await gateFor(id, actor);
  if (!gate.allowed) {
    await db.editorialReview.deleteMany({ where: { articleId: id, stage: "SEO" } });
    throw new WorkflowError("The publishing gate blocked this article.", gate.blockers);
  }
  if (!can(actor.role, "article:publish")) throw new WorkflowError("Your role cannot publish articles.");
  if (a.publishAt && a.publishAt > new Date()) {
    await move(a, "SCHEDULED", actor, `Scheduled for ${a.publishAt.toISOString()}`);
    return { status: "SCHEDULED" };
  }
  await publishNow(id, actor);
  return { status: "PUBLISHED", published: true };
}

async function move(a: ArticleFull, to: Status, actor: Actor | null, note: string) {
  await db.article.update({ where: { id: a.id }, data: { status: to } });
  await event(a.id, "advance", actor, a.status, to, note);
  await audit("article.advance", { userId: actor?.id, entity: "article", entityId: a.id, meta: { from: a.status, to } });
  return { status: to };
}

async function publishNow(id: string, actor: Actor | null) {
  const a = await loadArticle(id);
  if (!a) return;
  const now = new Date();
  await db.article.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now, modifiedAt: now, needsReview: false } });
  await event(id, "published", actor, a.status, "PUBLISHED", "All gate checks passed");
  await recordVersion(id, actor?.id ?? null, "Published");
  await audit("article.publish", { userId: actor?.id, entity: "article", entityId: id });
}

/** Publishes scheduled stories that were human-approved. Re-checks the full gate at publication time. */
export async function publishDueScheduled(): Promise<{ published: string[]; blocked: string[] }> {
  const due = await db.article.findMany({ where: { status: "SCHEDULED", publishAt: { lte: new Date() } }, include: { events: { where: { action: "advance", toStatus: "SCHEDULED" }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const out = { published: [] as string[], blocked: [] as string[] };
  for (const a of due) {
    const approver = a.events[0]?.actorId ? await db.user.findUnique({ where: { id: a.events[0].actorId } }) : null;
    if (!approver || !can(approver.role, "article:publish")) {
      out.blocked.push(a.slug);
      continue;
    }
    const actor: Actor = { id: approver.id, role: approver.role, name: approver.name };
    const { gate } = await gateFor(a.id, actor);
    if (!gate.allowed) {
      await db.article.update({ where: { id: a.id }, data: { status: "EDITOR REVIEW", needsReview: true } });
      await event(a.id, "schedule-blocked", null, "SCHEDULED", "EDITOR REVIEW", gate.blockers.join("; ").slice(0, 300));
      out.blocked.push(a.slug);
    } else {
      await publishNow(a.id, actor);
      out.published.push(a.slug);
    }
  }
  return out;
}

export async function review(id: string, actor: Actor, stage: string, verdict: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED", notes = "") {
  await db.editorialReview.create({ data: { articleId: id, reviewerId: actor.id, stage, verdict, notes } });
}

export async function requestChanges(id: string, actor: Actor, notes: string) {
  if (!can(actor.role, "article:review")) throw new WorkflowError("Only editors can request changes.");
  const a = await loadArticle(id);
  if (!a) throw new WorkflowError("Article not found");
  if (LIVE_STATUSES.includes(a.status as Status)) throw new WorkflowError("Use the update tools for live articles.");
  const stage = a.status === "FACT CHECK" ? "FACT_CHECK" : a.status === "IMAGE REVIEW" ? "IMAGE" : a.status === "SEO REVIEW" ? "SEO" : "EDITOR";
  await review(id, actor, stage, "CHANGES_REQUESTED", notes);
  await db.article.update({ where: { id }, data: { status: "DRAFT", needsReview: true } });
  await event(id, "changes-requested", actor, a.status, "DRAFT", notes.slice(0, 200));
}

export async function reject(id: string, actor: Actor, reason: string) {
  if (!can(actor.role, "article:reject")) throw new WorkflowError("Only editors can reject stories.");
  const a = await loadArticle(id);
  if (!a) throw new WorkflowError("Article not found");
  await review(id, actor, "EDITOR", "REJECTED", reason);
  await db.article.update({ where: { id }, data: { status: "REJECTED", confidence: a.confidence === "VERIFIED" ? a.confidence : "DO NOT PUBLISH" } });
  await event(id, "rejected", actor, a.status, "REJECTED", reason.slice(0, 200));
  await audit("article.reject", { userId: actor.id, entity: "article", entityId: id });
}

export async function unpublish(id: string, actor: Actor, reason: string) {
  if (!can(actor.role, "article:publish")) throw new WorkflowError("Only editors can unpublish.");
  const a = await loadArticle(id);
  if (!a || !LIVE_STATUSES.includes(a.status as Status)) throw new WorkflowError("Article is not live.");
  await db.article.update({ where: { id }, data: { status: "ARCHIVED" } });
  await event(id, "archived", actor, a.status, "ARCHIVED", reason.slice(0, 200));
  await audit("article.archive", { userId: actor.id, entity: "article", entityId: id, meta: { reason } });
}

export async function resolveFactCheck(flagId: string, actor: Actor, note: string) {
  if (!can(actor.role, "article:review")) throw new WorkflowError("Only editors can resolve fact-check flags.");
  if (note.trim().length < 8) throw new WorkflowError("Explain how this was resolved (what you checked).");
  const f = await db.factCheck.update({ where: { id: flagId }, data: { resolved: true, resolvedBy: actor.id, resolutionNote: note.trim() } });
  await audit("factcheck.resolve", { userId: actor.id, entity: "article", entityId: f.articleId, meta: { flagId, kind: f.kind } });
  await runChecks(f.articleId);
}

export async function setImageApproval(articleId: string, imageId: string, actor: Actor, approve: boolean) {
  if (!can(actor.role, "article:review")) throw new WorkflowError("Only editors can approve images.");
  const img = await db.image.findUnique({ where: { id: imageId } });
  if (!img || img.articleId !== articleId) throw new WorkflowError("Image not found");
  if (approve) {
    if (!img.url) throw new WorkflowError("This image has no file or URL yet.");
    if (img.alt.trim().length < 10) throw new WorkflowError("Alt text must describe the image (10+ characters).");
    if (img.kind !== "ILLUSTRATION" && img.kind !== "CONCEPTUAL" && !img.credit.trim()) throw new WorkflowError("Record the credit or licence for photographs.");
    if (img.depictsRealEvent && (img.kind === "ILLUSTRATION" || img.kind === "CONCEPTUAL")) throw new WorkflowError("A conceptual image cannot depict a real event.");
  }
  await db.image.update({ where: { id: imageId }, data: { status: approve ? "APPROVED" : "REJECTED", checkedById: actor.id } });
  await audit("image.review", { userId: actor.id, entity: "image", entityId: imageId, meta: { approve } });
  await runChecks(articleId);
}
