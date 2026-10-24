import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/Parts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm Subscription",
  robots: { index: false },
};

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="container page">
        <EmptyState title="Invalid confirmation link">
          <p>No verification token was supplied. Please check the link in your email or sign up again on our <Link href="/newsletters">Newsletters</Link> page.</p>
        </EmptyState>
      </div>
    );
  }

  const sub = await db.subscriber.findUnique({
    where: { confirmToken: token },
    include: { subscriptions: { include: { newsletter: true } } },
  });

  if (!sub) {
    return (
      <div className="container page">
        <EmptyState title="Confirmation token expired or invalid">
          <p>We could not find a pending subscription matching this token. If you already confirmed, your subscription is active.</p>
          <p><Link href="/" className="btn btn-ghost btn-sm" style={{ marginTop: "var(--s3)" }}>Return Home</Link></p>
        </EmptyState>
      </div>
    );
  }

  if (sub.status !== "CONFIRMED") {
    await db.subscriber.update({
      where: { id: sub.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  }

  return (
    <div className="container page">
      <header className="page-head">
        <p className="kicker">Subscription Confirmed</p>
        <h1>You&apos;re All Set</h1>
        <p>
          Thank you for verifying your email address (<strong>{sub.email}</strong>).
        </p>
      </header>

      <div style={{ maxWidth: "42rem", marginTop: "var(--s5)" }}>
        <div className="takeaways">
          <h2>Your Active Subscriptions</h2>
          <ul>
            {sub.subscriptions.map((s) => (
              <li key={s.newsletterId}>
                <strong>{s.newsletter.name}</strong> ({s.newsletter.cadence}) — {s.newsletter.description}
              </li>
            ))}
          </ul>
        </div>

        <p style={{ marginTop: "var(--s6)" }}>
          <Link href="/" className="btn btn-accent">Explore Today&apos;s Stories →</Link>
        </p>
      </div>
    </div>
  );
}
