import type { Metadata } from "next";
import Link from "next/link";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/constants";
import { searchArticles, getCategories } from "@/lib/queries";
import { ArticleCard } from "@/components/ArticleCard";
import { EmptyState } from "@/components/Parts";
import { rateLimit } from "@/lib/ratelimit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", description: "Search Signal Desk by keyword, company, product, topic or date.", robots: { index: false, follow: true } };

type SP = { q?: string; category?: string; from?: string; to?: string; type?: string };

const parseDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined);

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const categories = await getCategories();
  let result: Awaited<ReturnType<typeof searchArticles>> | null = null;
  if (q.length >= 2) {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
    if (!rateLimit(`search:${ip}`, 60, 60_000).ok) return <div className="container page"><EmptyState title="Too many searches">Please wait a moment and try again.</EmptyState></div>;
    const to = parseDate(sp.to);
    result = await searchArticles(q, {
      category: CATEGORIES.some((c) => c.slug === sp.category) ? sp.category : undefined,
      from: parseDate(sp.from),
      to: to ? new Date(to.getTime() + 86_400_000 - 1) : undefined,
      classification: sp.type && /^[A-Z ]{3,20}$/.test(sp.type) ? sp.type : undefined,
    });
    const visitorHash = createHash("sha256").update(`${process.env.APP_SECRET}|${ip}`).digest("hex").slice(0, 24);
    await db.analyticsEvent.create({ data: { type: "SEARCH", query: q.toLowerCase(), visitorHash } }).catch(() => {});
  }

  return (
    <div className="container page">
      <header className="page-head">
        <p className="kicker">Search</p>
        <h1>Find a story</h1>
        <p>Search by keyword, company, product or topic. Small typos and related terms are handled for you.</p>
      </header>
      <form className="search-form" action="/search" role="search">
        <label className="sr-only" htmlFor="q">Search stories</label>
        <input id="q" type="search" name="q" defaultValue={q} placeholder="e.g. Nvidia, vulnerability, language model" autoFocus={!q} />
        <button className="btn" type="submit">Search</button>
      </form>
      <details className="filters-wrap" open={!!(sp.category || sp.from || sp.to || sp.type)} style={{ marginBottom: "var(--s5)" }}>
        <summary style={{ cursor: "pointer", fontSize: "var(--step--1)", fontWeight: 600 }}>Filters</summary>
        <form className="filters" action="/search" style={{ marginTop: "var(--s3)" }}>
          <input type="hidden" name="q" value={q} />
          <label className="label">Category <select name="category" defaultValue={sp.category ?? ""}><option value="">All</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label className="label">Type <select name="type" defaultValue={sp.type ?? ""}><option value="">All</option>{["NEWS", "ANALYSIS", "EXPLAINER", "RESEARCH", "SECURITY", "REVIEW", "REPORT", "RUMOR", "OPINION"].map((t) => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}</select></label>
          <label className="label">From <input type="date" name="from" defaultValue={sp.from ?? ""} style={{ width: "auto" }} /></label>
          <label className="label">To <input type="date" name="to" defaultValue={sp.to ?? ""} style={{ width: "auto" }} /></label>
          <button className="btn btn-ghost btn-sm" type="submit" style={{ alignSelf: "end" }}>Apply</button>
        </form>
      </details>

      <div aria-live="polite">
        {!q && <EmptyState title="Start with a word">Try a company such as Nvidia, a topic such as quantum, or a term such as RAG.</EmptyState>}
        {q && q.length < 2 && <EmptyState title="Too short">Enter at least two characters.</EmptyState>}
        {result && (
          <>
            <p className="meta" style={{ marginBottom: "var(--s4)" }}>{result.total} {result.total === 1 ? "result" : "results"} for “{q}”</p>
            {result.didYouMean && <p>Did you mean <Link href={`/search?q=${encodeURIComponent(result.didYouMean)}`}><strong>{result.didYouMean}</strong></Link>?</p>}
            {result.items.length === 0 ? (
              <EmptyState title="No matching stories">We couldn&apos;t find anything for that. Try a broader term, or browse the <Link href="/latest">latest stories</Link>.</EmptyState>
            ) : (
              <div style={{ maxWidth: "58rem" }}>{result.items.map((a) => <ArticleCard key={a.id} a={a} variant="row" />)}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
