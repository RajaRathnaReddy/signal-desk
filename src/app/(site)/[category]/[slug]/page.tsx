import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticlePage } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { abs, articleJsonLd, articlePath, breadcrumbJsonLd, ldString } from "@/lib/seo";
import { fmtDateTime, fmtDate, fmtTime } from "@/lib/format";
import { ClassBadge, ConfidenceBadge, LiveBadge } from "@/components/Badges";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleClient, ShareControls } from "@/components/ArticleClient";
import { NewsletterBand } from "@/components/Parts";
import { SOURCE_TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const a = await getArticlePage(category, slug);
  if (!a) return { title: "Story not found", robots: { index: false } };
  const url = abs(articlePath(a.category.slug, a.slug));
  const img = a.hero ? (a.hero.url.startsWith("http") ? a.hero.url : abs(a.hero.url)) : undefined;
  return {
    title: a.seoTitle,
    description: a.metaDescription,
    alternates: { canonical: url },
    authors: [{ name: a.author.name }],
    openGraph: {
      type: "article", url, title: a.seoTitle, description: a.metaDescription, siteName: "Signal Desk",
      publishedTime: a.publishedAt, modifiedTime: a.modifiedAt ?? a.publishedAt, section: a.category.name, tags: a.tags.map((t) => t.name),
      ...(img ? { images: [{ url: img, width: a.hero?.width ?? 1200, height: a.hero?.height ?? 675, alt: a.hero?.alt }] } : {}),
    },
    twitter: { card: img ? "summary_large_image" : "summary", title: a.seoTitle, description: a.metaDescription, ...(img ? { images: [img] } : {}) },
  };
}

const KIND_LABEL: Record<string, string> = { ILLUSTRATION: "Illustration", CONCEPTUAL: "Conceptual image", PHOTO_OFFICIAL: "Official image", PHOTO_LICENSED: "Photo", PHOTO_EDITORIAL: "Photo" };

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params;
  const a = await getArticlePage(category, slug);
  if (!a) notFound();

  const url = abs(articlePath(a.category.slug, a.slug));
  const ld = articleJsonLd({
    title: a.title, deck: a.deck, slug: a.slug, categorySlug: a.category.slug, categoryName: a.category.name, publishedAt: a.publishedAt, modifiedAt: a.modifiedAt,
    authorName: a.author.name, isTeam: a.author.isTeam, imageUrl: a.hero?.url ?? null, tags: a.tags.map((t) => t.name), classification: a.classification, sources: a.sources,
  });
  const crumbs = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: a.category.name, path: `/${a.category.slug}` }, { name: a.title, path: articlePath(a.category.slug, a.slug) }]);
  const updated = a.modifiedAt && new Date(a.modifiedAt).getTime() - new Date(a.publishedAt).getTime() > 60_000 ? a.modifiedAt : null;
  const uncertain = a.confidence === "UNCONFIRMED" || a.confidence === "RUMOR" || a.classification === "RUMOR";

  return (
    <article className="container page" style={{ paddingTop: 0 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldString(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldString(crumbs) }} />
      <ArticleClient articleId={a.id} />

      <header className="article-head">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href={`/${a.category.slug}`}>{a.category.name}</Link></li>
            <li aria-current="page">{a.classification === "EXPLAINER" ? "Explainer" : a.classification === "NEWS" ? "News" : a.classification[0] + a.classification.slice(1).toLowerCase()}</li>
          </ol>
        </nav>
        <div className="flags">
          <Link href={`/${a.category.slug}`} className="kicker" style={{ alignSelf: "center", textDecoration: "none" }}>{a.category.name}</Link>
          <LiveBadge live={a.isLive} developing={a.isDeveloping} />
          <ClassBadge value={a.classification} />
          <ConfidenceBadge value={a.confidence} />
        </div>
        <h1>{a.title}</h1>
        {a.deck && <p className="deck">{a.deck}</p>}
        <div className="byline">
          <span>By <strong>{a.author.name}</strong></span>
          <span>Published <time dateTime={a.publishedAt}><strong>{fmtDateTime(a.publishedAt)}</strong></time></span>
          {updated && <span>Updated <time dateTime={updated}><strong>{fmtDateTime(updated)}</strong></time></span>}
          <span>{a.readingMinutes} min read</span>
        </div>
        {uncertain && (
          <div className="label-box" role="note">
            <strong>{a.confidence === "RUMOR" || a.classification === "RUMOR" ? "Rumor" : "Unconfirmed report"}</strong>
            This story is based on reporting we could not independently confirm. We say who reported it, what is known and what is not. Treat it as unverified.
          </div>
        )}
      </header>

      {a.hero && (
        <figure className="figure">
          <img src={a.hero.url} alt={a.hero.alt} width={a.hero.width ?? 1200} height={a.hero.height ?? 675} fetchPriority="high" decoding="async" />
          <figcaption><span className="kind">{KIND_LABEL[a.hero.kind] ?? "Image"}</span>{a.hero.caption}{a.hero.credit && <> <span style={{ opacity: 0.8 }}>({a.hero.credit})</span></>}</figcaption>
        </figure>
      )}

      <div className="article-layout">
        <ShareControls articleId={a.id} title={a.title} url={url} layout="rail" />
        <div id="article-body" style={{ display: "grid", gap: "var(--s6)", minWidth: 0 }}>
          {a.updates.length > 0 && (
            <section aria-labelledby="updates-h">
              <h2 id="updates-h" className="kicker" style={{ marginBottom: "var(--s3)" }}>{a.isLive ? "Live updates" : "Update history"}</h2>
              <ol className="timeline">
                {a.updates.map((u) => (
                  <li key={u.at}><time dateTime={u.at}>{fmtTime(u.at)} · {fmtDate(u.at)}</time><p>{u.text}</p></li>
                ))}
              </ol>
            </section>
          )}

          {a.keyTakeaways.length > 0 && (
            <section className="takeaways" aria-labelledby="kt-h">
              <h2 id="kt-h">Key points</h2>
              <ul>{a.keyTakeaways.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </section>
          )}

          <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.bodyMd) }} />

          {a.whyItMatters && (
            <section className="callout" aria-labelledby="wim-h">
              <h2 id="wim-h">Why it matters</h2>
              <p>{a.whyItMatters}</p>
            </section>
          )}

          {a.contextMd && (
            <section aria-labelledby="ctx-h">
              <h2 id="ctx-h" className="kicker" style={{ marginBottom: "var(--s2)" }}>Context and what is not known</h2>
              <div className="prose" style={{ fontSize: "1.05rem" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(a.contextMd) }} />
            </section>
          )}

          {a.technicalMd && (
            <details className="takeaways">
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Technical details</summary>
              <div className="prose" style={{ fontSize: "1rem", marginTop: "var(--s3)" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(a.technicalMd) }} />
            </details>
          )}

          {a.tags.length > 0 && (
            <div className="flags" aria-label="Topics">{a.tags.map((t) => <Link key={t.slug} className="tag" href={`/search?q=${encodeURIComponent(t.name)}`}>{t.name}</Link>)}</div>
          )}

          {a.sources.length > 0 && (
            <section className="sources" aria-labelledby="src-h">
              <h2 id="src-h">Sources</h2>
              <ol>
                {a.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a>
                    <span className="tier"> — {s.publisher} · {SOURCE_TIERS[s.tier]?.split(" · ")[1] ?? "Source"}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <aside className="author-box" aria-label="About the author">
            <span className="mark" aria-hidden="true">{a.author.name[0]}</span>
            <div>
              <strong>{a.author.name}</strong>
              {a.author.bio || "Reporting and editing by the Signal Desk newsroom."}
              <div style={{ marginTop: "0.4rem" }}><Link href="/standards">How we verify our reporting</Link> · <Link href="/standards#corrections">Corrections policy</Link></div>
            </div>
          </aside>

          <ShareControls articleId={a.id} title={a.title} url={url} layout="inline" />
        </div>
        <div />
      </div>

      <div className="article-after">
        {a.next && (
          <Link className="next-up" href={articlePath(a.next.categorySlug, a.next.slug)}>
            <span className="kicker">Next story</span>
            <strong>{a.next.title}</strong>
          </Link>
        )}
        {a.related.length > 0 && (
          <section className="section" aria-labelledby="rel-h">
            <div className="section-head"><h2 id="rel-h">Related stories</h2></div>
            <div className="grid grid-3">{a.related.map((r) => <ArticleCard key={r.id} a={r} variant="compact" />)}</div>
          </section>
        )}
        <section className="section"><NewsletterBand defaults={a.category.slug === "ai" ? ["ai-daily"] : a.category.slug === "security" ? ["security-brief"] : a.category.slug === "developer" ? ["developer-brief"] : ["daily-brief"]} /></section>
      </div>
    </article>
  );
}
