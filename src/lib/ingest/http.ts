/** Safe outbound HTTP for ingestion and link checking: protocol allow-list, private-network block, timeout, size cap. */
import { lookup } from "dns/promises";
import net from "net";

export const USER_AGENT = "SignalDeskBot/1.0 (+newsroom feed reader; respects robots.txt)";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new Error("Credentials in URLs are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private hosts are not allowed");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private addresses are not allowed");
  } else {
    const addrs = await lookup(host, { all: true });
    if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Host resolves to a private address");
  }
  return u;
}

export interface FetchResult { status: number; headers: Headers; text: string; notModified: boolean }

export async function safeFetch(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number; method?: string } = {}): Promise<FetchResult> {
  let current = (await assertPublicUrl(url)).toString();
  const timeout = opts.timeoutMs ?? 12_000;
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(current, {
        method: opts.method ?? "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5", ...opts.headers },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = (await assertPublicUrl(new URL(res.headers.get("location")!, current).toString())).toString();
        continue;
      }
      if (res.status === 304) return { status: 304, headers: res.headers, text: "", notModified: true };
      const max = opts.maxBytes ?? 10_000_000;
      let text = "";
      if (opts.method !== "HEAD" && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > max) {
            await reader.cancel();
            throw new Error("Response too large");
          }
          text += dec.decode(value, { stream: true });
        }
      }
      return { status: res.status, headers: res.headers, text, notModified: false };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Too many redirects");
}

// ── robots.txt (cached 6h) ─────────────────────────────────────────────────
const robotsCache = new Map<string, { at: number; disallow: string[] }>();

export function parseRobots(txt: string): string[] {
  const rules: string[] = [];
  let applies = false;
  let specific = false;
  const generic: string[] = [];
  const mine: string[] = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [k, ...rest] = line.split(":");
    const key = k.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      const ua = val.toLowerCase();
      applies = ua === "*" || "signaldeskbot".includes(ua);
      specific = ua !== "*" && applies;
    } else if (key === "disallow" && applies && val) (specific ? mine : generic).push(val);
  }
  rules.push(...(mine.length ? mine : generic));
  return rules;
}

export async function allowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  const origin = u.origin;
  let entry = robotsCache.get(origin);
  if (!entry || Date.now() - entry.at > 6 * 3600_000) {
    let disallow: string[] = [];
    try {
      const r = await safeFetch(`${origin}/robots.txt`, { timeoutMs: 6000, maxBytes: 300_000 });
      if (r.status === 200) disallow = parseRobots(r.text);
    } catch {
      /* unreachable robots.txt → treated as allow, per RFC 9309 for 4xx/unreachable */
    }
    entry = { at: Date.now(), disallow };
    robotsCache.set(origin, entry);
  }
  const path = u.pathname + u.search;
  return !entry.disallow.some((d) => (d === "/" ? true : path.startsWith(d.replace(/\*$/, ""))));
}
