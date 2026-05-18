// POST /api/admin/login
// Env-д тохируулсан ADMIN_USERNAME / ADMIN_PASSWORD-тай тулгаж шалгана.
// Амжилттай бол HttpOnly admin_session cookie буцаана. Зөвхөн localhost.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  ADMIN_COOKIE_NAME,
  isLocalHost,
  newAdminToken,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  if (!isLocalHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username || "");
  const password = String(body?.password || "");

  const expectUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const expectPass = process.env.ADMIN_PASSWORD;

  if (!expectPass) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD env тохируулагдаагүй байна." },
      { status: 500 },
    );
  }

  const userOk = safeEqual(username, expectUser);
  const passOk = safeEqual(password, expectPass);
  if (!userOk || !passOk) {
    return NextResponse.json(
      { error: "Хэрэглэгч эсвэл нууц үг буруу." },
      { status: 401 },
    );
  }

  let token;
  try {
    token = newAdminToken();
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Token үүсгэхэд алдаа." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token.value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: token.expires,
    // localhost-д http байх тул secure: false. Production-д admin зам нь
    // host gate-аар идэвхгүй болох тул аюулгүй.
    secure: false,
  });
  return res;
}
