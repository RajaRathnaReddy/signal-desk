import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/queries";
import { articlePath } from "@/lib/seo";
import { fmtDate, timeAgo } from "@/lib/format";
import { ClassBadge, ConfidenceBadge, LiveBadge } from "./Badges";
import { EditorialArt } from "./EditorialArt";

type Variant = "lead" | "default" | "row" | "compact";

export function ArticleCard({ a, variant = "default", showArt = false, priority = false }: { a: Card; variant?: Variant; showArt?: boolean; priority?: boolean }) {
  const href = articlePath(a.categorySlug, a.slug);
  const hasThumb = !!a.image || showArt;
  const thumb = hasThumb ? (
    <div className="thumb">
      {a.image ? (
        <img src={a.image.url} alt={a.image.alt} width={a.image.width ?? 1200} height={a.image.height ?? 675} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} />
      ) : (
        <EditorialArt seed={a.slug} />
      )}
    </div>
  ) : null;

  const kickers = (
    <div className="kickers">
      <span className="kicker">{a.categoryName}</span>
      <LiveBadge live={a.isLive} developing={a.isDeveloping} />
      <ClassBadge value={a.classification} />
      <ConfidenceBadge value={a.confidence} />
    </div>
  );
  const meta = (
    <div className="meta">
      <time dateTime={a.publishedAt} title={fmtDate(a.publishedAt)}>{timeAgo(a.publishedAt)}</time>
      <span className="sep">{a.readingMinutes} min read</span>
    </div>
  );

  if (variant === "compact") {
    return (
      <article className="card card-compact">
        {kickers}
        <h3><Link href={href}>{a.title}</Link></h3>
        {meta}
      </article>
    );
  }
  if (variant === "row") {
    return (
      <article className={`card card-row ${a.image ? "has-thumb" : ""}`}>
        <div>
          {kickers}
          <h3><Link href={href}>{a.title}</Link></h3>
          {a.deck && <p className="deck">{a.deck}</p>}
          {meta}
        </div>
        {a.image && thumb}
      </article>
    );
  }
  return (
    <article className={`card ${variant === "lead" ? "card-lead" : ""}`}>
      {thumb}
      {kickers}
      <h3><Link href={href}>{a.title}</Link></h3>
      {a.deck && <p className="deck">{a.deck}</p>}
      {meta}
    </article>
  );
}
