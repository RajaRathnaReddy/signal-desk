import type { ReactNode } from "react";

const CLASS_STYLE: Record<string, string> = {
  BREAKING: "badge badge-bad",
  RUMOR: "badge badge-warn",
  REPORT: "badge badge-warn",
  OPINION: "badge badge-info",
  ANALYSIS: "badge badge-info",
  SECURITY: "badge badge-bad",
  "PRODUCT LAUNCH": "badge badge-accent",
};

/** Category badge with distinct neon dot indicator */
export function CategoryBadge({ slug, name }: { slug: string; name: string }) {
  return (
    <span className={`badge badge-cat badge-cat-${slug}`}>
      <span className="dot" aria-hidden="true" />
      {name}
    </span>
  );
}

/** Classification label. NEWS is standard reporting and not labeled. */
export function ClassBadge({ value, hideNews = true }: { value: string; hideNews?: boolean }) {
  if (hideNews && value === "NEWS") return null;
  return <span className={CLASS_STYLE[value] ?? "badge"}>{value}</span>;
}

/** Readers see confidence label when story is under evaluation */
export function ConfidenceBadge({ value }: { value: string }) {
  if (value === "UNCONFIRMED") return <span className="badge badge-warn" title="A credible report that lacks sufficient independent confirmation">Unconfirmed</span>;
  if (value === "RUMOR") return <span className="badge badge-warn" title="Speculative information">Rumor</span>;
  if (value === "LIKELY") return <span className="badge badge-info" title="Strong reporting, not fully confirmed">Likely</span>;
  if (value === "VERIFIED") return <span className="badge badge-ok" title="Passed 15-point deterministic gate check">✓ Verified</span>;
  return null;
}

export function LiveBadge({ live, developing }: { live: boolean; developing: boolean }): ReactNode {
  if (live) return <span className="badge badge-live"><span className="dot" aria-hidden="true" />Live Dispatch</span>;
  if (developing) return <span className="badge badge-live"><span className="dot" aria-hidden="true" />Developing</span>;
  return null;
}

export const STATUS_TONE: Record<string, string> = {
  COLLECTED: "badge",
  RESEARCHING: "badge badge-info",
  DRAFT: "badge",
  "FACT CHECK": "badge badge-warn",
  "EDITOR REVIEW": "badge badge-warn",
  "IMAGE REVIEW": "badge badge-warn",
  "SEO REVIEW": "badge badge-warn",
  SCHEDULED: "badge badge-info",
  PUBLISHED: "badge badge-ok",
  UPDATED: "badge badge-ok",
  REJECTED: "badge badge-bad",
  ARCHIVED: "badge",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={STATUS_TONE[status] ?? "badge"}>{status}</span>;
}

export function ConfidenceChip({ value }: { value: string }) {
  const tone = value === "VERIFIED" ? "badge-ok" : value === "LIKELY" ? "badge-info" : value === "DO NOT PUBLISH" ? "badge-bad" : "badge-warn";
  return <span className={`badge ${tone}`}>{value}</span>;
}
