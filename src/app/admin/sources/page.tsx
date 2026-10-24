import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORIES, SOURCE_TIERS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { createSourceAction, toggleSourceAction, triggerIngestAction } from "@/app/actions/admin";

import type { Source } from "@prisma/client";

export default async function SourcesPage() {
  await requirePermission("source:manage");

  type SourceWithCount = Source & {
    _count: { items: number };
  };

  const sources: SourceWithCount[] = (await db.source.findMany({
    orderBy: [{ tier: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  })) as SourceWithCount[];

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1 className="admin-title">News Sources &amp; Feeds</h1>
          <p style={{ margin: 0, fontSize: "var(--step--1)", color: "var(--muted)" }}>
            Monitored primary blogs, academic feeds, and technology publications.
          </p>
        </div>
        <form action={async () => {
          "use server";
          await triggerIngestAction();
        }}>
          <button type="submit" className="btn btn-accent btn-sm">
            Fetch All Active Feeds Now
          </button>
        </form>
      </header>

      <div className="admin-content">
        <div className="editor-grid">
          <main>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Tier / Type</th>
                    <th>Status</th>
                    <th>Last Check</th>
                    <th>Items</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: "var(--step--2)", color: "var(--muted)" }}>
                          <a href={s.feedUrl} target="_blank" rel="noopener noreferrer">{s.feedUrl}</a>
                        </div>
                        {s.lastError && (
                          <div style={{ color: "var(--bad)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                            Error: {s.lastError}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge">{SOURCE_TIERS[s.tier]?.split(" · ")[0]}</span>
                        <div style={{ fontSize: "var(--step--2)", color: "var(--muted)" }}>{s.type}</div>
                      </td>
                      <td>
                        <span className={`badge ${s.status === "HEALTHY" ? "badge-ok" : s.status === "DEGRADED" ? "badge-warn" : s.status === "FAILING" ? "badge-bad" : ""}`}>
                          {s.status}
                        </span>
                        {!s.active && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>[Paused]</div>}
                      </td>
                      <td>
                        {s.lastAttemptAt ? timeAgo(s.lastAttemptAt) : "Never"}
                      </td>
                      <td>
                        {s._count.items}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "var(--s2)" }}>
                          <form action={async () => {
                            "use server";
                            await triggerIngestAction(s.id);
                          }}>
                            <button type="submit" className="btn btn-ghost btn-sm" title="Fetch single source">
                              Test ↻
                            </button>
                          </form>
                          <form action={async () => {
                            "use server";
                            await toggleSourceAction(s.id, !s.active);
                          }}>
                            <button type="submit" className="btn btn-ghost btn-sm">
                              {s.active ? "Pause" : "Resume"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>

          <aside>
            <div className="editor-card">
              <h2>Add Monitored Source</h2>
              <form action={createSourceAction}>
                <div className="field">
                  <label htmlFor="name">Publisher Name</label>
                  <input id="name" type="text" name="name" required placeholder="e.g. Meta AI Research" />
                </div>

                <div className="field">
                  <label htmlFor="url">Website URL</label>
                  <input id="url" type="url" name="url" required placeholder="https://ai.meta.com/blog/" />
                </div>

                <div className="field">
                  <label htmlFor="feedUrl">RSS / Atom Feed URL</label>
                  <input id="feedUrl" type="url" name="feedUrl" required placeholder="https://ai.meta.com/blog/rss/" />
                </div>

                <div className="field">
                  <label htmlFor="tier">Source Tier</label>
                  <select id="tier" name="tier" defaultValue="1">
                    <option value="1">Tier 1 · Primary / Official</option>
                    <option value="2">Tier 2 · Reputable Press</option>
                    <option value="3">Tier 3 · Lead only</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="type">Source Type</label>
                  <select id="type" name="type" defaultValue="OFFICIAL_BLOG">
                    <option value="OFFICIAL_BLOG">Official Blog</option>
                    <option value="RESEARCH">Research / Academic</option>
                    <option value="GOVERNMENT">Government / Regulatory</option>
                    <option value="RSS">Press / Media RSS</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="categorySlug">Default Category</label>
                  <select id="categorySlug" name="categorySlug">
                    <option value="">(None)</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-accent btn-sm">
                  Register New Source
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
