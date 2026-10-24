import { db } from "./db";

export async function audit(action: string, o: { userId?: string | null; entity?: string; entityId?: string | null; meta?: Record<string, unknown>; ip?: string } = {}) {
  try {
    await db.auditLog.create({
      data: { action, userId: o.userId ?? null, entity: o.entity ?? "", entityId: o.entityId ?? null, meta: JSON.stringify(o.meta ?? {}), ip: o.ip ?? null },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
