import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cwd = process.cwd();
    const envUrl = process.env.DATABASE_URL;
    const filesInCwd = fs.existsSync(cwd) ? fs.readdirSync(cwd) : [];
    const prismaDir = path.join(cwd, "prisma");
    const filesInPrisma = fs.existsSync(prismaDir) ? fs.readdirSync(prismaDir) : [];

    const articleCount = await db.article.count();
    return NextResponse.json({
      ok: true,
      articleCount,
      cwd,
      envUrl,
      filesInCwd,
      filesInPrisma,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({
      ok: false,
      error: e.message,
      stack: e.stack,
      cwd: process.cwd(),
      envUrl: process.env.DATABASE_URL,
    }, { status: 500 });
  }
}
