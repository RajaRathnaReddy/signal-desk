"use client";

import { useEffect, useRef, useState } from "react";

/** Reading-progress bar + engagement tracker (view, engaged seconds, shares). No third-party scripts, no cookies. */
export function ArticleClient({ articleId }: { articleId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const engaged = useRef(0);

  useEffect(() => {
    const send = (type: string, value = 1) => {
      const body = JSON.stringify({ articleId, type, value });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    };
    send("VIEW");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.getElementById("article-body");
        if (!el || !bar.current) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight * 0.6;
        const p = Math.min(1, Math.max(0, (window.innerHeight * 0.2 - r.top) / Math.max(total, 1)));
        bar.current.style.transform = `scaleX(${p})`;
      });
    };
    const tick = setInterval(() => { if (document.visibilityState === "visible") engaged.current += 1; }, 1000);
    const flush = () => {
      if (engaged.current >= 5) { send("READ", Math.min(engaged.current, 1800)); engaged.current = 0; }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    onScroll();
    return () => {
      clearInterval(tick);
      flush();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [articleId]);

  return <div className="progress" ref={bar} role="progressbar" aria-label="Reading progress" aria-hidden="true" />;
}

export function ShareControls({ articleId, title, url, layout }: { articleId: string; title: string; url: string; layout: "rail" | "inline" }) {
  const [copied, setCopied] = useState(false);
  const track = () => {
    const body = JSON.stringify({ articleId, type: "SHARE", value: 1 });
    navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }));
  };
  const enc = encodeURIComponent;
  const cls = layout === "rail" ? "icon-btn" : "btn btn-ghost btn-sm";
  return (
    <div className={layout === "rail" ? "share-rail" : "share-inline"} role="group" aria-label="Share this story">
      <a className={cls} onClick={track} href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X">{layout === "rail" ? "𝕏" : "Share on X"}</a>
      <a className={cls} onClick={track} href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">{layout === "rail" ? "in" : "LinkedIn"}</a>
      <a className={cls} onClick={track} href={`mailto:?subject=${enc(title)}&body=${enc(url)}`} aria-label="Share by email">{layout === "rail" ? "✉" : "Email"}</a>
      <button
        type="button" className={cls} aria-label="Copy link"
        onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); track(); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}
      >
        {layout === "rail" ? (copied ? "✓" : "🔗") : copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
