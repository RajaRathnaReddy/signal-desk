/* eslint-disable no-console */
import { ingestAll } from "../src/lib/ingest/run";
import { publishDueScheduled } from "../src/lib/workflow";
import { refreshTrending } from "../src/lib/queries";
import { db } from "../src/lib/db";

async function run() {
  console.log("=== Signal Desk Ingestion Pipeline Starting ===");
  const summary = await ingestAll();
  console.log(`Sources checked: ${summary.sources}`);
  console.log(`Success: ${summary.ok}, Failed: ${summary.failed}`);
  console.log(`New feed items collected: ${summary.newItems}`);
  console.log(`New story clusters formed: ${summary.newClusters}`);

  if (summary.errors.length) {
    console.warn("Source errors encountered:");
    summary.errors.forEach((e) => console.warn(`  - ${e.source}: ${e.error}`));
  }

  const scheduled = await publishDueScheduled();
  if (scheduled.published.length) {
    console.log(`Published scheduled articles: ${scheduled.published.join(", ")}`);
  }

  await refreshTrending(true);
  console.log("=== Ingestion Pipeline Complete ===");
}

run()
  .catch((e) => {
    console.error("Fatal ingestion error:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
