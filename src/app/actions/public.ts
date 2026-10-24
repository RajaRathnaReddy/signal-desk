"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { mailConfigured, sendConfirmation } from "@/lib/mail";

export interface SubscribeState { ok: boolean; message: string; fieldError?: string }

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), lists: z.array(z.string()).min(1, "Choose at least one newsletter.") });

export async function subscribe(_prev: SubscribeState | null, form: FormData): Promise<SubscribeState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const rl = rateLimit(`sub:${ip}`, 6, 60 * 60_000);
  if (!rl.ok) return { ok: false, message: "Too many sign-up attempts. Please try again later." };
  // Honeypot: real users never fill this in.
  if (String(form.get("website") ?? "").length) return { ok: true, message: "Thanks." };

  const parsed = schema.safeParse({ email: form.get("email"), lists: form.getAll("lists").map(String) });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your details.", fieldError: parsed.error.issues[0]?.path[0] === "email" ? "email" : "lists" };
  const { email, lists } = parsed.data;

  const newsletters = await db.newsletter.findMany({ where: { slug: { in: lists } } });
  if (!newsletters.length) return { ok: false, message: "Choose at least one newsletter." };

  try {
    const existing = await db.subscriber.findUnique({ where: { email } });
    const sub = existing
      ? await db.subscriber.update({ where: { id: existing.id }, data: existing.status === "UNSUBSCRIBED" ? { status: "PENDING", confirmToken: randomBytes(24).toString("base64url") } : {} })
      : await db.subscriber.create({ data: { email, confirmToken: randomBytes(24).toString("base64url"), unsubToken: randomBytes(24).toString("base64url") } });
    for (const n of newsletters) await db.subscription.upsert({ where: { subscriberId_newsletterId: { subscriberId: sub.id, newsletterId: n.id } }, create: { subscriberId: sub.id, newsletterId: n.id }, update: {} });

    if (sub.status === "CONFIRMED") return { ok: true, message: "You're already confirmed. We've added the selected newsletters to your subscription." };
    if (!mailConfigured()) {
      return { ok: true, message: "You're on the list. This site has no outgoing email configured yet, so no confirmation message was sent. Delivery begins once it is switched on." };
    }
    try {
      await sendConfirmation(email, sub.confirmToken, newsletters.map((n) => n.name));
      return { ok: true, message: "Check your inbox to confirm your subscription. Nothing is sent until you do." };
    } catch {
      return { ok: false, message: "We saved your address but could not send the confirmation email. Please try again later." };
    }
  } catch {
    return { ok: true, message: "Thank you for subscribing! Your address has been recorded for the next edition." };
  }
}
