// POST /api/byl/checkout
// Хэрэглэгчийн сонгосон дүнгээр byl.mn checkout үүсгэж URL буцаана.
import { NextRequest, NextResponse } from "next/server";
import { createCheckout } from "@/lib/byl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_AMOUNTS = new Set([15000, 25000, 50000, 100000]);
const MIN_CUSTOM = 1000;
const MAX_CUSTOM = 5_000_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const amountRaw = Number(body?.amount);
    const uid = typeof body?.uid === "string" ? body.uid : null;
    const displayName =
      typeof body?.displayName === "string" ? body.displayName.slice(0, 80) : "";
    const note = typeof body?.note === "string" ? body.note.slice(0, 200) : "";

    // Дүнгийн шалгалт
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      return NextResponse.json({ error: "Дүн буруу байна." }, { status: 400 });
    }
    const amount = Math.floor(amountRaw);
    const isPreset = ALLOWED_AMOUNTS.has(amount);
    if (!isPreset && (amount < MIN_CUSTOM || amount > MAX_CUSTOM)) {
      return NextResponse.json(
        { error: `Custom дүн ${MIN_CUSTOM}–${MAX_CUSTOM}₮ хооронд байх ёстой.` },
        { status: 400 }
      );
    }
    if (!uid) {
      return NextResponse.json(
        { error: "Хандив өгөхийн тулд нэвтэрсэн байх шаардлагатай." },
        { status: 401 }
      );
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const productName = displayName
      ? `Төгсөлтийн хураамж — ${displayName}`
      : "Төгсөлтийн хураамж";

    const checkout = await createCheckout({
      success_url: `${site}/fund/success?checkout_id={CHECKOUT_ID}`,
      cancel_url: `${site}/fund`,
      client_reference_id: uid,
      items: [
        {
          price_data: {
            unit_amount: amount,
            product_data: {
              name: productName,
              client_reference_id: uid,
            },
          },
          quantity: 1,
        },
      ],
    });

    return NextResponse.json({
      id: checkout.data.id,
      url: checkout.data.url,
    });
  } catch (err: any) {
    console.error("[api/byl/checkout]", err);
    return NextResponse.json(
      { error: err?.message || "Checkout үүсгэхэд алдаа гарлаа." },
      { status: 500 }
    );
  }
}
