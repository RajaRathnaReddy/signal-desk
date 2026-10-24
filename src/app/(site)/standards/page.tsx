import type { Metadata } from "next";
import Link from "next/link";
import { abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Editorial Standards & Verification Policy",
  description: "How Signal Desk verifies news, handles rumors, attributes sources, and corrects mistakes.",
  alternates: { canonical: abs("/standards") },
};

export default function StandardsPage() {
  return (
    <div className="container page">
      <article className="doc">
        <header className="page-head">
          <p className="kicker">Trust & Verification</p>
          <h1>Editorial Standards & Newsroom Guidelines</h1>
          <p className="lede">
            Our readers rely on Signal Desk for trustworthy, balanced, and verified technology reporting.
            Here is the framework we enforce before any story reaches the public.
          </p>
        </header>

        <h2>1. The Verification Gate</h2>
        <p>
          Every factual article must originate from legitimate sources. We categorize sources into clear confidence tiers:
        </p>
        <ul>
          <li><strong>Tier 1 (Primary Sources):</strong> Official corporate releases, technical whitepapers, peer-reviewed academic literature, government regulatory filings, and direct official GitHub repositories.</li>
          <li><strong>Tier 2 (Established Technology Press):</strong> Verified reporting by reputable journalistic organizations (e.g., Reuters, Bloomberg, The Verge, Ars Technica, Wired, MIT Technology Review).</li>
          <li><strong>Tier 3 (Leads & Community):</strong> Social media posts, forum discussions, and developer chat channels. Tier 3 items are strictly treated as leads and are never published as confirmed facts.</li>
        </ul>

        <h2>2. Editorial Confidence System</h2>
        <p>
          Before publication, our system assesses an internal confidence level:
        </p>
        <ul>
          <li><span className="badge badge-ok">VERIFIED</span> Multiple reliable sources or primary-source confirmation.</li>
          <li><span className="badge badge-info">LIKELY</span> Strong, reputable reporting from credible journalists, but awaiting primary confirmation.</li>
          <li><span className="badge badge-warn">UNCONFIRMED</span> Credible report that lacks sufficient corroboration. Prominently labeled for the reader.</li>
          <li><span className="badge badge-warn">RUMOR</span> Speculative or leaked information. Only covered when genuinely newsworthy, and never converted from &quot;may launch&quot; into &quot;will launch&quot;.</li>
          <li><span className="badge badge-bad">DO NOT PUBLISH</span> Insufficient evidence, suspicious sources, or unverifiable claims. Automatically blocked from publication.</li>
        </ul>

        <h2>3. 15-Point Editorial QC Checklist</h2>
        <p>
          Prior to release, every article must clear our 15-point editorial gate:
        </p>
        <ol>
          <li>Is the story real?</li>
          <li>Is the source trustworthy?</li>
          <li>Is the information current and dated accurately?</li>
          <li>Are all important facts supported without unresolved flags?</li>
          <li>Are claims correctly attributed to their respective entities?</li>
          <li>Are rumors and speculation clearly labeled?</li>
          <li>Is the headline informative, accurate, and free of clickbait?</li>
          <li>Is the article original synthesis, avoiding direct copying?</li>
          <li>Is the prose clear, human, and devoid of formulaic AI jargon?</li>
          <li>Does the story provide meaningful context and acknowledge what is unknown?</li>
          <li>Is the hero image strictly relevant to the subject matter?</li>
          <li>Does the image avoid misleading the reader about real events?</li>
          <li>Are live, clickable source citations provided?</li>
          <li>Is metadata, including canonical URL, schema, and title length, complete?</li>
          <li>Does the article achieve a quality score of at least 85/100?</li>
        </ol>

        <h2>4. Imagery &amp; Visual Authenticity</h2>
        <p>
          We hold visuals to the same standard of truth as our text:
        </p>
        <ul>
          <li>We <strong>never</strong> generate synthetic images that falsely depict real events, real executive appearances, product prototypes, or fake user interfaces.</li>
          <li>Official product photography or licensed press imagery is always prioritized for real-world hardware and software releases.</li>
          <li>When conceptual art or diagrams are used, they are explicitly tagged in the caption as an <strong>Illustration</strong> or <strong>Diagram</strong>.</li>
        </ul>

        <h2 id="corrections">5. Corrections Policy</h2>
        <p>
          We are committed to correcting factual errors promptly and transparently.
        </p>
        <p>
          When a substantial error is identified in a published piece:
        </p>
        <ul>
          <li>The text is updated immediately to reflect the correct facts.</li>
          <li>A clear correction notice is appended at the top or bottom of the article, specifying the date of the change and what was amended.</li>
          <li>Minor typographical fixes that do not alter the substance of the story are corrected without an editorial note.</li>
        </ul>
        <p>
          If you believe you have spotted a factual error in any Signal Desk article, please notify our editors with supporting links at{" "}
          <a href="mailto:corrections@example.com">corrections@example.com</a>.
        </p>

        <p style={{ marginTop: "var(--s6)" }}>
          <Link href="/" className="btn btn-ghost">← Return to Front Page</Link>
        </p>
      </article>
    </div>
  );
}
