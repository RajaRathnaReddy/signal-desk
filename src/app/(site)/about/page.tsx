import type { Metadata } from "next";
import Link from "next/link";
import { abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About Signal Desk",
  description: "An independent technology newsroom committed to accuracy, clarity, and primary source verification.",
  alternates: { canonical: abs("/about") },
};

export default function AboutPage() {
  return (
    <div className="container page">
      <article className="doc">
        <header className="page-head">
          <p className="kicker">About</p>
          <h1>Independent Technology Reporting</h1>
          <p className="lede">
            Signal Desk is a modern technology publication built for readers who value substance over spectacle.
          </p>
        </header>

        <h2>Our Mission</h2>
        <p>
          The global technology landscape moves at dizzying speed, but too often the coverage swings between uncritical hype
          and superficial alarmism. We believe readers deserve clear, calm, and rigorous reporting that separates genuine breakthroughs
          from marketing claims.
        </p>
        <p>
          We cover the entire technology ecosystem—from artificial intelligence and semiconductors to cloud infrastructure,
          cybersecurity, developer tools, robotics, and biotechnology. We treat engineering realities with respect while keeping
          explanations accessible to non-specialists.
        </p>

        <h2>How We Operate</h2>
        <p>
          We are guided by five fundamental principles:
        </p>
        <ul>
          <li><strong>Accuracy Over Speed:</strong> We never rush to publish an unverified rumor just because it is trending on social media.</li>
          <li><strong>Primary Source Rigor:</strong> We trace every major claim back to technical papers, regulatory filings, official documentation, or verified direct statements.</li>
          <li><strong>Contextual Clarity:</strong> We plainly distinguish between what actually happened, what the company claims, what is independently confirmed, and what remains unknown.</li>
          <li><strong>No Deceptive Imagery:</strong> We never generate fictional event photographs, fake CEO portraits, or simulated interfaces. Conceptual art is always explicitly labelled as an illustration.</li>
          <li><strong>Human Accountability:</strong> While we leverage software to monitor feeds and check facts, every article published on Signal Desk is reviewed, vetted, and approved by a named human editor.</li>
        </ul>

        <h2>Editorial Leadership</h2>
        <p>
          Signal Desk is maintained by an independent editorial desk. When an article carries the byline <strong>Editorial Team</strong>,
          it represents collective reporting that has passed our multi-stage quality control gate and editorial review.
        </p>

        <h2>Contact & Tips</h2>
        <p>
          We welcome confidential tips, corrections, and technical feedback from researchers and practitioners across the industry.
          Reach out directly to our desk at <a href="mailto:editor@example.com">editor@example.com</a>.
        </p>

        <p style={{ marginTop: "var(--s6)" }}>
          <Link href="/standards" className="btn btn-ghost">Read our Editorial Standards →</Link>
        </p>
      </article>
    </div>
  );
}
