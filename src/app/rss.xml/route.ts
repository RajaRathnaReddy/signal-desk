import { NextResponse } from "next/server";
import { getFeedArticles } from "@/lib/queries";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { abs, articlePath, xmlEscape } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const articles = await getFeedArticles(40);
  const site = abs("/");

  const itemsXml = articles
    .map((a) => {
      const url = abs(articlePath(a.category.slug, a.slug));
      const pubDate = (a.publishedAt ?? a.createdAt).toUTCString();
      return `    <item>
      <title>${xmlEscape(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xmlEscape(a.deck || a.title)}</description>
      <category>${xmlEscape(a.category.name)}</category>
      <author>${xmlEscape(a.author.name)}</author>
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${site}</link>
    <description>${xmlEscape(SITE_TAGLINE)}</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${abs("/rss.xml")}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
