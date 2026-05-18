// GET /api/admin/fund-data
// Бүх төгсөгчдийн төлбөрийн төлвийг Admin SDK-р буцаана. Зөвхөн localhost +
// идэвхтэй admin session cookie шаардана.
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

export async function GET(req: NextRequest) {
  if (!isLocalHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("users")
      .where("isGraduate", "==", true)
      .get();

    const users: Row[] = snap.docs.map((d) => {
      const data = d.data() as any;
      const total = Number(data?.totalDonated) || 0;
      const last = data?.lastDonatedAt?.toDate?.();
      return {
        uid: d.id,
        displayName: data?.displayName || "",
        email: data?.email || "",
        class: data?.class || "",
        totalDonated: total,
        lastDonatedAt: last ? last.toISOString() : null,
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
