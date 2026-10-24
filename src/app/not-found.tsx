import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="container page" style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", paddingBlock: "var(--s8)" }}>
        <div style={{ maxWidth: "34rem" }}>
          <p className="kicker" style={{ fontSize: "var(--step-0)", marginBottom: "var(--s2)" }}>404 // Signal Lost</p>
          <h1 style={{ fontSize: "var(--step-4)", marginBottom: "var(--s3)" }}>Story Not Found</h1>
          <p style={{ color: "var(--ink-2)", marginBottom: "var(--s5)" }}>
            The dispatch or analysis you are looking for does not exist, has been archived, or may have been moved.
          </p>
          <div style={{ display: "flex", gap: "var(--s3)", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" className="btn btn-accent">Return Home</Link>
            <Link href="/latest" className="btn btn-ghost">Latest News</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
