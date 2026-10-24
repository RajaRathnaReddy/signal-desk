import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/queries";
import { ArticleCard } from "./ArticleCard";
import { EmptyState } from "./Parts";

export const PAGE_SIZE = 12;

export function ListPage({ kicker, title, description, items, total, page, basePath, emptyTitle, emptyBody }: {
  kicker: string; title: string; description: string; items: Card[]; total: number; page: number; basePath: string; emptyTitle: string; emptyBody: React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="container page">
      <header className="page-head">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      ) : (
        <>
          <div className="home-cols" style={{ display: "block", maxWidth: "58rem" }}>
            {items.map((a) => <ArticleCard key={a.id} a={a} variant="row" />)}
          </div>
          {pages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              {page > 1 ? <Link className="btn btn-ghost btn-sm" href={`${basePath}?page=${page - 1}`} rel="prev">← Newer</Link> : <span />}
              <span>Page {page} of {pages}</span>
              {page < pages ? <Link className="btn btn-ghost btn-sm" href={`${basePath}?page=${page + 1}`} rel="next">Older →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export const pageParam = (sp: { page?: string }) => Math.max(1, Math.min(500, parseInt(sp.page ?? "1", 10) || 1));
