// POST /api/byl/webhook
// byl.mn-ээс ирэх event-уудыг хүлээж аваад HMAC-SHA256 гарын үсгийг шалгана.
// Амжилттай тохиолдолд Firestore-ийн `payments` collection-д бичиж, давхар
// боловсруулалтаас сэргийлэхийн тулд `processed_webhook_events`-д event-ийг
// тэмдэглэнэ.
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, BylWebhookEvent } from "@/lib/byl";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ⚠️ Заавал nodejs runtime — crypto + raw body хэрэгтэй
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatAmount(n: number): string {
  // "5000.000000000000" хэлбэртэй 12 оронтой decimal string
  return (Number.isFinite(n) ? n : 0).toFixed(12);
}

// checkout.completed-ийн `data.object`-оос зөвхөн шаардлагатай талбаруудыг шүүж
// үлдээнэ. success_url / cancel_url / payment_method зэрэг payments collection-д
// хадгалах шаардлагагүй талбаруудыг хасна.
function sanitizeCheckoutRaw(obj: any) {
  const items = Array.isArray(obj?.items)
    ? obj.items.map((it: any) => ({
        adjustable_quantity: it?.adjustable_quantity ?? null,
        amount_subtotal: it?.amount_subtotal ?? null,
        amount_total: it?.amount_total ?? null,
        amount_unit: it?.amount_unit ?? null,
        price: it?.price
          ? {
              id: it.price.id ?? null,
              type: it.price.type ?? null,
              unit_amount: it.price.unit_amount ?? null,
            }
          : null,
        product: it?.product
          ? {
              client_reference_id: it.product.client_reference_id ?? null,
              id: it.product.id ?? null,
              name: it.product.name ?? null,
            }
          : null,
        quantity: it?.quantity ?? null,
      }))
    : [];

  return {
    amount_subtotal: obj?.amount_subtotal ?? null,
    amount_total: obj?.amount_total ?? null,
    client_reference_id: obj?.client_reference_id ?? null,
    created_at: obj?.created_at ?? null,
    customer: obj?.customer ?? null,
    customer_email: obj?.customer_email ?? null,
    delivery_address: obj?.delivery_address ?? null,
    delivery_address_collection: obj?.delivery_address_collection ?? false,
    expires_at: obj?.expires_at ?? null,
    id: obj?.id ?? null,
    is_guest: obj?.is_guest ?? false,
    items,
    mode: obj?.mode ?? null,
    phone_number: obj?.phone_number ?? null,
    phone_number_collection: obj?.phone_number_collection ?? false,
    project_id: obj?.project_id ?? null,
    status: obj?.status ?? null,
    updated_at: obj?.updated_at ?? null,
    url: obj?.url ?? null,
  };
}

export async function POST(req: NextRequest) {
  // 1) Raw body уншина (signature шалгах хэрэгцээтэй)
  const rawBody = await req.text();
  const signature = req.headers.get("byl-signature");

  // 2) Гарын үсэг шалгах
  let valid = false;
  try {
    valid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("[byl webhook] verify config error:", err);
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (!valid) {
    console.warn("[byl webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 3) Event JSON parse
  let event: BylWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const eventId = String((event as any).id ?? "");
    const eventType = (event as any).type ?? "unknown";

    // Idempotency — давтан хүлээж авсан event бол алгасна
    const eventRef = eventId
      ? db.collection("processed_webhook_events").doc(eventId)
      : null;
    if (eventRef) {
      const eventSnap = await eventRef.get();
      if (eventSnap.exists) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    if (event.type === "checkout.completed") {
      const obj = event.data.object;
      const checkoutId = String(obj.id);
      const paymentRef = db.collection("payments").doc(`checkout_${checkoutId}`);

      const uid = obj.client_reference_id || null;
      const amountNum = Number(obj.amount_total) || 0;
      const isPaid = obj.status === "complete";

      const batch = db.batch();
      batch.set(paymentRef, {
        amount: formatAmount(amountNum),
        checkoutRaw: sanitizeCheckoutRaw(obj),
        checkout_id: obj.id,
        client_reference_id: uid,
        createdAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        planId: "unknown",
        status: isPaid ? "paid" : obj.status,
      });

      if (eventRef) {
        batch.set(eventRef, {
          eventType,
          processedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.paid") {
      const obj = event.data.object;
      const paymentRef = db.collection("payments").doc(`invoice_${obj.id}`);
      const amountNum = Number(obj.amount) || 0;
      const isPaid = obj.status === "paid";

      const batch = db.batch();
      batch.set(paymentRef, {
        amount: formatAmount(amountNum),
        checkoutRaw: sanitizeCheckoutRaw(obj),
        checkout_id: obj.id,
        client_reference_id: obj.client_reference_id || null,
        createdAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        planId: "unknown",
        status: isPaid ? "paid" : obj.status,
      });

      if (eventRef) {
        batch.set(eventRef, {
          eventType,
          processedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    // Танихгүй event төрөл — processed гэж тэмдэглээд 200 буцаана
    if (eventRef) {
      await eventRef.set({
        eventType,
        processedAt: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ ok: true, ignored: true });
  } catch (err: any) {
    console.error("[byl webhook] handler error:", err);
    // 500 буцаавал Byl дахин оролдоно (3 удаа)
    return NextResponse.json(
      { error: err?.message || "handler error" },
      { status: 500 }
    );
  }
}
