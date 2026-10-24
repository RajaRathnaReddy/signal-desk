import { PrismaClient } from "@prisma/client";
import path from "path";

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    return url;
  }
  if (url.startsWith("file:")) {
    const rawPath = url.replace(/^file:/, "");
    if (path.isAbsolute(rawPath)) return url;
    const sub = rawPath.replace(/^\.\//, "");
    const relativeToPrisma = sub.startsWith("prisma/") ? sub : `prisma/${sub}`;
    const resolved = path.resolve(process.cwd(), relativeToPrisma);
    return `file:${resolved}`;
  }
  return url;
}

const g = globalThis as unknown as { prisma?: PrismaClient };

const datasourceUrl = getDatasourceUrl();

export const db: PrismaClient =
  g.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = db;
