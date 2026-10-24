import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewslettersAdminPage() {
  await requirePermission("newsletter:view");

  const [newsletters, subscribers, confirmedCount, pendingCount] = await Promise.all([
    db.newsletter.findMany({
      include: { _count: { select: { subscriptions: true } } },
    }),
    db.subscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { subscriptions: { include: { newsletter: true } } },
    }),
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.subscriber.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1 className="admin-title">Newsletters &amp; Subscribers</h1>
          <p style={{ margin: 0, fontSize: "var(--step--1)", color: "var(--muted)" }}>
            Double-opt-in subscription status and reader lists.
          </p>
        </div>
      </header>

      <div className="admin-content">
        <section className="metrics-strip" style={{ marginBottom: "var(--s5)" }}>
          <div className="metric-card ok">
            <div className="num">{confirmedCount}</div>
            <div className="label">Confirmed Readers</div>
          </div>
          <div className="metric-card warn">
            <div className="num">{pendingCount}</div>
            <div className="label">Pending Confirmation</div>
          </div>
          <div className="metric-card">
            <div className="num">{newsletters.length}</div>
            <div className="label">Active Newsletters</div>
          </div>
        </section>

        <h2 style={{ fontSize: "var(--step-1)", marginBottom: "var(--s3)" }}>Published Newsletters</h2>
        <div className="table-wrap" style={{ marginBottom: "var(--s6)" }}>
          <table>
            <thead>
              <tr>
                <th>Newsletter</th>
                <th>Cadence</th>
                <th>Subscribers</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {newsletters.map((n) => (
                <tr key={n.id}>
                  <td><strong>{n.name}</strong></td>
                  <td><span className="badge">{n.cadence}</span></td>
                  <td><strong>{n._count.subscriptions}</strong></td>
                  <td style={{ color: "var(--muted)" }}>{n.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: "var(--step-1)", marginBottom: "var(--s3)" }}>Recent Subscribers (Latest 50)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Subscriptions</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.email}</strong></td>
                  <td>
                    <span className={`badge ${s.status === "CONFIRMED" ? "badge-ok" : s.status === "PENDING" ? "badge-warn" : "badge-bad"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.subscriptions.map((sub) => sub.newsletter.name).join(", ") || "(None)"}
                  </td>
                  <td>{fmtDateTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
