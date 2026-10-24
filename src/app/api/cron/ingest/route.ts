import { NextResponse } from "next/server";
import { ingestAll } from "@/lib/ingest/run";
import { publishDueScheduled } from "@/lib/workflow";
import { refreshTrending } from "@/lib/queries";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ingestSummary = await ingestAll();
    const scheduledSummary = await publishDueScheduled();
    await refreshTrending(true);

    await audit("cron.ingest", {
      meta: {
        newItems: ingestSummary.newItems,
        newClusters: ingestSummary.newClusters,
        publishedScheduled: scheduledSummary.published.length,
      },
    });

    return NextResponse.json({
      ok: true,
      ingest: ingestSummary,
      scheduled: scheduledSummary,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
