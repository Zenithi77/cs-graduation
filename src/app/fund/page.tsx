"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Donation = {
  id: string;
  name?: string;
  amount: number;
  createdAt?: any;
};

/** Smooth animated number counter */
function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * eased);
      setValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration]);
  return value;
}

const GOAL = 1_620_000;

export default function FundPage() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "donations"));
    const unsub = onSnapshot(
      q,
      (s) => setDonations(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.warn("[fund] snapshot:", err)
    );
    return () => unsub();
  }, []);

  const total = useMemo(
    () => donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [donations]
  );
  const animTotal = useCountUp(total);

  // Жинхэнэ хандивын түвшин (0-1)
  const realFill = Math.min(1, total / GOAL);
  // Хэрэглэгч дүн оруулсан үед урьдчилан харах
  const previewN = Number(amount);
  const preview =
    previewN > 0 ? Math.min(1, (total + previewN) / GOAL) : null;
  const displayFill = preview ?? realFill;

  // Шингэний түвшин (jar internal coords: 100..340 = 240 units tall)
  const liquidHeight = 240 * displayFill;
  const liquidY = 340 - liquidHeight;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Эхлээд нэвтэрнэ үү.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 100) {
      setError("Дүн дор хаяж 100₮ байх ёстой.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/byl/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          uid: user.uid,
          displayName: user.displayName ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Checkout үүсгэж чадсангүй.");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Алдаа гарлаа.");
      setBusy(false);
    }
  };

  return (
    <div className="fund-page-bg">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
        {/* Heading */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#f3d77a]/80">
            <Sparkles className="w-3.5 h-3.5" />
            Төгсөлтийн сан
          </div>
          <h1 className="font-display text-4xl md:text-6xl mt-4 leading-tight text-white">
            Хамтдаа <span className="gold-text">бүтээе</span>
          </h1>
          <p className="text-white/55 mt-4 max-w-lg mx-auto text-sm md:text-base">
            Танай хандив шилэн савыг алтаар дүүргэнэ. Бодит цагт явц харагдана.
          </p>
        </div>

        {/* Jar */}
        <div className="mt-12 relative">
          <div className="jar-glow" />
          <div className="jar-stage">
            <JarSvg liquidY={liquidY} fillRatio={displayFill} />

            {/* Center amount overlay */}
            <div className="jar-amount-overlay">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/70 mb-1">
                Хураагдсан
              </div>
              <div className="font-display text-4xl md:text-5xl text-white leading-none">
                <span className="gold-text">{animTotal.toLocaleString()}</span>
                <span className="text-white/70 text-xl md:text-2xl ml-1">₮</span>
              </div>
              <div className="text-[11px] text-white/45 mt-2">
                / {GOAL.toLocaleString()}₮
              </div>
            </div>
          </div>

          {/* Below jar */}
          <div className="text-center mt-6 text-white/45 text-sm">
            <span className="text-white/80 font-semibold">{donations.length}</span>{" "}
            хүн дэмжсэн ·{" "}
            <span className="text-[#f3d77a]">{Math.round(realFill * 100)}%</span>{" "}
            биелсэн
          </div>
        </div>

        {/* Donate form */}
        <form onSubmit={submit} className="mt-12 max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.3em] text-white/50 mb-3 text-center">
              Хандивын дүн (₮)
            </label>
            <input
              type="number"
              min={100}
              max={1_620_000}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="fund-input"
              inputMode="numeric"
            />
          </div>

          {!user && (
            <div className="flex items-start gap-2 text-sm rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 p-3.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Төлбөр хийхийн тулд эхлээд{" "}
                <a href="/login" className="underline font-semibold">
                  нэвтэрнэ үү
                </a>
                .
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !user || !amount}
            className="fund-pay-btn"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Шилжүүлж байна...
              </span>
            ) : (
              "Хураамж төлөх"
            )}
          </button>

          <p className="text-center text-xs text-white/35">
            Төлбөрийг{" "}
            <span className="text-[#f3d77a]/80">byl.mn</span>
            -ээр найдвартай дамжуулна
          </p>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Jar SVG ─────────────── */
function JarSvg({
  liquidY,
  fillRatio,
}: {
  liquidY: number;
  fillRatio: number;
}) {
  const bubblesRef = useRef<
    { x: number; r: number; delay: number; dur: number }[]
  >([]);
  if (bubblesRef.current.length === 0) {
    for (let i = 0; i < 6; i++) {
      bubblesRef.current.push({
        x: 70 + Math.random() * 120,
        r: 2.5 + Math.random() * 4,
        delay: Math.random() * 4,
        dur: 4 + Math.random() * 3,
      });
    }
  }

  return (
    <svg
      className="jar-svg"
      viewBox="0 0 260 400"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
        </linearGradient>

        <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fce99a" />
          <stop offset="40%" stopColor="#f3d77a" />
          <stop offset="100%" stopColor="#C8A24B" />
        </linearGradient>

        <linearGradient id="highlightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>

        <clipPath id="jarBodyClip">
          <path
            d="M 60 100
               Q 60 90 70 90
               L 190 90
               Q 200 90 200 100
               L 200 340
               Q 200 360 180 360
               L 80 360
               Q 60 360 60 340 Z"
          />
        </clipPath>

        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lid */}
      <rect
        x="50"
        y="58"
        width="160"
        height="12"
        rx="3"
        fill="#0a0a0a"
        stroke="rgba(243,215,122,0.35)"
        strokeWidth="1"
      />
      <rect
        x="55"
        y="68"
        width="150"
        height="26"
        rx="5"
        fill="#1a1a1a"
        stroke="rgba(243,215,122,0.4)"
        strokeWidth="1.5"
      />

      {/* Glass body */}
      <path
        d="M 60 100
           Q 60 90 70 90
           L 190 90
           Q 200 90 200 100
           L 200 340
           Q 200 360 180 360
           L 80 360
           Q 60 360 60 340 Z"
        fill="url(#glassGrad)"
        stroke="rgba(243,215,122,0.5)"
        strokeWidth="2"
      />

      {/* Liquid */}
      <g clipPath="url(#jarBodyClip)">
        <rect
          x="50"
          y={liquidY}
          width="220"
          height={400 - liquidY}
          fill="url(#liquidGrad)"
          filter="url(#goldGlow)"
          style={{
            transition:
              "y 1.5s cubic-bezier(0.22,1,0.36,1), height 1.5s cubic-bezier(0.22,1,0.36,1)",
          }}
        />

        {/* Wavy surface */}
        {fillRatio > 0.01 && (
          <g
            transform={`translate(0, ${liquidY})`}
            style={{
              transition: "transform 1.5s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <path
              d="M -20 8 Q 20 -4 60 8 T 140 8 T 220 8 T 300 8 L 300 22 L -20 22 Z"
              fill="url(#liquidGrad)"
              opacity="0.9"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="-80 0"
                dur="4s"
                repeatCount="indefinite"
              />
            </path>
            <path
              d="M -20 6 Q 30 -6 70 6 T 150 6 T 230 6 T 310 6 L 310 18 L -20 18 Z"
              fill="#fce99a"
              opacity="0.55"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="-80 0"
                to="0 0"
                dur="5s"
                repeatCount="indefinite"
              />
            </path>
            <line
              x1="60"
              y1="2"
              x2="200"
              y2="2"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="0.6"
            />
          </g>
        )}

        {/* Rising bubbles */}
        {fillRatio > 0.05 &&
          bubblesRef.current.map((b, i) => (
            <circle
              key={i}
              cx={b.x}
              cy={350}
              r={b.r}
              fill="rgba(255,255,255,0.75)"
            >
              <animate
                attributeName="cy"
                from="350"
                to={liquidY + 10}
                dur={`${b.dur}s`}
                begin={`${b.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.85;0"
                dur={`${b.dur}s`}
                begin={`${b.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
      </g>

      {/* Glass left highlight */}
      <path
        d="M 72 110 Q 66 200 72 335"
        stroke="url(#highlightGrad)"
        strokeWidth="6"
        fill="none"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* Glass right thin line */}
      <path
        d="M 186 115 L 188 325"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Outer rim glow */}
      <path
        d="M 60 100
           Q 60 90 70 90
           L 190 90
           Q 200 90 200 100
           L 200 340
           Q 200 360 180 360
           L 80 360
           Q 60 360 60 340 Z"
        fill="none"
        stroke="rgba(243,215,122,0.28)"
        strokeWidth="4"
        filter="url(#goldGlow)"
      />
    </svg>
  );
}
