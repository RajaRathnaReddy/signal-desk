import { unstable_cache } from "next/cache";
import { db } from "./db";
import { LIVE_STATUSES, SECTIONS } from "./constants";
import { parseJsonArray } from "./text";
import { searchDocs, suggest, type SearchDoc } from "./search";
import { trendingScore } from "./trending";

/** Cached query results are JSON-serialised, so everything public is plain strings/numbers. */
export interface ArticleCard {
  id: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  title: string;
  deck: string;
  classification: string;
  confidence: string;
  publishedAt: string;
  modifiedAt: string | null;
  isDeveloping: boolean;
  isLive: boolean;
  readingMinutes: number;
  authorName: string;
  image: { url: string; alt: string; width: number | null; height: number | null; kind: string } | null;
}

const livePublic = () => ({ status: { in: LIVE_STATUSES as string[] }, publishedAt: { lte: new Date() } });

const cardInclude = { category: true, author: true, images: true } as const;

type Row = Awaited<ReturnType<typeof fetchRows>>[number];
async function fetchRows(where: object, take: number, skip = 0, orderBy: object = { publishedAt: "desc" }) {
  return db.article.findMany({ where, take, skip, orderBy, include: cardInclude });
}

export function toCard(a: Row): ArticleCard {
  const hero = a.images.find((i) => i.isHero && i.status === "APPROVED" && i.url);
  return {
    id: a.id, slug: a.slug, categorySlug: a.category.slug, categoryName: a.category.name, title: a.title, deck: a.deck,
    classification: a.classification, confidence: a.confidence, publishedAt: (a.publishedAt ?? a.createdAt).toISOString(),
    modifiedAt: a.modifiedAt?.toISOString() ?? null, isDeveloping: a.isDeveloping, isLive: a.isLive, readingMinutes: a.readingMinutes,
    authorName: a.author.name,
    image: hero ? { url: hero.url, alt: hero.alt, width: hero.width, height: hero.height, kind: hero.kind } : null,
  };
}

const TTL = { revalidate: 60, tags: ["content"] };

export const getLatest = unstable_cache(
  async (take: number, skip: number, categorySlug?: string, classifications?: string[], excludeExplainers?: boolean) => {
    const where = {
      ...livePublic(),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(classifications ? { classification: { in: classifications } } : {}),
      ...(excludeExplainers ? { classification: { not: "EXPLAINER" } } : {}),
    };
    const [rows, total] = await Promise.all([fetchRows(where, take, skip), db.article.count({ where })]);
    return { items: rows.map(toCard), total };
  },
  ["latest"], TTL,
);

export const getByClassification = unstable_cache(
  async (key: keyof typeof SECTIONS, take: number, skip: number) => {
    const where = { ...livePublic(), classification: { in: SECTIONS[key].classifications } };
    const [rows, total] = await Promise.all([fetchRows(where, take, skip), db.article.count({ where })]);
    return { items: rows.map(toCard), total };
  },
  ["by-class"], TTL,
);

export const getEditorsPicks = unstable_cache(
  async (take: number) => (await fetchRows({ ...livePublic(), editorsPick: true }, take)).map(toCard),
  ["picks"], TTL,
);

export const getCategories = unstable_cache(async () => db.category.findMany({ orderBy: { sortOrder: "asc" } }), ["categories"], { revalidate: 300, tags: ["content"] });

export const getArticlePage = unstable_cache(
  async (categorySlug: string, slug: string) => {
    const a = await db.article.findFirst({
      where: { slug, category: { slug: categorySlug }, ...livePublic() },
      include: { category: true, author: true, tags: true, images: true, sources: true, updates: { orderBy: { at: "desc" } } },
    });
    if (!a) return null;
    const hero = a.images.find((i) => i.isHero && i.status === "APPROVED" && i.url) ?? null;
    const [related, next] = await Promise.all([
      fetchRows({ ...livePublic(), id: { not: a.id }, OR: [{ categoryId: a.categoryId }, { tags: { some: { id: { in: a.tags.map((t) => t.id) } } } }] }, 4),
      fetchRows({ ...livePublic(), publishedAt: { lt: a.publishedAt ?? new Date() }, id: { not: a.id } }, 1),
    ]);
    return {
      id: a.id, slug: a.slug, title: a.title, deck: a.deck, seoTitle: a.seoTitle || a.title, metaDescription: a.metaDescription || a.deck,
      classification: a.classification, confidence: a.confidence, bodyMd: a.bodyMd, whyItMatters: a.whyItMatters, contextMd: a.contextMd, technicalMd: a.technicalMd,
      keyTakeaways: parseJsonArray(a.keyTakeaways), isDeveloping: a.isDeveloping, isLive: a.isLive, readingMinutes: a.readingMinutes,
      publishedAt: (a.publishedAt ?? a.createdAt).toISOString(), modifiedAt: a.modifiedAt?.toISOString() ?? null,
      category: { slug: a.category.slug, name: a.category.name },
      author: { name: a.author.name, slug: a.author.slug, isTeam: a.author.isTeam, bio: a.author.bio },
      tags: a.tags.map((t) => ({ slug: t.slug, name: t.name })),
      sources: a.sources.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher, tier: s.tier, kind: s.kind })),
      updates: a.updates.map((u) => ({ text: u.text, at: u.at.toISOString(), authorName: u.authorName })),
      hero: hero ? { url: hero.url, alt: hero.alt, caption: hero.caption, credit: hero.credit, kind: hero.kind, width: hero.width, height: hero.height } : null,
      related: related.map(toCard),
      next: next[0] ? toCard(next[0]) : null,
    };
  },
  ["article-page"], TTL,
);

// ── Trending ───────────────────────────────────────────────────────────────

let lastTrendingRun = 0;

export async function refreshTrending(force = false) {
  if (!force && Date.now() - lastTrendingRun < 5 * 60_000) return;
  lastTrendingRun = Date.now();
  const since = new Date(Date.now() - 14 * 86_400_000);
  const arts = await db.article.findMany({ where: { ...livePublic(), publishedAt: { gte: since } }, select: { id: true, publishedAt: true, title: true } });
  if (!arts.length) return;
  const events = await db.analyticsEvent.groupBy({ by: ["articleId", "type"], where: { articleId: { in: arts.map((a) => a.id) }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, _count: { _all: true }, _sum: { value: true } });
  const searches = await db.analyticsEvent.findMany({ where: { type: "SEARCH", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, select: { query: true }, take: 2000 });
  const searchedWords = new Map<string, number>();
  for (const s of searches) for (const w of (s.query ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 3)) searchedWords.set(w, (searchedWords.get(w) ?? 0) + 1);
  for (const a of arts) {
    const ev = (t: string) => events.find((e) => e.articleId === a.id && e.type === t);
    const titleWords = a.title.toLowerCase().split(/\W+/);
    const searchHits = titleWords.reduce((n, w) => n + (searchedWords.get(w) ?? 0), 0);
    const t = trendingScore({
      views: ev("VIEW")?._count._all ?? 0, readSeconds: ev("READ")?._sum.value ?? 0, readEvents: ev("READ")?._count._all ?? 0,
      shares: ev("SHARE")?._count._all ?? 0, searchHits, ageHours: (Date.now() - (a.publishedAt?.getTime() ?? Date.now())) / 3_600_000,
    });
    await db.trendingScore.upsert({ where: { articleId: a.id }, create: { articleId: a.id, score: t.score, components: JSON.stringify(t.components) }, update: { score: t.score, components: JSON.stringify(t.components), computedAt: new Date() } });
  }
}

export async function getTrending(take: number): Promise<ArticleCard[]> {
  await refreshTrending();
  const rows = await db.article.findMany({
    where: { ...livePublic(), trending: { is: { score: { gt: 0 } } } },
    orderBy: { trending: { score: "desc" } }, take, include: cardInclude,
  });
  if (rows.length) return rows.map(toCard);
  return []; // No engagement yet: show nothing rather than faking popularity.
}

// ── Search ────────────────────────────────────────────────────────────────

export async function searchArticles(query: string, opts: { category?: string; from?: Date; to?: Date; classification?: string } = {}) {
  const where = {
    ...livePublic(),
    ...(opts.category ? { category: { slug: opts.category } } : {}),
    ...(opts.classification ? { classification: opts.classification } : {}),
    ...(opts.from || opts.to ? { publishedAt: { lte: new Date(), ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
  };
  const rows = await db.article.findMany({ where, include: { ...cardInclude, tags: true }, orderBy: { publishedAt: "desc" }, take: 1500 });
  const docs: (SearchDoc & { row: Row })[] = rows.map((r) => ({
    id: r.id, title: r.title, deck: r.deck, body: `${r.bodyMd} ${r.whyItMatters}`, tags: r.tags.map((t) => t.name), companies: parseJsonArray(r.companies),
    category: r.category.name, publishedAt: r.publishedAt, row: r,
  }));
  const results = searchDocs(docs, query);
  return {
    items: results.slice(0, 40).map((r) => toCard((r.doc as (typeof docs)[number]).row)),
    total: results.length,
    didYouMean: results.length < 3 ? suggest(docs, query) : null,
  };
}

export async function getSitemapEntries() {
  const rows = await db.article.findMany({ where: livePublic(), select: { slug: true, publishedAt: true, modifiedAt: true, category: { select: { slug: true } } }, orderBy: { publishedAt: "desc" }, take: 5000 });
  return rows;
}

export async function getFeedArticles(take = 30) {
  return db.article.findMany({ where: livePublic(), include: { category: true, author: true }, orderBy: { publishedAt: "desc" }, take });
}

export async function getDevelopingStories(take = 4) {
  return (await fetchRows({ ...livePublic(), isDeveloping: true }, take)).map(toCard);
}
