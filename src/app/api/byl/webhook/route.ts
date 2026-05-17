// POST /api/byl/webhook
// byl.mn-ээс ирэх event-уудыг хүлээж аваад HMAC-SHA256 гарын үсгийг шалгана.
// Амжилттай тохиолдолд Firestore-д donation бичиж, хэрэглэгчийн нийт хандивыг
// FieldValue.increment-ээр шинэчилнэ.
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, BylWebhookEvent } from "@/lib/byl";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ⚠️ Заавал nodejs runtime — crypto + raw body хэрэгтэй
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // 4) Handler
  try {
    const db = getAdminDb();

    if (event.type === "checkout.completed") {
      const obj = event.data.object;
      const checkoutId = String(obj.id);
      const ref = db.collection("donations").doc(`checkout_${checkoutId}`);

      // Idempotency — нэг checkout-д зөвхөн нэг donation
      const existing = await ref.get();
      if (existing.exists) {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      const uid = obj.client_reference_id || null;
      const amount = Number(obj.amount_total) || 0;
      const productName =
        obj.items?.[0]?.price?.product?.name || "Төгсөлтийн хураамж";

      // displayName-ийг users/{uid} баримтаас уншиж donation-д хадгална
      let name = "Нэргүй";
      if (uid) {
        const userSnap = await db.collection("users").doc(uid).get();
        if (userSnap.exists) {
          const u = userSnap.data() as any;
          name = u?.displayName || u?.email || "Нэргүй";
        }
      } else if (obj.customer_email) {
        name = obj.customer_email;
      }

      const batch = db.batch();
      batch.set(ref, {
        source: "byl",
        checkoutId: obj.id,
        uid,
        name,
        amount,
        note: productName,
        paymentMethod: obj.payment_method ?? null,
        customerEmail: obj.customer_email ?? null,
        phoneNumber: obj.phone_number ?? null,
        status: obj.status,
        createdAt: FieldValue.serverTimestamp(),
        bylCreatedAt: obj.created_at,
      });

      if (uid && amount > 0) {
        batch.set(
          db.collection("users").doc(uid),
          {
            totalDonated: FieldValue.increment(amount),
            lastDonatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.paid") {
      const obj = event.data.object;
      const ref = db.collection("donations").doc(`invoice_${obj.id}`);
      const existing = await ref.get();
      if (existing.exists) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      await ref.set({
        source: "byl-invoice",
        invoiceId: obj.id,
        number: obj.number,
        uid: obj.client_reference_id || null,
        name: "Нэхэмжлэх",
        amount: Number(obj.amount) || 0,
        note: obj.description || "",
        status: obj.status,
        createdAt: FieldValue.serverTimestamp(),
        bylCreatedAt: obj.created_at,
      });
      return NextResponse.json({ ok: true });
    }

    // Танихгүй event төрөл — 200 буцаагаад дуусгана (Byl дахин оролдохгүй)
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
