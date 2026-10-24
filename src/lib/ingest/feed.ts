import { XMLParser } from "fast-xml-parser";
import { stripHtml, truncate } from "../text";

export interface ParsedItem {
  guid: string;
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true, trimValues: true });

const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text(o["#text"] ?? o["@_href"] ?? "");
  }
  return "";
};

function toDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function linkOf(item: Record<string, unknown>): string {
  const l = item.link;
  if (typeof l === "string") return l.trim();
  const links = arr(l as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const alt = links.find((x) => typeof x === "object" && (!x["@_rel"] || x["@_rel"] === "alternate")) ?? links[0];
  return (alt && typeof alt === "object" ? text(alt["@_href"] ?? alt) : text(alt)).trim() || text(item.guid).trim();
}

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom. Only metadata and a short excerpt are retained — never full article bodies. */
export function parseFeed(xml: string, maxItems = 40): ParsedItem[] {
  const doc = parser.parse(xml);
  let raw: Record<string, unknown>[] = [];
  if (doc.rss?.channel) raw = arr(doc.rss.channel.item);
  else if (doc.feed) raw = arr(doc.feed.entry);
  else if (doc["rdf:RDF"]) raw = arr(doc["rdf:RDF"].item);
  else throw new Error("Not a recognised RSS/Atom feed");

  const out: ParsedItem[] = [];
  for (const it of raw.slice(0, maxItems)) {
    const url = linkOf(it);
    const title = stripHtml(text(it.title));
    if (!url || !title || !/^https?:\/\//i.test(url)) continue;
    const summary = text(it.description) || text(it.summary) || text(it["content:encoded"]) || text(it.content);
    out.push({
      guid: text(it.guid) || text(it.id) || url,
      url,
      title: truncate(title, 300),
      snippet: truncate(stripHtml(summary), 420),
      publishedAt: toDate(text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"])),
    });
  }
  return out;
}
