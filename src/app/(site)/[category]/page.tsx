import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getLatest } from "@/lib/queries";
import { ListPage, PAGE_SIZE, pageParam } from "@/components/ListPage";
import { abs } from "@/lib/seo";
import { breadcrumbJsonLd, ldString } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCategories()).find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: cat.name,
    description: cat.description,
    alternates: { canonical: abs(`/${cat.slug}`) },
    openGraph: { title: `${cat.name} — Signal Desk`, description: cat.description, url: abs(`/${cat.slug}`) },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const page = pageParam(await searchParams);
  const cat = (await getCategories()).find((c) => c.slug === category);
  if (!cat) notFound();
  const { items, total } = await getLatest(PAGE_SIZE, (page - 1) * PAGE_SIZE, cat.slug);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: cat.name, path: `/${cat.slug}` }])) }} />
      <ListPage
        kicker="Section" title={cat.name} description={cat.description} items={items} total={total} page={page} basePath={`/${cat.slug}`}
        emptyTitle={`No ${cat.name} stories yet`}
        emptyBody={<p>Stories appear here once they have been verified and approved by an editor. Browse <Link href="/latest">everything we&apos;ve published</Link> in the meantime.</p>}
      />
    </>
  );
}
