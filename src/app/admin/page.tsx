import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { llmAvailable } from "@/lib/workflow";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { StatusBadge, ConfidenceChip } from "@/components/Badges";
import { createFromClusterAction, triggerIngestAction } from "@/app/actions/admin";

import type {
  Article,
  Author,
  Category,
  ArticleSource,
  FactCheck,
  ArticleUpdate,
  StoryCluster,
  FeedItem,
  Source,
} from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string; msg?: string; denied?: string }>;
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  await requireUser();
  const sp = await searchParams;
  const tab = sp.tab ?? "review";

  const [
    draftsCount,
    reviewCount,
    publishedCount,
    openClustersCount,
    failingSourcesCount,
    brokenLinksCount,
  ] = await Promise.all([
    db.article.count({ where: { status: "DRAFT" } }),
    db.article.count({ where: { status: { in: ["FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW"] } } }),
    db.article.count({ where: { status: { in: ["PUBLISHED", "UPDATED"] } } }),
    db.storyCluster.count({ where: { status: "OPEN" } }),
    db.source.count({ where: { status: "FAILING" } }),
    db.articleSource.count({ where: { linkOk: false } }),
  ]);

  const hasLlm = llmAvailable();

  type ClusterWithItems = StoryCluster & {
    items: (FeedItem & { source: Source })[];
  };
  type ArticleWithReviewRelations = Article & {
    category: Category;
    author: Author;
    sources: ArticleSource[];
    factChecks: FactCheck[];
  };
  type ArticleWithDraftRelations = Article & {
    category: Category;
    author: Author;
    sources: ArticleSource[];
  };
  type ArticleWithPublishedRelations = Article & {
    category: Category;
    author: Author;
    updates: ArticleUpdate[];
  };

  // Load data for active tab
  const clusters: ClusterWithItems[] = tab === "clusters"
    ? ((await db.storyCluster.findMany({
        where: { status: "OPEN" },
        include: { items: { include: { source: true } } },
        orderBy: [{ signal: "desc" }, { updatedAt: "desc" }],
        take: 30,
      })) as ClusterWithItems[])
    : [];

  const reviewArticles: ArticleWithReviewRelations[] = tab === "review"
    ? ((await db.article.findMany({
        where: { status: { in: ["FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW"] } },
        include: { category: true, author: true, sources: true, factChecks: true },
        orderBy: { updatedAt: "desc" },
      })) as ArticleWithReviewRelations[])
    : [];

  const draftArticles: ArticleWithDraftRelations[] = tab === "drafts"
    ? ((await db.article.findMany({
        where: { status: { in: ["DRAFT", "RESEARCHING", "COLLECTED"] } },
        include: { category: true, author: true, sources: true },
        orderBy: { updatedAt: "desc" },
      })) as ArticleWithDraftRelations[])
    : [];

  const publishedArticles: ArticleWithPublishedRelations[] = tab === "published"
    ? ((await db.article.findMany({
        where: { status: { in: ["PUBLISHED", "UPDATED", "SCHEDULED"] } },
        include: { category: true, author: true, updates: true },
        orderBy: { publishedAt: "desc" },
        take: 50,
      })) as ArticleWithPublishedRelations[])
    : [];

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1 className="admin-title">Newsroom Editorial Desk</h1>
          <p style={{ margin: 0, fontSize: "var(--step--1)", color: "var(--muted)" }}>
            Verification pipeline: Collect → Verify → Draft → Fact-Check → QC → Publish
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--s3)", alignItems: "center" }}>
          <form action={async () => {
            "use server";
            await triggerIngestAction();
          }}>
            <button type="submit" className="btn btn-ghost btn-sm">
              ↻ Ingest Active Feeds
            </button>
          </form>
          <Link href="/admin/articles/new" className="btn btn-accent btn-sm">
            + New Story
          </Link>
        </div>
      </header>

      <div className="admin-content">
        {sp.denied && (
          <div className="alert alert-bad" role="alert">
            Permission denied for the requested newsroom action.
          </div>
        )}

        {/* Metrics Strip */}
        <section className="metrics-strip" aria-label="Newsroom Health & Pipeline Metrics">
          <div className="metric-card">
            <div className="num">{reviewCount}</div>
            <div className="label">Needs Review</div>
          </div>
          <div className="metric-card">
            <div className="num">{openClustersCount}</div>
            <div className="label">Collected Leads</div>
          </div>
          <div className="metric-card">
            <div className="num">{draftsCount}</div>
            <div className="label">In Draft</div>
          </div>
          <div className="metric-card ok">
            <div className="num">{publishedCount}</div>
            <div className="label">Published Live</div>
          </div>
          <div className={`metric-card ${brokenLinksCount > 0 ? "warn" : ""}`}>
            <div className="num">{brokenLinksCount}</div>
            <div className="label">Broken Sources</div>
          </div>
          <div className={`metric-card ${failingSourcesCount > 0 ? "bad" : "ok"}`}>
            <div className="num">{failingSourcesCount}</div>
            <div className="label">Failing Feeds</div>
          </div>
        </section>

        {/* Queue Tabs */}
        <nav className="queue-tabs" aria-label="Editorial Stages">
          <Link href="/admin?tab=review" className="queue-tab" aria-current={tab === "review"}>
            Needs Review ({reviewCount})
          </Link>
          <Link href="/admin?tab=clusters" className="queue-tab" aria-current={tab === "clusters"}>
            Collected Leads ({openClustersCount})
          </Link>
          <Link href="/admin?tab=drafts" className="queue-tab" aria-current={tab === "drafts"}>
            Drafts ({draftsCount})
          </Link>
          <Link href="/admin?tab=published" className="queue-tab" aria-current={tab === "published"}>
            Published ({publishedCount})
          </Link>
        </nav>

        {/* Tab 1: Needs Review */}
        {tab === "review" && (
          <section aria-labelledby="h-tab-review">
            <h2 id="h-tab-review" className="sr-only">Articles Requiring Review</h2>
            {reviewArticles.length === 0 ? (
              <div className="empty">
                <h3>Editorial Review Queue is Clear</h3>
                <p>No articles are currently awaiting fact-check, editor review, image review, or SEO review.</p>
              </div>
            ) : (
              reviewArticles.map((a) => {
                const unresolvedCrit = a.factChecks.filter((f) => !f.resolved && f.severity === "CRITICAL").length;
                return (
                  <article key={a.id} className="story-item">
                    <div className="story-item-head">
                      <div>
                        <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center", marginBottom: "0.25rem" }}>
                          <span className="kicker">{a.category.name}</span>
                          <StatusBadge status={a.status} />
                          <ConfidenceChip value={a.confidence} />
                          {a.qualityScore != null && (
                            <span className="badge" title="Automated QC Score">
                              QC: {a.qualityScore}/100
                            </span>
                          )}
                          {unresolvedCrit > 0 && (
                            <span className="badge badge-bad">{unresolvedCrit} Critical Fact Check(s)</span>
                          )}
                        </div>
                        <h3>
                          <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                        </h3>
                      </div>
                      <Link href={`/admin/articles/${a.id}`} className="btn btn-ghost btn-sm">
                        Open Editor →
                      </Link>
                    </div>
                    <div className="story-item-meta">
                      <span>By {a.author.name}</span>
                      <span>Updated {timeAgo(a.updatedAt)}</span>
                      <span>{a.sources.length} Attached Source(s)</span>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}

        {/* Tab 2: Collected Clusters */}
        {tab === "clusters" && (
          <section aria-labelledby="h-tab-clusters">
            <h2 id="h-tab-clusters" className="sr-only">Collected Story Clusters</h2>
            <p style={{ color: "var(--muted)", fontSize: "var(--step--1)", marginBottom: "var(--s4)" }}>
              Stories automatically deduplicated and clustered from monitored Tier 1 and Tier 2 feeds.
              Signal indicates primary source strength and corroboration count.
            </p>

            {clusters.length === 0 ? (
              <div className="empty">
                <h3>No Open Story Clusters</h3>
                <p>Run feed ingestion or wait for the next scheduled collector cycle.</p>
              </div>
            ) : (
              clusters.map((c) => (
                <div key={c.id} className="cluster-box">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div className="headline">{c.headline}</div>
                    <span className="badge badge-ink" title="Editorial Significance Signal">
                      Signal: {c.signal}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "var(--s3)", fontSize: "var(--step--1)", color: "var(--muted)" }}>
                    <span>{c.sourceCount} Source(s)</span>
                    <span>Best Tier: {c.topTier === 1 ? "Tier 1 (Official)" : "Tier 2 (Press)"}</span>
                    <span>Collected {timeAgo(c.createdAt)}</span>
                  </div>

                  <ul className="cluster-items">
                    {c.items.slice(0, 5).map((it) => (
                      <li key={it.id}>
                        <strong>{it.source.name}:</strong>{" "}
                        <a href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
                        {it.snippet && <span style={{ opacity: 0.8 }}> — {it.snippet.slice(0, 160)}…</span>}
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: "flex", gap: "var(--s2)", marginTop: "var(--s4)" }}>
                    <form action={async () => {
                      "use server";
                      await createFromClusterAction(c.id, false);
                    }}>
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Create Manual Draft
                      </button>
                    </form>
                    {hasLlm && (
                      <form action={async () => {
                        "use server";
                        await createFromClusterAction(c.id, true);
                      }}>
                        <button type="submit" className="btn btn-accent btn-sm">
                          ✨ Draft with AI Assistance
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* Tab 3: Drafts */}
        {tab === "drafts" && (
          <section aria-labelledby="h-tab-drafts">
            <h2 id="h-tab-drafts" className="sr-only">Draft Articles</h2>
            {draftArticles.length === 0 ? (
              <div className="empty">
                <h3>No Stories in Draft</h3>
                <p>Create a new story from a collected lead or start from scratch.</p>
              </div>
            ) : (
              draftArticles.map((a) => (
                <article key={a.id} className="story-item">
                  <div className="story-item-head">
                    <div>
                      <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span className="kicker">{a.category.name}</span>
                        <StatusBadge status={a.status} />
                        <ConfidenceChip value={a.confidence} />
                      </div>
                      <h3>
                        <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                      </h3>
                    </div>
                    <Link href={`/admin/articles/${a.id}`} className="btn btn-ghost btn-sm">
                      Continue Drafting →
                    </Link>
                  </div>
                  <div className="story-item-meta">
                    <span>By {a.author.name}</span>
                    <span>Last edit {timeAgo(a.updatedAt)}</span>
                    <span>{a.sources.length} Source(s)</span>
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {/* Tab 4: Published */}
        {tab === "published" && (
          <section aria-labelledby="h-tab-published">
            <h2 id="h-tab-published" className="sr-only">Published Live Articles</h2>
            {publishedArticles.length === 0 ? (
              <div className="empty">
                <h3>No Published Articles</h3>
                <p>Completed stories will appear here once all 15 gate checks are cleared.</p>
              </div>
            ) : (
              publishedArticles.map((a) => (
                <article key={a.id} className="story-item">
                  <div className="story-item-head">
                    <div>
                      <div style={{ display: "flex", gap: "var(--s2)", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span className="kicker">{a.category.name}</span>
                        <StatusBadge status={a.status} />
                        <ConfidenceChip value={a.confidence} />
                        {a.isLive && <span className="badge badge-accent">Live Event</span>}
                        {a.isDeveloping && <span className="badge badge-accent">Developing</span>}
                      </div>
                      <h3>
                        <Link href={`/admin/articles/${a.id}`}>{a.title}</Link>
                      </h3>
                    </div>
                    <div style={{ display: "flex", gap: "var(--s2)" }}>
                      <Link href={`/${a.category.slug}/${a.slug}`} target="_blank" className="btn btn-ghost btn-sm">
                        View Live ↗
                      </Link>
                      <Link href={`/admin/articles/${a.id}`} className="btn btn-ghost btn-sm">
                        Manage / Update
                      </Link>
                    </div>
                  </div>
                  <div className="story-item-meta">
                    <span>Published {a.publishedAt ? fmtDateTime(a.publishedAt) : "Scheduled"}</span>
                    <span>By {a.author.name}</span>
                    {a.updates.length > 0 && <span>{a.updates.length} Live Update(s)</span>}
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </>
  );
}
