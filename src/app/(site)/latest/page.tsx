import type { Metadata } from "next";
import { getLatest } from "@/lib/queries";
import { ListPage, PAGE_SIZE, pageParam } from "@/components/ListPage";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Latest", description: "Everything Signal Desk has published, newest first.", alternates: { canonical: abs("/latest") } };

export default async function Latest({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageParam(await searchParams);
  const { items, total } = await getLatest(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return (
    <ListPage kicker="Chronological" title="Latest" description="Everything we've published, newest first. Updated stories show their update time." items={items} total={total} page={page} basePath="/latest"
      emptyTitle="Nothing published yet" emptyBody={<p>Stories appear here after verification and editor approval.</p>} />
  );
}
