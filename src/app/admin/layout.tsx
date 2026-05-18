// Бүх /admin/* зам loopback-оос ирсэн request-уудаар хязгаарлагдана.
// Production deploy-д энэ нь admin хуудсыг автоматаар "404"-той адил болгоно.
import { headers } from "next/headers";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { isLocalHost } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = headers().get("host");
  if (!isLocalHost(host)) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-wine/10 mb-5">
          <ShieldAlert className="w-8 h-8 text-wine" />
        </div>
        <h1 className="font-display text-3xl">Зөвхөн дотоод хандалт</h1>
        <p className="text-black/60 mt-3">
          Admin хэсэг нь зөвхөн localhost-оос хандах боломжтой.
        </p>
        <Link href="/" className="btn btn-primary mt-7 inline-flex">
          Нүүр хуудас
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
