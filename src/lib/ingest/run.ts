/** Ingestion pipeline: SOURCE → COLLECT → duplicate clustering. Runs from the admin UI, the cron endpoint, or `npm run ingest`. */
import { db } from "../db";
import { allowedByRobots, safeFetch } from "./http";
import { parseFeed } from "./feed";
import { detectEntities, SAME_EVENT_THRESHOLD, similarity } from "../dedupe";

export interface IngestSummary {
  sources: number;
  ok: number;
  failed: number;
  newItems: number;
  newClusters: number;
  errors: { source: string; error: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusFor(fails: number): string {
  return fails === 0 ? "HEALTHY" : fails < 3 ? "DEGRADED" : "FAILING";
}

export async function ingestSource(sourceId: string): Promise<{ newItems: number; error?: string }> {
  const src = await db.source.findUnique({ where: { id: sourceId } });
  if (!src) return { newItems: 0, error: "Source not found" };
  const now = new Date();
  try {
    if (!(await allowedByRobots(src.feedUrl))) throw new Error("Blocked by robots.txt");
    const res = await safeFetch(src.feedUrl, {
      headers: {
        ...(src.etag ? { "if-none-match": src.etag } : {}),
        ...(src.lastModifiedHeader ? { "if-modified-since": src.lastModifiedHeader } : {}),
      },
    });
    if (res.notModified) {
      await db.source.update({ where: { id: src.id }, data: { lastAttemptAt: now, lastSuccessAt: now, status: "HEALTHY", consecutiveFailures: 0, lastError: null } });
      return { newItems: 0 };
    }
    if (res.status === 429) throw new Error("Rate limited by the publisher (HTTP 429); will retry on the next run");
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(res.text);
    let created = 0;
    for (const it of items) {
      const exists = await db.feedItem.findUnique({ where: { sourceId_guid: { sourceId: src.id, guid: it.guid } }, select: { id: true } });
      if (exists) continue;
      await db.feedItem.create({
        data: {
          sourceId: src.id,
          guid: it.guid.slice(0, 500),
          url: it.url,
          title: it.title,
          snippet: it.snippet,
          publishedAt: it.publishedAt,
          entities: JSON.stringify(detectEntities(`${it.title} ${it.snippet}`)),
        },
      });
      created++;
    }
    await db.source.update({
      where: { id: src.id },
      data: {
        lastAttemptAt: now, lastSuccessAt: now, lastError: null, consecutiveFailures: 0, status: "HEALTHY",
        etag: res.headers.get("etag"), lastModifiedHeader: res.headers.get("last-modified"), itemsLastFetch: items.length,
      },
    });
    return { newItems: created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fails = src.consecutiveFailures + 1;
    await db.source.update({ where: { id: src.id }, data: { lastAttemptAt: now, lastError: msg.slice(0, 300), consecutiveFailures: fails, status: statusFor(fails) } });
    return { newItems: 0, error: msg };
  }
}

/** Assigns unclustered items to an existing open cluster (same event) or starts a new one. */
export async function clusterNewItems(): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const fresh = await db.feedItem.findMany({
    where: { clusterId: null, status: "NEW", OR: [{ publishedAt: null }, { publishedAt: { gte: since } }] },
    include: { source: true },
    orderBy: { publishedAt: "asc" },
    take: 600,
  });
  // Old backlog from a first run is ignored rather than turned into stories.
  await db.feedItem.updateMany({ where: { clusterId: null, status: "NEW", publishedAt: { lt: since } }, data: { status: "IGNORED" } });

  const clusters = await db.storyCluster.findMany({
    where: { status: { in: ["OPEN", "DRAFTED"] }, updatedAt: { gte: since } },
    include: { items: { include: { source: true }, take: 12 } },
  });
  let newClusters = 0;
  for (const item of fresh) {
    const cand = { title: item.title, snippet: item.snippet, url: item.url, entities: JSON.parse(item.entities) as string[] };
    let target: (typeof clusters)[number] | undefined;
    let best = 0;
    for (const c of clusters) {
      const s = Math.max(...c.items.map((o) => similarity(cand, { title: o.title, snippet: o.snippet, url: o.url, entities: JSON.parse(o.entities) }).score));
      if (s >= SAME_EVENT_THRESHOLD && s > best) {
        best = s;
        target = c;
      }
    }
    if (!target) {
      const created = await db.storyCluster.create({
        data: { headline: item.title, entities: item.entities, topTier: item.source.tier, sourceCount: 1, signal: signalOf(item.source.tier, 1) },
        include: { items: { include: { source: true } } },
      });
      clusters.push(created);
      target = created;
      newClusters++;
    }
    await db.feedItem.update({ where: { id: item.id }, data: { clusterId: target.id, status: "CLUSTERED" } });
    const refreshed = await db.feedItem.findMany({ where: { clusterId: target.id }, include: { source: true } });
    const distinct = new Set(refreshed.map((r) => r.sourceId)).size;
    const topTier = Math.min(...refreshed.map((r) => r.source.tier));
    const updated = await db.storyCluster.update({
      where: { id: target.id },
      data: { sourceCount: distinct, topTier, signal: signalOf(topTier, distinct) },
      include: { items: { include: { source: true }, take: 12 } },
    });
    const idx = clusters.findIndex((c) => c.id === updated.id);
    clusters[idx] = updated;
  }
  return newClusters;
}

/** Significance proxy: primary-source weight plus independent corroboration. Deliberately ignores social buzz. */
export function signalOf(topTier: number, distinctSources: number): number {
  const tier = topTier === 1 ? 3 : topTier === 2 ? 1.5 : 0.5;
  return Math.round((tier + Math.min(distinctSources, 6) * 1.2) * 10) / 10;
}

export async function ingestAll(onlyIds?: string[]): Promise<IngestSummary> {
  const sources = await db.source.findMany({ where: { active: true, ...(onlyIds ? { id: { in: onlyIds } } : {}) }, orderBy: { name: "asc" } });
  const summary: IngestSummary = { sources: sources.length, ok: 0, failed: 0, newItems: 0, newClusters: 0, errors: [] };
  for (const s of sources) {
    const r = await ingestSource(s.id);
    if (r.error) {
      summary.failed++;
      summary.errors.push({ source: s.name, error: r.error });
    } else summary.ok++;
    summary.newItems += r.newItems;
    await sleep(350); // polite spacing between publishers
  }
  summary.newClusters = await clusterNewItems();
  return summary;
}
