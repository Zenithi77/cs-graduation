"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Suspense } from "react";

function SuccessInner() {
  const sp = useSearchParams();
  const checkoutId = sp.get("checkout_id");

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-12 h-12" />
      </div>
      <h1 className="font-display text-4xl mt-6">
        Баярлалаа! <span className="gold-text">Төлбөр амжилттай.</span>
      </h1>
      <p className="text-black/65 mt-4">
        Таны хандив 5-р курсын төгсөлтийн санд бүртгэгдлээ. Жагсаалт хэдхэн
        секундийн дотор шинэчлэгдэнэ.
      </p>
      {checkoutId && checkoutId !== "{CHECKOUT_ID}" && (
        <p className="text-xs text-black/40 mt-3">
          Гүйлгээний дугаар: <b>{checkoutId}</b>
        </p>
      )}
      <div className="mt-10 flex items-center justify-center gap-3">
        <Link href="/fund" className="btn btn-ghost">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Сан руу буцах
        </Link>
        <Link href="/" className="btn btn-gold">
          Нүүр хуудас
        </Link>
      </div>
    </div>
  );
}

export default function FundSuccessPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center">Уншиж байна...</div>}>
      <SuccessInner />
    </Suspense>
  );
}
