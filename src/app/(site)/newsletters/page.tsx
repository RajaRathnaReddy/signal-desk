import type { Metadata } from "next";
import { db } from "@/lib/db";
import { NewsletterForm } from "@/components/NewsletterForm";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletters",
  description: "Subscribe to Signal Desk newsletters. Plain-language, verified reporting delivered directly to your inbox.",
  alternates: { canonical: abs("/newsletters") },
};

export default async function NewslettersPage() {
  const newsletters = await db.newsletter.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="container page">
      <header className="page-head">
        <p className="kicker">Email Briefings</p>
        <h1>Signal Desk Newsletters</h1>
        <p>
          Curated by our editorial team. Every briefing contains verified developments, primary source links,
          and clear context. We maintain a strict double-opt-in policy: no spam, no rented lists, and you can unsubscribe anytime.
        </p>
      </header>

      <div style={{ maxWidth: "44rem", marginTop: "var(--s6)" }}>
        <div className="takeaways" style={{ marginBottom: "var(--s6)" }}>
          <h2>Subscription Principles</h2>
          <ul>
            <li><strong>Double Opt-In:</strong> We require verification to prevent unauthorized submissions.</li>
            <li><strong>No Tracking Pixels:</strong> We prioritize reader privacy over open-rate analytics.</li>
            <li><strong>Source Traceability:</strong> Every headline is accompanied by its underlying primary citation.</li>
          </ul>
        </div>

        <NewsletterForm options={newsletters} defaultSlugs={["daily-brief"]} idPrefix="page-nl" />
      </div>
    </div>
  );
}
