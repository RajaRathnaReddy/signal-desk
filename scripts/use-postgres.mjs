import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

let schema = fs.readFileSync(schemaPath, "utf-8");

if (schema.includes('provider = "postgresql"')) {
  console.log("Prisma schema is already configured for PostgreSQL.");
} else {
  fs.writeFileSync(schemaPath + ".sqlite.bak", schema);
  schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);
  console.log("✔ Switched prisma/schema.prisma to provider = \"postgresql\".");
  console.log("  Backup saved as prisma/schema.prisma.sqlite.bak");
  console.log("\nNext steps:");
  console.log("  1. In .env, set DATABASE_URL=\"postgresql://user:password@localhost:5432/signaldesk?schema=public\"");
  console.log("  2. Run: npx prisma generate");
  console.log("  3. Run: npx prisma db push && npm run db:seed");
}
