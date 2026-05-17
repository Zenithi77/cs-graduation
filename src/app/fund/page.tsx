"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, onSnapshot, orderBy, query, doc, getDoc, setDoc,
} from "firebase/firestore";
import {
  Landmark, User as UserIcon, FileText, Sparkles, Users, TrendingUp, Target, Trophy, Copy, Check, CreditCard, AlertCircle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

const PRESET_AMOUNTS = [15000, 25000, 50000, 100000] as const;
type PresetAmount = (typeof PRESET_AMOUNTS)[number];

type Donation = {
  id: string;
  name: string;
  amount: number;
  note?: string;
  uid?: string | null;
  createdAt?: any;
};

/** Smooth animated number counter */
function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
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

export default function FundPage() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<PresetAmount | "custom">(15000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [goal, setGoal] = useState<number>(5_000_000);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "donations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (s) => setDonations(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.warn("[fund] donations snapshot:", err)
    );
    (async () => {
      try {
        const ref = doc(db, "fund", "meta");
        const snap = await getDoc(ref);
        if (snap.exists() && typeof snap.data().goal === "number") {
          setGoal(snap.data().goal);
        } else {
          await setDoc(ref, { goal: 5_000_000 }, { merge: true });
        }
      } catch (err) {
        console.warn("[fund] meta load failed:", err);
      }
    })();
    return () => unsub();
  }, []);

  const total = useMemo(
    () => donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [donations]
  );
  const pct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0;
  const pctRound = Math.round(pct);
  const remaining = Math.max(0, goal - total);
  const donorCount = donations.length;
  const avg = donorCount ? Math.round(total / donorCount) : 0;
  const topDonors = useMemo(
    () => [...donations].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 3),
    [donations]
  );

  const animTotal = useCountUp(total);
  const animPct = useCountUp(pctRound);

  // Ring geometry
  const R = 96;
  const C = 2 * Math.PI * R;
  const dash = C * (1 - pct / 100);

  const ACCOUNT = "5000 1234 5678";
  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);

    if (!user) {
      setPayError("Эхлээд нэвтэрнэ үү.");
      return;
    }

    const amount =
      selectedAmount === "custom" ? Number(customAmount) : selectedAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError("Дүн буруу байна.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/byl/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          uid: user.uid,
          displayName: user.displayName ?? "",
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Checkout үүсгэж чадсангүй.");
      }
      // byl.mn-ийн hosted checkout хуудас руу шилжүүлнэ
      window.location.href = data.url;
    } catch (err: any) {
      setPayError(err?.message || "Алдаа гарлаа.");
      setBusy(false);
    }
  };

  const milestones = [25, 50, 75, 100];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Heading */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-black/50">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          Төгсөлтийн хураамж
        </div>
        <h1 className="font-display text-4xl md:text-6xl mt-3 leading-tight">
          5-р курсын <span className="gold-text">төгсөлтийн</span> сан
        </h1>
        <p className="text-black/60 mt-4 max-w-2xl mx-auto">
          Манай тэнхим 5 жилийн сургалттай тул 1–4-р курсынхэн 5-р курсынхээ төгсөлтийн
          арга хэмжээнд зориулан хураамж төлдөг уламжлалтай. Доорх ил тод бүртгэлээр
          санхүүжилтийн явц бодит цагт харагдана.
        </p>
      </div>

      {/* Hero progress */}
      <div className="fund-hero p-6 md:p-10 mt-10">
        <div className="relative grid md:grid-cols-[auto,1fr] gap-8 md:gap-12 items-center">
          {/* Circular progress */}
          <div className="relative mx-auto">
            <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
              <defs>
                <linearGradient id="fundGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7A1F2B" />
                  <stop offset="55%" stopColor="#C8A24B" />
                  <stop offset="100%" stopColor="#f3d77a" />
                </linearGradient>
              </defs>
              <circle cx="110" cy="110" r={R} strokeWidth="14" fill="none" className="ring-track" />
              <circle
                cx="110" cy="110" r={R} strokeWidth="14" fill="none"
                className="ring-fill"
                strokeDasharray={C}
                strokeDashoffset={dash}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Биелэлт</div>
              <div className="font-display text-6xl leading-none mt-1">
                <span className="gold-text">{animPct}</span>
                <span className="text-white/70 text-3xl align-top ml-0.5">%</span>
              </div>
              <div className="text-[11px] text-white/50 mt-2">{donorCount} хүн оролцов</div>
            </div>
          </div>

          {/* Amounts + bar */}
          <div className="flex-1 w-full">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Хураагдсан</div>
                <div className="font-display text-5xl md:text-6xl mt-1">
                  <span className="gold-text">{animTotal.toLocaleString()}</span>
                  <span className="text-white/70 text-3xl ml-1">₮</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Зорилго</div>
                <div className="font-display text-2xl md:text-3xl text-white/85">
                  {goal.toLocaleString()}<span className="text-white/50">₮</span>
                </div>
              </div>
            </div>

            {/* Bar with milestones */}
            <div className="mt-8 relative pb-8">
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {milestones.map((m) => (
                <div key={m} className="milestone" style={{ left: `${m}%` }}>
                  <span className="milestone-label">{m}%</span>
                </div>
              ))}
              {/* Current pointer */}
              <div
                className="absolute -top-1 -translate-x-1/2 transition-all duration-1000"
                style={{ left: `${pct}%` }}
                aria-hidden
              >
                <div className="w-3 h-3 rounded-full bg-gold ring-4 ring-gold/25 shadow-[0_0_12px_rgba(200,162,75,0.7)]" />
              </div>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="stat-chip">
                <div className="flex items-center gap-2 text-white/55 text-[11px] uppercase tracking-widest">
                  <Users className="w-3.5 h-3.5" /> Дэмжигч
                </div>
                <div className="font-display text-2xl mt-1">{donorCount}</div>
              </div>
              <div className="stat-chip">
                <div className="flex items-center gap-2 text-white/55 text-[11px] uppercase tracking-widest">
                  <TrendingUp className="w-3.5 h-3.5" /> Дундаж
                </div>
                <div className="font-display text-2xl mt-1">
                  {avg.toLocaleString()}<span className="text-white/50 text-base">₮</span>
                </div>
              </div>
              <div className="stat-chip">
                <div className="flex items-center gap-2 text-white/55 text-[11px] uppercase tracking-widest">
                  <Target className="w-3.5 h-3.5" /> Үлдсэн
                </div>
                <div className="font-display text-2xl mt-1">
                  {remaining.toLocaleString()}<span className="text-white/50 text-base">₮</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top donors */}
      {topDonors.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {topDonors.map((d, i) => (
            <div key={d.id} className="card p-5 flex items-center gap-4">
              <div className={`rank-badge ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : "rank-3"}`}>
                {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-black/45">
                  {i === 0 ? "Топ дэмжигч" : `#${i + 1} дэмжигч`}
                </div>
                <div className="font-semibold truncate">{d.name}</div>
              </div>
              <div className="font-display text-xl text-wine">
                {Number(d.amount).toLocaleString()}₮
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bank info + Form */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="card p-6">
          <h3 className="font-display text-xl flex items-center gap-2">
            <Landmark className="w-5 h-5 text-wine" /> Дансны мэдээлэл
          </h3>
          <p className="text-sm text-black/65 mt-2">
            Хураамжаа доорх дансанд шилжүүлээд, формоор бүртгүүлнэ үү.
          </p>
          <div className="mt-4 rounded-xl border border-black/10 bg-cream/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-black/50">Хаан банк</div>
                <div className="font-display text-2xl tracking-wider mt-0.5">{ACCOUNT}</div>
              </div>
              <button
                type="button"
                onClick={copyAccount}
                className="btn btn-ghost !py-2 !px-3 text-sm"
                aria-label="Дансны дугаар хуулах"
              >
                {copied ? <Check className="w-4 h-4 text-wine" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1.5">{copied ? "Хууллаа" : "Хуулах"}</span>
              </button>
            </div>
            <ul className="text-sm mt-4 space-y-2 text-black/75">
              <li className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-wine" />
                Хүлээн авагч: <b>CS төгсөлтийн хороо</b>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-wine" />
                Гүйлгээний утга: <b>Нэр + Курс</b>
              </li>
            </ul>
          </div>
        </div>

        <form onSubmit={submit} className="card p-6 grid gap-4 content-start">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-wine" /> Картаар төлөх
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-black/40">
              Qpay · SocialPay · Pocket
            </span>
          </div>

          <div>
            <label className="label">Дүн сонгох</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const active = selectedAmount === amt;
                return (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-wine bg-wine text-white shadow-sm"
                        : "border-black/15 hover:border-wine/60 bg-white"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-widest opacity-70">
                      Багц
                    </div>
                    <div className="font-display text-xl">
                      {amt.toLocaleString()}₮
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedAmount("custom")}
                className={`col-span-2 rounded-xl border px-4 py-3 text-left transition ${
                  selectedAmount === "custom"
                    ? "border-wine bg-wine text-white"
                    : "border-black/15 hover:border-wine/60 bg-white"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest opacity-70">
                  Бусад дүн
                </div>
                <div className="font-display text-base">Өөрөө оруулах</div>
              </button>
            </div>

            {selectedAmount === "custom" && (
              <input
                className="input mt-3"
                type="number"
                min={1000}
                max={5_000_000}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Жш: 30000"
                required
              />
            )}
          </div>

          <div>
            <label className="label">Тэмдэглэл (заавал биш)</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="3-р курс / Баярлалаа гэх мэт"
              maxLength={200}
            />
          </div>

          {!user && (
            <div className="flex items-start gap-2 text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3">
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

          {payError && (
            <div className="flex items-start gap-2 text-sm rounded-lg border border-red-300 bg-red-50 text-red-800 p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{payError}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-black/55">
              Төлбөрийг <b>byl.mn</b> аар дамжуулан хүлээн авна.
            </div>
            <button className="btn btn-gold" disabled={busy || !user}>
              {busy ? "..." : "Төлөх →"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl md:text-3xl">Хураамж төлсөн дүү нар</h2>
          <div className="text-xs uppercase tracking-widest text-black/45">{donorCount} бичлэг</div>
        </div>
        <ul className="mt-4 divide-y divide-black/10 card overflow-hidden">
          {donations.map((d, i) => {
            const rank =
              i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "rank-x";
            return (
              <li key={d.id} className="donor-row flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`rank-badge ${rank}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.name}</div>
                    {d.note && <div className="text-xs text-black/50 truncate">{d.note}</div>}
                  </div>
                </div>
                <div className="font-display text-xl text-wine whitespace-nowrap">
                  {Number(d.amount).toLocaleString()}₮
                </div>
              </li>
            );
          })}
          {donations.length === 0 && (
            <li className="p-8 text-center text-black/40 italic">
              Одоогоор төлбөр бүртгэгдээгүй байна. Хамгийн түрүүнд дэмжигч болоорой!
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
