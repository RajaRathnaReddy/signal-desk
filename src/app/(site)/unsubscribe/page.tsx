import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/Parts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false },
};

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="container page">
        <EmptyState title="Invalid link">
          <p>No unsubscribe token was provided. Please use the personalized unsubscribe link from the footer of your email.</p>
        </EmptyState>
      </div>
    );
  }

  const sub = await db.subscriber.findUnique({
    where: { unsubToken: token },
  });

  if (!sub) {
    return (
      <div className="container page">
        <EmptyState title="Subscriber not found">
          <p>We could not find an active subscription associated with this link.</p>
        </EmptyState>
      </div>
    );
  }

  await db.subscriber.update({
    where: { id: sub.id },
    data: { status: "UNSUBSCRIBED" },
  });

  return (
    <div className="container page">
      <header className="page-head">
        <p className="kicker">Unsubscribed</p>
        <h1>You Have Been Removed</h1>
        <p>
          The email address <strong>{sub.email}</strong> will no longer receive any Signal Desk newsletters.
        </p>
      </header>

      <div style={{ maxWidth: "38rem", marginTop: "var(--s5)" }}>
        <p>
          We are sorry to see you go. If this was done in error, you can re-subscribe anytime from our{" "}
          <Link href="/newsletters">Newsletters directory</Link>.
        </p>

        <p style={{ marginTop: "var(--s5)" }}>
          <Link href="/" className="btn btn-ghost">Return to Homepage</Link>
        </p>
      </div>
    </div>
  );
}
