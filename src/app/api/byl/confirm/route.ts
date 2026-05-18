// POST /api/byl/confirm
// Thin proxy — бодит логик нь `bylConfirm` Cloud Function-д байна.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getFnBase(): string {
  const base = process.env.BYL_FUNCTIONS_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("[byl] BYL_FUNCTIONS_BASE_URL env тохируулагдаагүй байна.");
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${getFnBase()}/bylConfirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[api/byl/confirm proxy]", err);
    return NextResponse.json(
      { error: err?.message ?? "Confirm proxy алдаа." },
      { status: 500 }
    );
  }
}
