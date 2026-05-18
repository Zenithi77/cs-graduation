// Server-only admin auth utilities.
// Admin сэшэн нь Firebase Auth-аас тусдаа — env-д тохируулсан username/password-р
// нэвтэрнэ, HMAC-SHA256-аар гарын үсэг зурсан HttpOnly cookie буцаана.
// Бүх admin endpoint-уудыг зөвхөн localhost-оос хандаж болохоор хязгаарлана.

import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 цаг

/** Host header нь loopback хаягтай эсэхийг шалгана. */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  // "[::1]:3000" эсвэл "127.0.0.1:3000" гэх мэтийг split хийнэ
  const hostname = host.replace(/^\[/, "").split("]")[0].split(":")[0];
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

/** Тухайн request loopback-оос ирсэн эсэхийг next/headers-ээр шалгана. */
export function isLocalRequest(): boolean {
  return isLocalHost(headers().get("host"));
}

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET env тохируулагдаагүй (16+ тэмдэгт байх ёстой).",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/** Шинэ admin token үүсгэнэ. */
export function newAdminToken(): { value: string; expires: Date } {
  const expMs = Date.now() + SESSION_TTL_MS;
  const sig = sign(`admin.${expMs}`);
  return { value: `${expMs}.${sig}`, expires: new Date(expMs) };
}

/** Token-ийг шалгана — exp хүрээгээ хэтрээгүй, signature нь зөв байх ёстой. */
export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const idx = token.indexOf(".");
  if (idx <= 0) return false;
  const expStr = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  let expected: string;
  try {
    expected = sign(`admin.${exp}`);
  } catch {
    return false;
  }
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Cookie дотроос admin session-ийг уншиж шалгана. */
export function isAdminAuthenticated(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}
