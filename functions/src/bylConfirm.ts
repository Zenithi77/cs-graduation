/**
 * bylConfirm — /fund/success хуудснаас дуудагдах
 * баталгаажуулах HTTPS Cloud Function.
 * Webhook орж ирэхгүй тохиолдолд (жишээ нь: local dev,
 * tunneling тохируулаагүй үэд)
 * success хуудас энд хүсэлт илгээж, checkout-ийн төлвийг byl.mn-ээс шууд татаж
 * payments collection-д бичнэ. Idempotent.
 *
 * Secrets:
 *   firebase functions:secrets:set BYL_TOKEN
 */
import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getCheckout, formatAmount, sanitizeCheckoutRaw } from "./byl.js";

if (!getApps().length) initializeApp();

const bylToken = defineSecret("BYL_TOKEN");

export const bylConfirm = onRequest(
  { secrets: [bylToken], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    try {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : (req.body as Record<string, unknown>);
      const checkoutId = body?.checkout_id;
      if (!checkoutId || checkoutId === "{CHECKOUT_ID}") {
        res.status(400).json({ error: "checkout_id шаардлагатай." });
        return;
      }

      const projectId = process.env.BYL_PROJECT_ID ?? "";
      if (!projectId) {
        logger.error("[bylConfirm] BYL_PROJECT_ID env is not set");
        res.status(500).json({ error: "server misconfigured" });
        return;
      }

      const db = getFirestore(undefined as any, "(default)");
      const docId = `checkout_${checkoutId}`;
      const ref = db.collection("payments").doc(docId);
      const snap = await ref.get();
      if (snap.exists) {
        const status = snap.data()?.status ?? null;
        res.json({ ok: true, alreadyRecorded: true, status });
        return;
      }

      const obj = await getCheckout(
        String(checkoutId),
        bylToken.value(),
        projectId,
      );
      if (obj.status !== "complete") {
        res.json({
          ok: false,
          status: obj.status,
          message: "Чекоут төлөгдөөгүй байна.",
        });
        return;
      }

      const amountNum = Number(obj.amount_total) || 0;
      await ref.set({
        amount: formatAmount(amountNum),
        checkoutRaw: sanitizeCheckoutRaw(
          obj as unknown as Record<string, unknown>,
        ),
        checkout_id: obj.id,
        client_reference_id: obj.client_reference_id || null,
        createdAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        planId: "unknown",
        status: "paid",
      });

      logger.info("[bylConfirm] payment recorded", { checkoutId });
      res.json({ ok: true, recorded: true });
    } catch (err: unknown) {
      logger.error("[bylConfirm] error", err);
      res
        .status(500)
        .json({ error: (err as Error)?.message ?? "Алдаа гарлаа." });
    }
  },
);
