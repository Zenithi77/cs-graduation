"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft, Home, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

function SuccessInner() {
  const sp = useSearchParams();
  const checkoutId = sp.get("checkout_id");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fund-page-bg">
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        {/* Glow ring */}
        <div className="relative inline-block">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(243,215,122,0.45), transparent 65%)",
              filter: "blur(28px)",
              transform: "scale(1.6)",
            }}
          />
          <div
            className={`relative inline-flex items-center justify-center w-24 h-24 rounded-full transition-all duration-700 ${
              show ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
            style={{
              background:
                "linear-gradient(135deg, #f3d77a, #C8A24B)",
              boxShadow:
                "0 0 40px rgba(243,215,122,0.5), inset 0 -4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <CheckCircle2 className="w-14 h-14 text-[#1B1B1B]" strokeWidth={2.5} />
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#f3d77a]/80 mt-8 transition-opacity duration-700 delay-200 ${
            show ? "opacity-100" : "opacity-0"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Төлбөр баталгаажлаа
        </div>

        <h1
          className={`font-display text-4xl md:text-5xl mt-4 leading-tight text-white transition-all duration-700 delay-300 ${
            show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <span className="gold-text">Төлөгдсөн</span> 🎉
        </h1>

        <p
          className={`text-white/60 mt-6 max-w-md mx-auto transition-all duration-700 delay-500 ${
            show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Таны хандивыг хүлээн авлаа. 5-р курсын төгсөлтийн санд бичигдэж,
          шилэн сав дотор алтаар нэмэгдэх болно. Талархал илэрхийлье!
        </p>

        {checkoutId && checkoutId !== "{CHECKOUT_ID}" && (
          <p
            className={`text-xs text-white/30 mt-4 font-mono transition-opacity duration-700 delay-700 ${
              show ? "opacity-100" : "opacity-0"
            }`}
          >
            #{checkoutId}
          </p>
        )}

        <div
          className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-700 delay-700 ${
            show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Link
            href="/fund"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Сан руу буцах
          </Link>
          <Link href="/" className="fund-pay-btn !w-auto !px-8">
            <span className="inline-flex items-center gap-2">
              <Home className="w-4 h-4" /> Нүүр хуудас
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FundSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="fund-page-bg">
          <div className="p-20 text-center text-white/50">Уншиж байна...</div>
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
