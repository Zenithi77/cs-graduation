// Server-only BYL (byl.mn) клиент.
// ⚠️ Энэ файлыг client component-т import-лож БОЛОХГҮЙ — token задрах эрсдэлтэй.
import crypto from "crypto";

const API_BASE = process.env.BYL_API_BASE || "https://byl.mn/api/v1";
const PROJECT_ID = process.env.BYL_PROJECT_ID;
const TOKEN = process.env.BYL_TOKEN;
const WEBHOOK_SECRET = process.env.BYL_WEBHOOK_SECRET;

function assertEnv() {
  if (!PROJECT_ID || !TOKEN) {
    throw new Error(
      "[byl] BYL_PROJECT_ID болон BYL_TOKEN env хувьсагч тохируулагдаагүй байна."
    );
  }
}

export type CheckoutItem = {
  price_data: {
    unit_amount: number;
    product_data: { name: string; client_reference_id?: string };
  };
  quantity: number;
};

export type CreateCheckoutInput = {
  success_url?: string;
  cancel_url?: string;
  client_reference_id?: string;
  customer_email?: string;
  items: CheckoutItem[];
};

export type CheckoutResponse = {
  data: { id: number; url: string };
};

export async function createCheckout(
  input: CreateCheckoutInput
): Promise<CheckoutResponse> {
  assertEnv();
  const url = `${API_BASE}/projects/${PROJECT_ID}/checkouts`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(input),
    // Next.js fetch caching-аас сэргийлнэ
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[byl] checkout үүсгэхэд алдаа (${res.status}): ${text.slice(0, 500)}`
    );
  }
  return (await res.json()) as CheckoutResponse;
}

/**
 * Webhook гарын үсэг шалгах.
 * @param rawBody  request body-ийн raw string (JSON.parse хийгээгүй)
 * @param signature `Byl-Signature` header-ийн утга
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined
): boolean {
  if (!WEBHOOK_SECRET) {
    throw new Error("[byl] BYL_WEBHOOK_SECRET env тохируулагдаагүй байна.");
  }
  if (!signature) return false;

  const computed = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Timing-safe compare
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Webhook event төрлүүд
export type BylWebhookEvent =
  | {
      id: number;
      project_id: number;
      type: "checkout.completed";
      object: "checkout";
      data: { object: BylCheckoutObject };
      created_at: string;
      updated_at: string;
    }
  | {
      id: number;
      project_id: number;
      type: "invoice.paid";
      object: "invoice";
      data: { object: BylInvoiceObject };
      created_at: string;
      updated_at: string;
    };

export type BylCheckoutObject = {
  id: number;
  url: string;
  status: "open" | "complete" | "expired";
  amount_total: number;
  amount_subtotal: number;
  customer_email?: string | null;
  phone_number?: string | null;
  payment_method?: string | null;
  client_reference_id?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
  is_guest?: boolean;
  items?: Array<{
    id: number;
    quantity: number;
    amount_total: number;
    amount_subtotal: number;
    amount_unit: number;
    price?: { product?: { name?: string } };
  }>;
  created_at: string;
  updated_at: string;
};

export type BylInvoiceObject = {
  id: number;
  amount: number;
  number: string;
  status: "draft" | "open" | "paid" | "void";
  description?: string;
  url: string;
  client_reference_id?: string | null;
  created_at: string;
  updated_at: string;
};
