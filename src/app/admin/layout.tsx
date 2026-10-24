import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/actions/admin";

export const metadata: Metadata = {
  title: "Editorial Desk",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // On the login page, render children directly without the sidebar shell
  if (!user) {
    return <>{children}</>;
  }

  const [reviewCount, draftCount, openClusters] = await Promise.all([
    db.article.count({ where: { status: { in: ["FACT CHECK", "EDITOR REVIEW", "IMAGE REVIEW", "SEO REVIEW"] } } }),
    db.article.count({ where: { status: "DRAFT" } }),
    db.storyCluster.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link href="/admin" className="desk-title" style={{ textDecoration: "none", color: "inherit" }}>
            Signal Desk <span className="kicker" style={{ fontSize: "0.65rem", display: "inline-block", marginLeft: "0.2rem" }}>CMS</span>
          </Link>
          <Link href="/" target="_blank" className="btn btn-ghost btn-sm" title="View live site">
            ↗
          </Link>
        </div>

        <nav className="admin-nav" aria-label="Editorial Desk Navigation">
          <Link href="/admin">
            <span>Newsroom Desk</span>
          </Link>
          <Link href="/admin?tab=clusters">
            <span>Collected Leads</span>
            {openClusters > 0 && <span className="count-badge">{openClusters}</span>}
          </Link>
          <Link href="/admin?tab=review">
            <span>Needs Review</span>
            {reviewCount > 0 && <span className="count-badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{reviewCount}</span>}
          </Link>
          <Link href="/admin?tab=drafts">
            <span>Drafts</span>
            {draftCount > 0 && <span className="count-badge">{draftCount}</span>}
          </Link>
          <Link href="/admin?tab=published">
            <span>Published</span>
          </Link>

          <hr style={{ margin: "var(--s3) 0", borderColor: "var(--line)" }} />

          <Link href="/admin/sources">
            <span>Sources &amp; Feeds</span>
          </Link>
          <Link href="/admin/newsletters">
            <span>Subscribers</span>
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin/audit">
              <span>Audit Log</span>
            </Link>
          )}
        </nav>

        <div className="admin-sidebar-user">
          <div>
            <strong>{user.name}</strong>
            <div style={{ fontSize: "var(--step--2)", color: "var(--muted)" }}>{user.role}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-sm" title="Sign out">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="admin-main">
        {children}
      </div>
    </div>
  );
}
