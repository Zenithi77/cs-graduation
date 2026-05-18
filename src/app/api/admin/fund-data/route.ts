// GET /api/admin/fund-data
// Бүх төгсөгчдийн төлбөрийн төлвийг Admin SDK-р буцаана. Зөвхөн localhost +
// идэвхтэй admin session cookie шаардана.
//
// Төлбөрийн баталгаажуулалт нь `payments` collection дээр суурилна — тухайн
// uid-ийн `status == "paid"` төлбөрүүдийн нийт дүнг олж, FUND_FEE-тэй харьцуулна.
import { NextRequest, NextResponse } from "next/server";
import {
  isAdminAuthenticated,
  isLocalHost,
} from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FUND_FEE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  uid: string;
  displayName: string;
  email: string;
  class: string;
  totalDonated: number;
  lastDonatedAt: string | null;
  paid: boolean;
};

type PaymentAgg = {
  total: number;
  lastAt: Date | null;
};

export async function GET(req: NextRequest) {
  if (!isLocalHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // Параллел: төгсөгчид болон бүх амжилттай төлбөр.
    const [usersSnap, paymentsSnap] = await Promise.all([
      db.collection("users").where("isGraduate", "==", true).get(),
      db.collection("payments").where("status", "==", "paid").get(),
    ]);

    // Төлбөрүүдийг uid-р нэгтгэнэ.
    const byUid = new Map<string, PaymentAgg>();
    for (const doc of paymentsSnap.docs) {
      const data = doc.data() as any;
      const uid = data?.client_reference_id;
      if (!uid || typeof uid !== "string") continue;

      const amount = parseFloat(String(data?.amount)) || 0;
      const paidAt: Date | null = data?.paidAt?.toDate?.() ?? null;

      const prev = byUid.get(uid) ?? { total: 0, lastAt: null };
      prev.total += amount;
      if (paidAt && (!prev.lastAt || paidAt > prev.lastAt)) {
        prev.lastAt = paidAt;
      }
      byUid.set(uid, prev);
    }

    const users: Row[] = usersSnap.docs.map((d) => {
      const data = d.data() as any;
      const agg = byUid.get(d.id);
      const total = agg?.total ?? 0;
      const lastAt = agg?.lastAt ?? null;
      return {
        uid: d.id,
        displayName: data?.displayName || "",
        email: data?.email || "",
        class: data?.class || "",
        totalDonated: total,
        lastDonatedAt: lastAt ? lastAt.toISOString() : null,
        paid: total >= FUND_FEE,
      };
    });

    return NextResponse.json({ fee: FUND_FEE, users });
  } catch (err: any) {
    console.error("[api/admin/fund-data]", err);
    return NextResponse.json(
      { error: err?.message || "Алдаа гарлаа." },
      { status: 500 },
    );
  }
}
