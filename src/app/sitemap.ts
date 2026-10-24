import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getSitemapEntries();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: abs("/"), lastModified: new Date(), changeFrequency: "always", priority: 1.0 },
    { url: abs("/latest"), lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: abs("/analysis"), lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: abs("/explainers"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: abs("/reviews"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: abs("/standards"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: abs("/about"), lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: abs("/newsletters"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: abs(`/${c.slug}`),
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: 0.85,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: abs(`/${a.category.slug}/${a.slug}`),
    lastModified: a.modifiedAt ?? a.publishedAt ?? new Date(),
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  return [...staticRoutes, ...categoryRoutes, ...articleRoutes];
}
