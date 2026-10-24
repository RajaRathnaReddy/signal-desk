import Link from "next/link";
import { db } from "@/lib/db";
import { getByClassification, getDevelopingStories, getEditorsPicks, getLatest, getTrending, type ArticleCard as Card } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";
import { EmptyState, NewsletterBand, SectionHead } from "@/components/Parts";

export const dynamic = "force-dynamic";

async function CategoryBlock({ slug, title, exclude }: { slug: string; title: string; exclude: Set<string> }) {
  const { items } = await getLatest(8, 0, slug, undefined, true);
  const list = items.filter((a) => !exclude.has(a.id)).slice(0, 4);
  if (!list.length) return null;
  list.forEach((a) => exclude.add(a.id));
  return (
    <section className="section" aria-labelledby={`h-${slug}`}>
      <div className="section-head"><h2 id={`h-${slug}`}>{title}</h2><Link href={`/${slug}`} className="more">All {title.toLowerCase()} →</Link></div>
      <div className="grid grid-2">
        {list.map((a, i) => <ArticleCard key={a.id} a={a} variant={i === 0 ? "default" : "compact"} />)}
      </div>
    </section>
  );
}

export default async function Home() {
  const [news, explainers, picks, trending, developing, sourcesActive] = await Promise.all([
    getLatest(20, 0, undefined, undefined, true),
    getByClassification("explainers", 8, 0),
    getEditorsPicks(4),
    getTrending(5),
    getDevelopingStories(3),
    db.source.count({ where: { active: true } }),
  ]);

  const hasNews = news.items.length > 0;
  const pool: Card[] = hasNews ? news.items : explainers.items;
  const shown = new Set<string>();
  const lead = pool[0];
  const side = pool.slice(1, 4);
  [lead, ...side].filter(Boolean).forEach((a) => shown.add(a.id));
  const stream = news.items.filter((a) => !shown.has(a.id)).slice(0, 8);
  stream.forEach((a) => shown.add(a.id));
  const explainerList = explainers.items.filter((a) => !shown.has(a.id)).slice(0, 4);

  return (
    <div className="container page">
      <div className="status-strip" role="status">
        <span><strong>{sourcesActive}</strong> sources monitored</span>
        <span>Nothing is published without source references and editor sign-off</span>
        <Link href="/standards" style={{ marginLeft: "auto" }}>How we verify →</Link>
      </div>

      {lead ? (
        <section className="hero" style={{ marginTop: "var(--s6)" }} aria-label="Top stories">
          <ArticleCard a={lead} variant="lead" showArt priority />
          <div className="hero-side">
            {side.map((a) => <ArticleCard key={a.id} a={a} />)}
          </div>
        </section>
      ) : (
        <div style={{ marginTop: "var(--s6)" }}>
          <EmptyState title="The first stories are in review">
            <p>Nothing is published here until it has cleared source checks and an editor&apos;s review. That takes longer than a feed, which is the point.</p>
            <p><Link href="/standards">Read how stories are verified</Link> or <Link href="/newsletters">subscribe</Link> to be told when the first ones go live.</p>
          </EmptyState>
        </div>
      )}

      {developing.length > 0 && (
        <section className="section" aria-labelledby="h-dev">
          <SectionHead title="Developing" note="Stories we are still reporting. Each shows a timestamped update history." />
          <div className="grid grid-3">{developing.map((a) => <ArticleCard key={a.id} a={a} variant="compact" />)}</div>
        </section>
      )}

      {stream.length > 0 && (
        <div className="home-cols section">
          <section aria-labelledby="h-latest">
            <div className="section-head"><h2 id="h-latest">Latest</h2><Link href="/latest" className="more">All latest →</Link></div>
            {stream.map((a) => <ArticleCard key={a.id} a={a} variant="row" />)}
          </section>
          <aside aria-label="Trending and picks">
            {trending.length > 0 && (
              <section aria-labelledby="h-trending">
                <div className="section-head"><h2 id="h-trending">Trending</h2></div>
                <ol className="numbered">{trending.map((a) => <li key={a.id}><ArticleCard a={a} variant="compact" /></li>)}</ol>
              </section>
            )}
            {picks.length > 0 && (
              <section className="section" aria-labelledby="h-picks">
                <div className="section-head"><h2 id="h-picks">Editors&apos; picks</h2></div>
                {picks.map((a) => <ArticleCard key={a.id} a={a} variant="compact" />)}
              </section>
            )}
          </aside>
        </div>
      )}

      {stream.length === 0 && (trending.length > 0 || picks.length > 0) && (
        <div className="grid grid-2 section">
          {trending.length > 0 && <section aria-labelledby="h-trending2"><div className="section-head"><h2 id="h-trending2">Trending</h2></div><ol className="numbered">{trending.map((a) => <li key={a.id}><ArticleCard a={a} variant="compact" /></li>)}</ol></section>}
          {picks.length > 0 && <section aria-labelledby="h-picks2"><div className="section-head"><h2 id="h-picks2">Editors&apos; picks</h2></div>{picks.map((a) => <ArticleCard key={a.id} a={a} variant="compact" />)}</section>}
        </div>
      )}

      <CategoryBlock slug="ai" title="AI today" exclude={shown} />
      <CategoryBlock slug="hardware" title="Hardware" exclude={shown} />
      <CategoryBlock slug="security" title="Security" exclude={shown} />
      <CategoryBlock slug="startups" title="Startups" exclude={shown} />
      <CategoryBlock slug="developer" title="Developer" exclude={shown} />

      {explainerList.length > 0 && (
        <section className="section" aria-labelledby="h-explainers">
          <SectionHead title="Explainers" href="/explainers" note="Plain-language guides to how the technology works. No news claims, just clarity." />
          <div className="grid grid-3">{explainerList.map((a) => <ArticleCard key={a.id} a={a} showArt />)}</div>
        </section>
      )}

      <section className="section" aria-labelledby="h-principles">
        <div className="section-head"><h2 id="h-principles">How a story gets here</h2><Link href="/standards" className="more">Editorial standards →</Link></div>
        <div className="principles">
          <div><span className="n">1</span><h3>Sourced</h3><p>Every factual story links to its primary sources: company announcements, filings, papers, repositories.</p></div>
          <div><span className="n">2</span><h3>Checked</h3><p>Figures, quotes and names are matched against sources. Conflicts between sources are flagged for a human, not smoothed over.</p></div>
          <div><span className="n">3</span><h3>Labelled</h3><p>Rumours and unconfirmed reports carry a visible label and say who reported what, and what is not confirmed.</p></div>
          <div><span className="n">4</span><h3>Edited</h3><p>Automation can find and summarise. It cannot publish. A named editor approves every story.</p></div>
        </div>
      </section>

      <section className="section"><NewsletterBand /></section>
    </div>
  );
}
