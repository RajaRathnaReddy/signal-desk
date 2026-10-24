const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export const fmtDate = (iso: string | Date) => DATE.format(new Date(iso));
export const fmtTime = (iso: string | Date) => `${TIME.format(new Date(iso))} UTC`;
export const fmtDateTime = (iso: string | Date) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

export function timeAgo(iso: string | Date, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(iso);
}
