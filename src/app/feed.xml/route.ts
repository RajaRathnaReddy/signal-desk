import { NextResponse } from "next/server";

export function GET(req: Request) {
  const url = new URL("/rss.xml", req.url);
  return NextResponse.redirect(url, { status: 301 });
}
