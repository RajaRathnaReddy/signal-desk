"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Signal Desk error boundary caught:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "var(--s6)", background: "var(--bg)", color: "var(--ink)" }}>
      <div style={{ maxWidth: "36rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-xl)", padding: "var(--s7)", boxShadow: "var(--shadow-hover)" }}>
        <p className="kicker" style={{ color: "var(--bad)", marginBottom: "var(--s2)" }}>500 // Disruption Detected</p>
        <h1 style={{ fontSize: "var(--step-3)", marginBottom: "var(--s3)" }}>Service Disruption</h1>
        <p style={{ color: "var(--ink-2)", marginBottom: "var(--s4)", lineHeight: 1.6 }}>
          An unexpected server error occurred while retrieving this dispatch. The newsroom systems are auto-recovering.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "var(--font-tech)", fontSize: "var(--step--2)", color: "var(--muted)", marginBottom: "var(--s5)" }}>
            Reference Digest: <code>{error.digest}</code>
          </p>
        )}
        <div style={{ display: "flex", gap: "var(--s3)", justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-accent" onClick={() => reset()}>
            Try Again
          </button>
          <Link href="/" className="btn btn-ghost">
            Return to Front Page
          </Link>
        </div>
      </div>
    </div>
  );
}
