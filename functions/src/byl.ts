/**
 * Shared BYL (byl.mn) types, API helpers, and Firestore utilities
 * used by all byl-related Cloud Functions.
 */
import * as crypto from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

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

export type BylCheckoutObject = {
  id: number;
  url: string;
  status: "open" | "complete" | "expired";
  amount_total: number;
  amount_subtotal: number;
  customer_email?: string | null;
  phone_number?: string | null;
  client_reference_id?: string | null;
  is_guest?: boolean;
  customer?: unknown;
  delivery_address?: unknown;
  delivery_address_collection?: boolean;
  expires_at?: string | null;
  mode?: string | null;
  phone_number_collection?: boolean;
  project_id?: number;
  items?: Array<{
    id?: number;
    quantity?: number;
    amount_total?: number;
    amount_subtotal?: number;
    amount_unit?: number;
    adjustable_quantity?: unknown;
    price?: {
      id?: unknown;
      type?: string;
      unit_amount?: number;
    };
    product?: {
      client_reference_id?: unknown;
      id?: unknown;
      name?: string;
    };
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

// ─── Signature verification ──────────────────────────────────────────────────

/**
 * Verifies a BYL webhook HMAC-SHA256 signature.
 * @param {string} rawBody - Raw request body string.
 * @param {string|null|undefined} signature - Signature header value.
 * @param {string} secret - Webhook secret key.
 * @return {boolean} True if signature is valid.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!secret) throw new Error("[byl] BYL_WEBHOOK_SECRET not configured.");
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── API calls ───────────────────────────────────────────────────────────────

const DEFAULT_API_BASE = "https://byl.mn/api/v1";

/**
 * Creates a new BYL checkout session.
 * @param {CreateCheckoutInput} input - Checkout input parameters.
 * @param {string} token - BYL API token.
 * @param {string} projectId - BYL project ID.
 * @return {Promise} Checkout data with id and url.
 */
export async function createCheckout(
  input: CreateCheckoutInput,
  token: string,
  projectId: string
): Promise<{ data: { id: number; url: string } }> {
  const base = process.env.BYL_API_BASE ?? DEFAULT_API_BASE;
  const res = await fetch(`${base}/projects/${projectId}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[byl] createCheckout error (${res.status}): ${text.slice(0, 500)}`
    );
  }
  return res.json() as Promise<{ data: { id: number; url: string } }>;
}

/**
 * Retrieves a BYL checkout object by ID.
 * @param {string|number} checkoutId - The checkout ID.
 * @param {string} token - BYL API token.
 * @param {string} projectId - BYL project ID.
 * @return {Promise} The BylCheckoutObject.
 */
export async function getCheckout(
  checkoutId: string | number,
  token: string,
  projectId: string
): Promise<BylCheckoutObject> {
  const base = process.env.BYL_API_BASE ?? DEFAULT_API_BASE;
  const url =
    `${base}/projects/${projectId}/checkouts/${checkoutId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[byl] getCheckout error (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const json = (await res.json()) as { data: BylCheckoutObject };
  return json.data;
}

// ─── Firestore helpers ───────────────────────────────────────────────────────

/**
 * Formats an amount as a fixed-precision decimal string.
 * @param {number} n - The numeric amount.
 * @return {string} Fixed-precision string representation.
 */
export function formatAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(12);
}

/**
 * Sanitizes a raw checkout object for Firestore storage.
 * @param {Record<string, unknown>} obj - Raw checkout object.
 * @return {Record<string, unknown>} Sanitized object safe for Firestore.
 */
export function sanitizeCheckoutRaw(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const rawItems = obj?.items;
  const items = Array.isArray(rawItems) ?
    rawItems.map((it: Record<string, unknown>) => {
      const price = it?.price as Record<string, unknown> | undefined;
      const product = it?.product as Record<string, unknown> | undefined;
      return {
        adjustable_quantity: it?.adjustable_quantity ?? null,
        amount_subtotal: it?.amount_subtotal ?? null,
        amount_total: it?.amount_total ?? null,
        amount_unit: it?.amount_unit ?? null,
        price: price ?
          {
            id: price.id ?? null,
            type: price.type ?? null,
            unit_amount: price.unit_amount ?? null,
          } :
          null,
        product: product ?
          {
            client_reference_id: product.client_reference_id ?? null,
            id: product.id ?? null,
            name: product.name ?? null,
          } :
          null,
        quantity: it?.quantity ?? null,
      };
    }) :
    [];

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
