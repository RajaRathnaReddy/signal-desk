import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { db } from "@/lib/db";

export async function NewsletterBand({ defaults }: { defaults?: string[] }) {
  const options = await db.newsletter.findMany({ orderBy: { name: "asc" } });
  return (
    <section className="newsletter-band" aria-labelledby="nl-title">
      <div>
        <p className="kicker" style={{ color: "var(--accent)" }}>Newsletters</p>
        <h2 id="nl-title">The stories that passed review, in your inbox.</h2>
        <p>Pick one or several. Each issue links to the original sources, and nothing is sent until you confirm your address. <Link href="/newsletters" style={{ color: "inherit" }}>Details</Link></p>
      </div>
      <NewsletterForm options={options} defaultSlugs={defaults ?? ["daily-brief"]} idPrefix="band" />
    </section>
  );
}

export function SectionHead({ title, href, note }: { title: string; href?: string; note?: string }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {href && <Link href={href} className="more">All {title.toLowerCase()} →</Link>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty" role="status">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
