import { describe, expect, it } from "vitest";
import { parseFeed } from "@/lib/ingest/feed";

describe("RSS/Atom Feed Parser", () => {
  it("parses standard RSS 2.0 feeds with CDATA and HTML descriptions", () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech Dispatch</title>
    <link>https://example.com</link>
    <description>Daily tech news</description>
    <item>
      <title><![CDATA[Nvidia Announces Blackwell Ultra Server Deployments]]></title>
      <link>https://example.com/news/blackwell-ultra</link>
      <guid isPermaLink="true">https://example.com/news/blackwell-ultra</guid>
      <pubDate>Mon, 23 Mar 2026 14:30:00 GMT</pubDate>
      <description><![CDATA[<p>Enterprise cloud providers have begun receiving commercial shipments of <strong>Blackwell Ultra</strong> racks for large-scale training.</p>]]></description>
    </item>
  </channel>
</rss>`;

    const items = parseFeed(rssXml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Nvidia Announces Blackwell Ultra Server Deployments");
    expect(items[0].url).toBe("https://example.com/news/blackwell-ultra");
    expect(items[0].snippet).toContain("Enterprise cloud providers have begun receiving commercial shipments");
    expect(items[0].snippet).not.toContain("<p>");
    expect(items[0].snippet).not.toContain("<strong>");
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it("parses Atom feeds with link rel attributes and updated dates", () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Engineering Blog</title>
  <link href="https://example.org/feed" rel="self"/>
  <updated>2026-03-24T10:00:00Z</updated>
  <entry>
    <title>Distributed Checkpointing in Foundation Model Pretraining</title>
    <link rel="alternate" href="https://example.org/blog/distributed-checkpoints"/>
    <id>urn:uuid:12345-67890-abcdef</id>
    <updated>2026-03-24T09:15:00Z</updated>
    <summary>Techniques to serialize billion-parameter model states across distributed tensor parallel ranks.</summary>
  </entry>
</feed>`;

    const items = parseFeed(atomXml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Distributed Checkpointing in Foundation Model Pretraining");
    expect(items[0].url).toBe("https://example.org/blog/distributed-checkpoints");
    expect(items[0].snippet).toContain("Techniques to serialize billion-parameter model states");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-03-24T09:15:00.000Z");
  });

  it("skips malformed items missing URL or title", () => {
    const brokenXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Incomplete Feed</title>
    <item>
      <title>Missing link item</title>
    </item>
    <item>
      <link>https://example.com/valid-item</link>
      <title>Valid Item With Title</title>
      <description>Has all required fields.</description>
    </item>
  </channel>
</rss>`;

    const items = parseFeed(brokenXml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Valid Item With Title");
  });

  it("throws error on non-XML or unrecognised feed structure", () => {
    expect(() => parseFeed("<html><body>Not a feed</body></html>")).toThrow();
  });
});
