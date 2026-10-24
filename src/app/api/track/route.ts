import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

const body = z.object({ articleId: z.string().min(5).max(40), type: z.enum(["VIEW", "READ", "SHARE"]), value: z.number().int().min(0).max(1800).default(1) });

function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true; // sendBeacon from same-origin pages may omit it on some browsers
  try {
    return new URL(o).host === (req.headers.get("host") ?? "");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  const ua = req.headers.get("user-agent") ?? "";
  // Daily-rotating salted hash: lets us count unique readers without storing an identifier.
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256").update(`${process.env.APP_SECRET}|${day}|${ip}|${ua}`).digest("hex").slice(0, 24);
  if (!rateLimit(`track:${visitorHash}`, 120, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { articleId, type, value } = parsed.data;
  const art = await db.article.findFirst({ where: { id: articleId, status: { in: ["PUBLISHED", "UPDATED"] } }, select: { id: true } });
  if (!art) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (type === "VIEW") {
    const seen = await db.analyticsEvent.findFirst({ where: { articleId, type: "VIEW", visitorHash, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } }, select: { id: true } });
    if (seen) return NextResponse.json({ ok: true, deduped: true });
  }
  await db.analyticsEvent.create({ data: { articleId, type, value, visitorHash } });
  return NextResponse.json({ ok: true });
}
