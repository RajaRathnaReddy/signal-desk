/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { CATEGORIES, NEWSLETTERS } from "../src/lib/constants";
import { EXPLAINERS } from "./explainers";
import { advance, createFromCluster, runChecks, setImageApproval, uniqueSlug, updateArticle, type Actor } from "../src/lib/workflow";
import { db } from "../src/lib/db";

void createFromCluster;

/**
 * Initial source registry. These are real, public feeds from primary publishers and established press.
 * Their feed URLs are development configuration: each source starts as UNTESTED and only becomes HEALTHY after a
 * successful fetch. Administrators can edit, disable or add sources in /admin/sources without code changes.
 */
const SOURCES: { name: string; url: string; feedUrl: string; tier: number; type: string; category?: string }[] = [
  { name: "OpenAI News", url: "https://openai.com/news/", feedUrl: "https://openai.com/news/rss.xml", tier: 1, type: "OFFICIAL_BLOG", category: "ai" },
  { name: "Google Blog · AI", url: "https://blog.google/technology/ai/", feedUrl: "https://blog.google/technology/ai/rss/", tier: 1, type: "OFFICIAL_BLOG", category: "ai" },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog/", feedUrl: "https://deepmind.google/blog/rss.xml", tier: 1, type: "OFFICIAL_BLOG", category: "ai" },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog", feedUrl: "https://huggingface.co/blog/feed.xml", tier: 1, type: "OFFICIAL_BLOG", category: "ai" },
  { name: "NVIDIA Blog", url: "https://blogs.nvidia.com/", feedUrl: "https://blogs.nvidia.com/feed/", tier: 1, type: "OFFICIAL_BLOG", category: "hardware" },
  { name: "GitHub Blog", url: "https://github.blog/", feedUrl: "https://github.blog/feed/", tier: 1, type: "OFFICIAL_BLOG", category: "developer" },
  { name: "AWS News Blog", url: "https://aws.amazon.com/blogs/aws/", feedUrl: "https://aws.amazon.com/blogs/aws/feed/", tier: 1, type: "OFFICIAL_BLOG", category: "cloud" },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/", feedUrl: "https://blog.cloudflare.com/rss/", tier: 1, type: "OFFICIAL_BLOG", category: "cloud" },
  { name: "Microsoft Security Blog", url: "https://www.microsoft.com/en-us/security/blog/", feedUrl: "https://www.microsoft.com/en-us/security/blog/feed/", tier: 1, type: "OFFICIAL_BLOG", category: "security" },
  { name: "CISA Cybersecurity Advisories", url: "https://www.cisa.gov/news-events/cybersecurity-advisories", feedUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml", tier: 1, type: "GOVERNMENT", category: "security" },
  { name: "arXiv · Artificial Intelligence", url: "https://arxiv.org/list/cs.AI/recent", feedUrl: "https://rss.arxiv.org/rss/cs.AI", tier: 1, type: "RESEARCH", category: "ai" },
  { name: "Ars Technica", url: "https://arstechnica.com/", feedUrl: "https://feeds.arstechnica.com/arstechnica/index", tier: 2, type: "RSS" },
  { name: "The Verge", url: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml", tier: 2, type: "RSS" },
  { name: "TechCrunch", url: "https://techcrunch.com/", feedUrl: "https://techcrunch.com/feed/", tier: 2, type: "RSS", category: "startups" },
  { name: "WIRED", url: "https://www.wired.com/", feedUrl: "https://www.wired.com/feed/rss", tier: 2, type: "RSS" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/", feedUrl: "https://www.technologyreview.com/feed/", tier: 2, type: "RSS", category: "science" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/", feedUrl: "https://spectrum.ieee.org/feeds/feed.rss", tier: 2, type: "RSS", category: "hardware" },
];

async function main() {
  const prisma: PrismaClient = db;

  for (const c of CATEGORIES) await prisma.category.upsert({ where: { slug: c.slug }, create: { ...c, inNav: true }, update: { name: c.name, description: c.description, sortOrder: c.sortOrder } });
  for (const n of NEWSLETTERS) await prisma.newsletter.upsert({ where: { slug: n.slug }, create: n, update: { name: n.name, description: n.description, cadence: n.cadence } });
  for (const s of SOURCES) {
    await prisma.source.upsert({
      where: { feedUrl: s.feedUrl },
      create: { name: s.name, url: s.url, feedUrl: s.feedUrl, tier: s.tier, type: s.type, categorySlug: s.category ?? null },
      update: { name: s.name, url: s.url, tier: s.tier, type: s.type, categorySlug: s.category ?? null },
    });
  }
  const team = await prisma.author.upsert({ where: { slug: "editorial-team" }, create: { slug: "editorial-team", name: "Editorial Team", isTeam: true, bio: "The Signal Desk newsroom. Stories are checked against their sources and reviewed by an editor before publication." }, update: {} });

  const email = (process.env.ADMIN_EMAIL || "editor@example.com").toLowerCase();
  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    const pw = process.env.ADMIN_PASSWORD || `${randomBytes(9).toString("base64url")}aA1`;
    admin = await prisma.user.create({ data: { email, name: "Chief Editor", role: "ADMIN", passwordHash: await bcrypt.hash(pw, 12) } });
    console.log("\n────────────────────────────────────────────");
    console.log(" Administrator created");
    console.log(`   email:    ${email}`);
    console.log(`   password: ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : pw}`);
    console.log(" Change this password after first sign-in.");
    console.log("────────────────────────────────────────────\n");
  }
  const actor: Actor = { id: admin.id, role: admin.role, name: admin.name };

  // Evergreen explainers go through the *same* QC, review and publishing gate as any other article.
  for (const ex of EXPLAINERS) {
    if (await prisma.article.findUnique({ where: { slug: ex.slug } })) continue;
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: ex.category } });
    const art = await prisma.article.create({
      data: {
        slug: await uniqueSlug(ex.slug), title: ex.title, categoryId: category.id, authorId: team.id, classification: "EXPLAINER", confidence: "VERIFIED", status: "DRAFT",
        sources: { create: ex.sources.map((s) => ({ ...s })) },
        images: { create: [{ url: ex.image.url, alt: ex.image.alt, caption: ex.image.caption, kind: "ILLUSTRATION", credit: "Signal Desk", license: "Original", isHero: true, width: 1200, height: 675, depictsRealEvent: false }] },
      },
    });
    await updateArticle(art.id, {
      deck: ex.deck, seoTitle: ex.seoTitle, metaDescription: ex.metaDescription, bodyMd: ex.bodyMd, keyTakeaways: ex.keyTakeaways, whyItMatters: ex.whyItMatters, contextMd: ex.contextMd,
      tags: ex.tags, companies: ex.companies,
    }, actor, "Initial draft");
    await runChecks(art.id);
    const img = await prisma.image.findFirstOrThrow({ where: { articleId: art.id } });
    await setImageApproval(art.id, img.id, actor, true);
    try {
      await advance(art.id, actor, "Seed: draft complete"); // DRAFT → FACT CHECK
      await advance(art.id, actor, "Seed: references reviewed"); // → EDITOR REVIEW
      await advance(art.id, actor, "Seed: editorial review"); // → IMAGE REVIEW
      await advance(art.id, actor, "Seed: diagram checked"); // → SEO REVIEW
      const r = await advance(art.id, actor, "Seed: SEO checked"); // → PUBLISHED
      console.log(`✔ Published explainer: ${ex.slug} (${r.status})`);
    } catch (e) {
      const err = e as { message: string; details?: string[] };
      console.error(`✘ ${ex.slug} was blocked by the editorial gate: ${err.message}`, err.details ?? []);
    }
  }
  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
