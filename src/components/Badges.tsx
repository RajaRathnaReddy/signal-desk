import type { ReactNode } from "react";

const CLASS_STYLE: Record<string, string> = {
  BREAKING: "badge badge-accent", RUMOR: "badge badge-warn", REPORT: "badge badge-warn", OPINION: "badge badge-info",
  ANALYSIS: "badge badge-info", SECURITY: "badge badge-bad", "PRODUCT LAUNCH": "badge badge-ink",
};

/** Classification label. NEWS is the default reading experience and is not labelled. */
export function ClassBadge({ value, hideNews = true }: { value: string; hideNews?: boolean }) {
  if (hideNews && value === "NEWS") return null;
  return <span className={CLASS_STYLE[value] ?? "badge"}>{value}</span>;
}

/** Readers only see a confidence label when the story is not fully confirmed. */
export function ConfidenceBadge({ value }: { value: string }) {
  if (value === "UNCONFIRMED") return <span className="badge badge-warn" title="A credible report that lacks sufficient independent confirmation">Unconfirmed</span>;
  if (value === "RUMOR") return <span className="badge badge-warn" title="Speculative information">Rumor</span>;
  if (value === "LIKELY") return <span className="badge badge-info" title="Strong reporting, not fully confirmed">Likely</span>;
  return null;
}

export function LiveBadge({ live, developing }: { live: boolean; developing: boolean }): ReactNode {
  if (live) return <span className="badge badge-accent badge-live"><span className="dot" aria-hidden />Live</span>;
  if (developing) return <span className="badge badge-accent badge-live"><span className="dot" aria-hidden />Developing</span>;
  return null;
}

export const STATUS_TONE: Record<string, string> = {
  COLLECTED: "badge", RESEARCHING: "badge badge-info", DRAFT: "badge", "FACT CHECK": "badge badge-warn", "EDITOR REVIEW": "badge badge-warn",
  "IMAGE REVIEW": "badge badge-warn", "SEO REVIEW": "badge badge-warn", SCHEDULED: "badge badge-info", PUBLISHED: "badge badge-ok",
  UPDATED: "badge badge-ok", REJECTED: "badge badge-bad", ARCHIVED: "badge",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={STATUS_TONE[status] ?? "badge"}>{status}</span>;
}

export function ConfidenceChip({ value }: { value: string }) {
  const tone = value === "VERIFIED" ? "badge-ok" : value === "LIKELY" ? "badge-info" : value === "DO NOT PUBLISH" ? "badge-bad" : "badge-warn";
  return <span className={`badge ${tone}`}>{value}</span>;
}
