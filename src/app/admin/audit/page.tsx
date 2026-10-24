import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requirePermission("audit:view");

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1 className="admin-title">Newsroom Audit Log</h1>
          <p style={{ margin: 0, fontSize: "var(--step--1)", color: "var(--muted)" }}>
            Immutable chronological record of publishing events, logins, and editorial decisions.
          </p>
        </div>
      </header>

      <div className="admin-content">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>User ID</th>
                <th>IP / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.createdAt)}</td>
                  <td>
                    <span className="badge badge-ink">{l.action}</span>
                  </td>
                  <td>{l.entity} {l.entityId && `(${l.entityId})`}</td>
                  <td>{l.userId || "System / Public"}</td>
                  <td style={{ fontSize: "var(--step--2)", color: "var(--muted)", maxWidth: "20rem", wordBreak: "break-all" }}>
                    {l.ip && <span>IP: {l.ip} </span>}
                    <code>{l.meta}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
