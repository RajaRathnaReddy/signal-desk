import { SITE_NAME } from "./constants";

export const siteUrl = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const abs = (path: string) => `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
export const articlePath = (categorySlug: string, slug: string) => `/${categorySlug}/${slug}`;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    url: siteUrl(),
    logo: { "@type": "ImageObject", url: abs("/icon.svg") },
    publishingPrinciples: abs("/standards"),
    correctionsPolicy: abs("/corrections"),
    ethicsPolicy: abs("/standards"),
  };
}

export interface ArticleLd {
  title: string; deck: string; slug: string; categorySlug: string; categoryName: string; publishedAt: string; modifiedAt: string | null;
  authorName: string; isTeam: boolean; imageUrl?: string | null; tags: string[]; classification: string; sources: { url: string }[];
}

export function articleJsonLd(a: ArticleLd) {
  const url = abs(articlePath(a.categorySlug, a.slug));
  const type = a.classification === "ANALYSIS" || a.classification === "OPINION" ? "OpinionNewsArticle" : a.classification === "REVIEW" ? "ReviewNewsArticle" : "NewsArticle";
  return {
    "@context": "https://schema.org",
    "@type": type,
    headline: a.title.slice(0, 110),
    description: a.deck,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    datePublished: a.publishedAt,
    dateModified: a.modifiedAt ?? a.publishedAt,
    author: a.isTeam ? { "@type": "Organization", name: a.authorName, url: siteUrl() } : { "@type": "Person", name: a.authorName },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: abs("/icon.svg") } },
    articleSection: a.categoryName,
    keywords: a.tags.join(", "),
    ...(a.imageUrl ? { image: [a.imageUrl.startsWith("http") ? a.imageUrl : abs(a.imageUrl)] } : {}),
    citation: a.sources.map((s) => s.url),
    isAccessibleForFree: true,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

/** Safe for embedding in <script type="application/ld+json">. */
export function ldString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
