import type { Metadata } from "next";
import { getByClassification } from "@/lib/queries";
import { ListPage, PAGE_SIZE, pageParam } from "@/components/ListPage";
import { SECTIONS } from "@/lib/constants";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";
const S = SECTIONS.explainers;
export const metadata: Metadata = { title: S.name, description: S.description, alternates: { canonical: abs("/explainers") } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam(await searchParams);
  const { items, total } = await getByClassification("explainers", PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return (
    <ListPage kicker="Section" title={S.name} description={S.description} items={items} total={total} page={page} basePath="/explainers"
      emptyTitle="No explainers yet" emptyBody={<p>Guides to how the technology works will appear here.</p>} />
  );
}
