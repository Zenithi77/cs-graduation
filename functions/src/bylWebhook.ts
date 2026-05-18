/**
 * bylWebhook — byl.mn-ийн checkout.completed /
 * invoice.paid event-үүдийг хүлээн авах
 * HTTPS Cloud Function. byl.mn dashboard-д энэх
 * функцийн URL-ийг webhook endpoint-ээр тохируулна.
 *
 * Secrets (Google Secret Manager-д урьдчилан үүсгэх):
 *   firebase functions:secrets:set BYL_WEBHOOK_SECRET
 */
import {onRequest} from "firebase-functions/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {
  verifyWebhookSignature,
  sanitizeCheckoutRaw,
  formatAmount,
  BylWebhookEvent,
} from "./byl.js";

if (!getApps().length) initializeApp();

const bylWebhookSecret = defineSecret("BYL_WEBHOOK_SECRET");

export const bylWebhook = onRequest(
  {secrets: [bylWebhookSecret]},
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed."});
      return;
    }

    // 1) Raw body авах — Express-ийн body parser автоматаар ажиллана
    //    Cloud Functions v2-д rawBody Buffer хэлбэрт байна.
    const rawBody: string =
      typeof req.body === "string" ?
        req.body :
        Buffer.isBuffer(req.rawBody) ?
          req.rawBody.toString("utf8") :
          JSON.stringify(req.body);

    const signature = req.headers["byl-signature"] as string | undefined;

    // 2) HMAC-SHA256 гарын үсэг шалгах
    let valid = false;
    try {
      valid = verifyWebhookSignature(
        rawBody, signature, bylWebhookSecret.value()
      );
    } catch (err) {
      logger.error("[bylWebhook] signature verify error", err);
      res.status(500).json({error: "server misconfigured"});
      return;
    }
    if (!valid) {
      logger.warn("[bylWebhook] invalid signature");
      res.status(401).json({error: "invalid signature"});
      return;
    }

    // 3) JSON parse
    let event: BylWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({error: "invalid json"});
      return;
    }

    try {
      const db = getFirestore(undefined as any, "default");
      const eventId = String((event as any).id ?? "");
      const eventType = (event as any).type ?? "unknown";

      // Idempotency
      const eventRef = eventId ?
        db.collection("processed_webhook_events").doc(eventId) :
        null;
      if (eventRef) {
        const snap = await eventRef.get();
        if (snap.exists) {
          res.json({ok: true, duplicate: true});
          return;
        }
      }

      if (event.type === "checkout.completed") {
        const obj = event.data.object;
        const checkoutId = String(obj.id);
        const paymentRef = db
          .collection("payments")
          .doc(`checkout_${checkoutId}`);

        const uid = obj.client_reference_id || null;
        const amountNum = Number(obj.amount_total) || 0;
        const isPaid = obj.status === "complete";

        const batch = db.batch();
        batch.set(paymentRef, {
          amount: formatAmount(amountNum),
          checkoutRaw: sanitizeCheckoutRaw(
            obj as unknown as Record<string, unknown>
          ),
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
        logger.info("[bylWebhook] checkout.completed saved", {checkoutId});
        res.json({ok: true});
        return;
      }

      if (event.type === "invoice.paid") {
        const obj = event.data.object;
        const paymentRef = db
          .collection("payments")
          .doc(`invoice_${obj.id}`);
        const amountNum = Number(obj.amount) || 0;
        const isPaid = obj.status === "paid";

        const batch = db.batch();
        batch.set(paymentRef, {
          amount: formatAmount(amountNum),
          checkoutRaw: sanitizeCheckoutRaw(
            obj as unknown as Record<string, unknown>
          ),
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
        logger.info("[bylWebhook] invoice.paid saved", {invoiceId: obj.id});
        res.json({ok: true});
        return;
      }

      // Unknown event type — just record and ack
      if (eventRef) {
        await eventRef.set({
          eventType,
          processedAt: FieldValue.serverTimestamp(),
        });
      }
      res.json({ok: true, ignored: true});
    } catch (err: unknown) {
      logger.error("[bylWebhook] handler error", err);
      res.status(500).json({error: (err as Error)?.message ?? "handler error"});
    }
  }
);
