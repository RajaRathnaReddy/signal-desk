import type { Role } from "./constants";

export type Permission =
  | "article:write" | "article:review" | "article:publish" | "article:reject"
  | "source:manage" | "ingest:run" | "user:manage" | "audit:view" | "newsletter:view" | "dashboard:view";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: ["article:write", "article:review", "article:publish", "article:reject", "source:manage", "ingest:run", "user:manage", "audit:view", "newsletter:view", "dashboard:view"],
  EDITOR: ["article:write", "article:review", "article:publish", "article:reject", "source:manage", "ingest:run", "newsletter:view", "dashboard:view"],
  WRITER: ["article:write", "dashboard:view"],
  VIEWER: ["dashboard:view"],
};

export function can(role: string | undefined | null, p: Permission): boolean {
  if (!role) return false;
  return (MATRIX[role as Role] ?? []).includes(p);
}
