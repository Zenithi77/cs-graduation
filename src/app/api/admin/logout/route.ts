// POST /api/admin/logout — admin session cookie-г устгана.
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isLocalHost } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isLocalHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return res;
}
