import type { Metadata } from "next";
import { getByClassification } from "@/lib/queries";
import { ListPage, PAGE_SIZE, pageParam } from "@/components/ListPage";
import { SECTIONS } from "@/lib/constants";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";
const S = SECTIONS.reviews;
export const metadata: Metadata = { title: S.name, description: S.description, alternates: { canonical: abs("/reviews") } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam(await searchParams);
  const { items, total } = await getByClassification("reviews", PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return (
    <ListPage kicker="Section" title={S.name} description={S.description} items={items} total={total} page={page} basePath="/reviews"
      emptyTitle="No reviews published yet" emptyBody={<p>Reviews are written after hands-on testing. We don&apos;t publish a review of anything we haven&apos;t used.</p>} />
  );
}
