/**
 * bylCheckout — Next.js /fund хуудснаас дуудагдах checkout үүсгэх
 * HTTPS Cloud Function.
 *
 * Secrets:
 *   firebase functions:secrets:set BYL_TOKEN
 *
 * Env vars (functions/.env):
 *   BYL_PROJECT_ID=392
 *   BYL_API_BASE=https://byl.mn/api/v1   (заавал биш, default байна)
 */
import { onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { createCheckout } from "./byl.js";

const bylToken = defineSecret("BYL_TOKEN");

const FUND_FEE = 15000;
const ALLOWED_AMOUNTS = new Set([FUND_FEE, 15000, 25000, 50000, 100000]);
const MIN_CUSTOM = 1000;
const MAX_CUSTOM = 5_000_000;

export const bylCheckout = onRequest(
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
      const amountRaw = Number(body?.amount);
      const uid = typeof body?.uid === "string" ? body.uid : null;
      const displayName =
        typeof body?.displayName === "string"
          ? String(body.displayName).slice(0, 80)
          : "";

      if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
        res.status(400).json({ error: "Дүн буруу байна." });
        return;
      }
      const amount = Math.floor(amountRaw);
      const isPreset = ALLOWED_AMOUNTS.has(amount);
      if (!isPreset && (amount < MIN_CUSTOM || amount > MAX_CUSTOM)) {
        const msg = `Custom дүн ${MIN_CUSTOM}–${MAX_CUSTOM}₮ хооронд байх ёстой.`;
        res.status(400).json({ error: msg });
        return;
      }
      if (!uid) {
        res
          .status(401)
          .json({ error: "Хандив өгөхийн тулд нэвтэрсэн байх шаардлагатай." });
        return;
      }

      const projectId = process.env.BYL_PROJECT_ID ?? "";
      if (!projectId) {
        logger.error("[bylCheckout] BYL_PROJECT_ID env is not set");
        res.status(500).json({ error: "server misconfigured" });
        return;
      }

      const site = process.env.SITE_URL?.trim().replace(/\/$/, "") ?? "";
      if (!site) {
        logger.error("[bylCheckout] SITE_URL env is not set");
        res.status(500).json({ error: "server misconfigured" });
        return;
      }

      const productName = displayName
        ? `Төгсөлтийн хураамж — ${displayName}`
        : "Төгсөлтийн хураамж";

      const checkout = await createCheckout(
        {
          success_url: `${site}/fund/success?checkout_id=%7BCHECKOUT_ID%7D`,
          cancel_url: `${site}/fund`,
          client_reference_id: uid,
          items: [
            {
              price_data: {
                unit_amount: amount,
                product_data: { name: productName, client_reference_id: uid },
              },
              quantity: 1,
            },
          ],
        },
        bylToken.value(),
        projectId,
      );

      res.json({ id: checkout.data.id, url: checkout.data.url });
    } catch (err: unknown) {
      logger.error("[bylCheckout] error", err);
      const errMsg = (err as Error)?.message ?? "Чекоут үүсгэхэд алдаа гарлаа.";
      res.status(500).json({ error: errMsg });
    }
  },
);
