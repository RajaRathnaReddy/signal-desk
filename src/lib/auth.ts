import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { can, type Permission } from "./rbac";
import { rateLimit } from "./ratelimit";
import { audit } from "./audit";

const COOKIE = "sd_session";
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MIN = 15;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Include upper-case, lower-case and a number.";
  return null;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` };
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Constant-ish time: always run a bcrypt compare.
  const dummy = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5XfE2jJ0m0J8iXK4fVXr4kGJ4Q1r6vS";
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummy);
  if (!user || !user.active || (user.lockedUntil && user.lockedUntil > new Date())) {
    await audit("login.denied", { entity: "user", meta: { email } });
    return { ok: false, error: "Sign-in failed. Check your details or try again later." };
  }
  if (!valid) {
    const fails = user.failedLogins + 1;
    await db.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null } });
    await audit("login.failed", { userId: user.id, entity: "user", entityId: user.id });
    return { ok: false, error: "Sign-in failed. Check your details or try again later." };
  }
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await db.session.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000), ip, userAgent: h.get("user-agent")?.slice(0, 200) },
  });
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_HOURS * 3600 });
  await audit("login.success", { userId: user.id, entity: "user", entityId: user.id });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) {
    const s = await db.session.findUnique({ where: { tokenHash: hashToken(t) } });
    await db.session.deleteMany({ where: { tokenHash: hashToken(t) } });
    if (s) await audit("logout", { userId: s.userId });
  }
  jar.delete(COOKIE);
}

export interface SessionUser { id: string; email: string; name: string; role: string }

export async function currentUser(): Promise<SessionUser | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await db.session.findUnique({ where: { tokenHash: hashToken(t) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return { id: s.user.id, email: s.user.email, name: s.user.name, role: s.user.role };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/admin/login");
  return u;
}

export async function requirePermission(p: Permission): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u.role, p)) {
    await audit("permission.denied", { userId: u.id, meta: { permission: p } });
    redirect("/admin?denied=1");
  }
  return u;
}
