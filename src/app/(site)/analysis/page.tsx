import type { Metadata } from "next";
import { getByClassification } from "@/lib/queries";
import { ListPage, PAGE_SIZE, pageParam } from "@/components/ListPage";
import { SECTIONS } from "@/lib/constants";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";
const S = SECTIONS.analysis;
export const metadata: Metadata = { title: S.name, description: S.description, alternates: { canonical: abs("/analysis") } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam(await searchParams);
  const { items, total } = await getByClassification("analysis", PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return (
    <ListPage kicker="Section" title={S.name} description={`${S.description} Analysis reflects our reading of the facts, and is labelled so it is never mistaken for news.`} items={items} total={total} page={page} basePath="/analysis"
      emptyTitle="No analysis published yet" emptyBody={<p>Analysis and commentary will appear here, clearly separated from reporting.</p>} />
  );
}
