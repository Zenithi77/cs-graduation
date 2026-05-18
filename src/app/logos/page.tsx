"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, doc,
  runTransaction, getDoc,
} from "firebase/firestore";
import {
  Heart, Upload, ImagePlus, Sparkles, Check, RotateCw, Maximize2, Move,
  Trophy, X, Calendar, Gift, Users, Search, ArrowUpDown,
  Crown, Medal, Award, Eye, Layers,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/lib/auth";

type Placement = { x: number; y: number; scale: number; rotation: number };

type Logo = {
  id: string;
  url: string;
  title: string;
  authorName: string;
  authorUid: string;
  votes: number;
  createdAt?: any;
} & Partial<Placement>;

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 46, scale: 0.32, rotation: 0 };

// Contest metadata (static for now — easy to lift into Firestore later)
const CONTEST = {
  title: "Футболкан дээрх лого",
  tagline: "Тэнхимийн логогоо өөрсдөө бүтээцгээе",
  prize: "Шилдэг загвар нь Төгсөлтийн өдрийн албан ёсны лого болно",
  deadline: new Date("2026-05-20T23:59:00"),
};

// ───────────────────────── helpers ─────────────────────────

async function whiteToAlpha(file: File, threshold = 240): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 1024;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const minRGB = Math.min(r, g, b);
    if (minRGB >= threshold) {
      d[i + 3] = 0;
    } else if (minRGB >= threshold - 30) {
      const t = (minRGB - (threshold - 30)) / 30;
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }
  ctx.putImageData(img, 0, 0);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png", 0.95)
  );
}

// ───────────────────────── T-shirt mockup ─────────────────────────

function ShirtMock({
  src,
  placement,
  editable = false,
  onChange,
  className = "",
}: {
  src?: string | null;
  placement: Placement;
  editable?: boolean;
  onChange?: (next: Placement) => void;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || !onChange || !stageRef.current) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = stageRef.current.getBoundingClientRect();
    dragRef.current = {
      ox: e.clientX, oy: e.clientY,
      sx: placement.x, sy: placement.y,
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ((ev.clientX - dragRef.current.ox) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.oy) / rect.height) * 100;
      onChange({
        ...placement,
        x: Math.min(95, Math.max(5, dragRef.current.sx + dx)),
        y: Math.min(95, Math.max(5, dragRef.current.sy + dy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={stageRef}
      className={`relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-cream via-white to-gold/10 ${className}`}
    >
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="55%" stopColor="#161616" />
            <stop offset="100%" stopColor="#0c0c0c" />
          </linearGradient>
          <radialGradient id="shirtHi" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="shirtShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.35" />
          </filter>
        </defs>
        <g filter="url(#shirtShadow)">
          <path
            d="M100 70 L155 50 Q200 95 245 50 L300 70 L355 120 L320 160 L305 150 L305 360 Q305 375 290 375 L110 375 Q95 375 95 360 L95 150 L80 160 L45 120 Z"
            fill="url(#shirtGrad)"
          />
          <path
            d="M100 70 L155 50 Q200 95 245 50 L300 70 L355 120 L320 160 L305 150 L305 360 Q305 375 290 375 L110 375 Q95 375 95 360 L95 150 L80 160 L45 120 Z"
            fill="url(#shirtHi)"
          />
          <path d="M155 50 Q200 95 245 50 Q200 78 155 50 Z" fill="#070707" />
          <path d="M95 150 L95 360" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <path d="M305 150 L305 360" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </g>
      </svg>

      {src && (
        <div
          onPointerDown={onPointerDown}
          className={`absolute select-none ${editable ? "cursor-move" : ""}`}
          style={{
            left: `${placement.x}%`,
            top: `${placement.y}%`,
            width: `${placement.scale * 100}%`,
            transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
            touchAction: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="block w-full h-auto pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
          />
          {editable && (
            <div className="absolute inset-0 border border-dashed border-gold/70 rounded-sm pointer-events-none" />
          )}
        </div>
      )}

      {editable && src && (
        <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 text-white text-[10px] uppercase tracking-widest px-2.5 py-1 backdrop-blur">
          <Move className="w-3 h-3" /> чирж байрлуул
        </div>
      )}
    </div>
  );
}

// ──────────────────────── Countdown ─────────────────────────
function useCountdown(target: Date) {
  // Start equal to target so SSR + first client render both show zeros
  // (prevents React hydration mismatch). Real time kicks in after mount.
  const [now, setNow] = useState(() => target.getTime());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s, expired: diff === 0 };
}

// ───────────────────────── Page ─────────────────────────

type SortKey = "top" | "new";
type FilterKey = "all" | "mine";

export default function LogosPage() {
  const { user } = useAuth();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [busy, setBusy] = useState(false);

  // Browse controls
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("top");
  const [tab, setTab] = useState<FilterKey>("all");
  const [lightbox, setLightbox] = useState<Logo | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const countdown = useCountdown(CONTEST.deadline);

  useEffect(() => {
    const q = query(collection(db, "logos"));
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Logo[];
      setLogos(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setVoted({}); return; }
    let cancelled = false;
    (async () => {
      const map: Record<string, boolean> = {};
      const refDoc = doc(db, "votes", user.uid);
      const snap = await getDoc(refDoc).catch(() => null);
      if (!cancelled && snap && snap.exists()) {
        const data = snap.data();
        Object.keys(data).forEach((k) => { if (data[k]) map[k] = true; });
        setVoted(map);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Derived list
  const visible = useMemo(() => {
    let list = [...logos];
    if (tab === "mine" && user) list = list.filter((l) => l.authorUid === user.uid);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((l) =>
        (l.title || "").toLowerCase().includes(s) ||
        (l.authorName || "").toLowerCase().includes(s)
      );
    }
    if (sort === "top") list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    else list.sort((a, b) => {
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return bt - at;
    });
    return list;
  }, [logos, tab, search, sort, user]);

  const podium = useMemo(() => {
    const ranked = [...logos].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    return ranked.slice(0, 3);
  }, [logos]);

  const totalVotes = useMemo(
    () => logos.reduce((acc, l) => acc + (l.votes || 0), 0),
    [logos]
  );
  const participants = useMemo(
    () => new Set(logos.map((l) => l.authorUid)).size,
    [logos]
  );

  // ───────── Upload handlers ─────────
  const onPickFile = async (f: File | null) => {
    if (!f) { setRawFile(null); setPreviewUrl(null); setProcessedBlob(null); return; }
    setRawFile(f);
    setPlacement(DEFAULT_PLACEMENT);
    setProcessing(true);
    try {
      const blob = await whiteToAlpha(f);
      setProcessedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      console.warn("[logos] bg-removal failed, using original:", err);
      setProcessedBlob(f);
      const url = URL.createObjectURL(f);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } finally {
      setProcessing(false);
    }
  };

  const clearPick = () => {
    setRawFile(null);
    setProcessedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPlacement(DEFAULT_PLACEMENT);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    if (!processedBlob) return;
    setBusy(true);
    try {
      const fileName = `${Date.now()}_${(rawFile?.name || "logo").replace(/\.[^.]+$/, "")}.png`;
      const { secure_url: url } = await uploadToCloudinary(processedBlob, {
        folder: `logos/${user.uid}`,
        fileName,
      });
      await addDoc(collection(db, "logos"), {
        url,
        title: title.trim() || "Лого",
        authorUid: user.uid,
        authorName: user.displayName || user.email,
        votes: 0,
        x: placement.x, y: placement.y,
        scale: placement.scale, rotation: placement.rotation,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      clearPick();
      setShowUploader(false);
    } catch (err: any) {
      console.error(err);
      alert("Алдаа: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const toggleVote = async (logo: Logo) => {
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    if (logo.authorUid === user.uid) {
      alert("Өөрийнхөө загвар дээр санал өгөх боломжгүй.");
      return;
    }

    const userVotesRef = doc(db, "votes", user.uid);
    const newLogoRef = doc(db, "logos", logo.id);
    const wasVoted = !!voted[logo.id];

    // Find currently-voted other logo (if any) — one vote per user
    const prevId = Object.keys(voted).find((k) => voted[k] && k !== logo.id);

    // Optimistic UI: clear all, then set this one (unless toggling off)
    const optimistic: Record<string, boolean> = {};
    if (!wasVoted) optimistic[logo.id] = true;
    setVoted(optimistic);

    try {
      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userVotesRef);
        const newSnap = await tx.get(newLogoRef);
        const prevSnap = prevId ? await tx.get(doc(db, "logos", prevId)) : null;

        const userMap = (uSnap.exists() ? uSnap.data() : {}) as Record<string, boolean>;
        const has = !!userMap[logo.id];

        const newCur = (newSnap.data()?.votes as number) || 0;

        // Build fresh single-vote map
        const nextMap: Record<string, boolean> = {};
        Object.keys(userMap).forEach((k) => { nextMap[k] = false; });

        if (has) {
          // Toggle off
          tx.set(userVotesRef, nextMap, { merge: true });
          tx.update(newLogoRef, { votes: Math.max(0, newCur - 1) });
        } else {
          // Switch vote: decrement previous, increment new
          if (prevSnap && prevSnap.exists() && prevId !== logo.id) {
            const prevCur = (prevSnap.data()?.votes as number) || 0;
            tx.update(doc(db, "logos", prevId!), { votes: Math.max(0, prevCur - 1) });
          }
          nextMap[logo.id] = true;
          tx.set(userVotesRef, nextMap, { merge: true });
          tx.update(newLogoRef, { votes: newCur + 1 });
        }
      });
    } catch (err: any) {
      // Roll back optimistic update
      setVoted(voted);
      console.error("vote failed:", err);
      alert("Санал өгөхөд алдаа гарлаа: " + (err?.message || err));
    }
  };

  const openUploader = () => {
    setShowUploader(true);
  };

  // Lock body scroll while the uploader modal is open
  useEffect(() => {
    if (!showUploader) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowUploader(false); clearPick(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [showUploader]);

  // ─────────────────────── Render ───────────────────────
  return (
    <div className="relative">
      {/* ===== Hero ===== */}
      <section className="logo-hero">
        <div className="max-w-7xl mx-auto px-4 py-14 md:py-20 relative">
          <div className="grid lg:grid-cols-[1.2fr,1fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/8 border border-white/15 text-[11px] uppercase tracking-[0.3em] text-[#f3d77a]">
                <Sparkles className="w-3.5 h-3.5" />
                {countdown.expired ? "Уралдаан хаагдсан" : "Логоны уралдаан"}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-7xl mt-4 leading-[1.05] text-white">
                {CONTEST.title.split(" ").slice(0, -1).join(" ")} <span className="gold-text">{CONTEST.title.split(" ").slice(-1)}</span>
              </h1>
              <p className="text-white/65 mt-4 text-base md:text-lg max-w-xl">
                {CONTEST.tagline}.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={openUploader} className="btn-hero btn-hero-primary">
                  <Upload className="w-4 h-4" /> Загвар илгээх
                </button>
                <a href="#feed" className="btn-hero btn-hero-ghost">
                  <Eye className="w-4 h-4" /> Бүгдийг үзэх
                </a>
              </div>

              {/* Meta chips */}
              <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-xl">
                <div className="meta-chip">
                  <Gift className="w-4 h-4 text-[#f3d77a]" />
                  <div>
                    <div className="meta-label">Шагнал</div>
                    <div className="meta-value">Албан ёсны лого</div>
                  </div>
                </div>
                <div className="meta-chip">
                  <Users className="w-4 h-4 text-[#f3d77a]" />
                  <div>
                    <div className="meta-label">Оролцогч</div>
                    <div className="meta-value">{participants}</div>
                  </div>
                </div>
                <div className="meta-chip">
                  <Heart className="w-4 h-4 text-[#f3d77a]" />
                  <div>
                    <div className="meta-label">Нийт санал</div>
                    <div className="meta-value">{totalVotes}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="lg:justify-self-end w-full max-w-md">
              <div className="countdown-card">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/55">
                  <Calendar className="w-3.5 h-3.5 text-[#f3d77a]" /> Эцсийн хугацаа
                </div>
                <div className="mt-3 text-white/80 text-sm">
                  {`${CONTEST.deadline.getFullYear()} оны ${CONTEST.deadline.getMonth() + 1} сарын ${CONTEST.deadline.getDate()}`}
                </div>
                <div className="cd-row mt-5">
                  {([
                    ["хоног", countdown.d],
                    ["цаг",   countdown.h],
                    ["мин",   countdown.m],
                    ["сек",   countdown.s],
                  ] as const).map(([label, n]) => (
                    <div key={label} className="cd-cell-dark">
                      <div className="cd-num-dark">{String(n).padStart(2, "0")}</div>
                      <div className="cd-lbl-dark">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-xs text-white/55 leading-relaxed">
                  {CONTEST.prize}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        {/* ===== Podium ===== */}
        {podium.length > 0 && (
          <section className="-mt-10 md:-mt-14 relative z-10">
            <div className="podium-card">
              <div className="flex items-end justify-between gap-3 mb-6">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-black/50">Тэргүүлэгчид</div>
                  <h2 className="font-display text-2xl md:text-3xl mt-1">Дээд гурван загвар</h2>
                </div>
                <div className="hidden md:flex items-center gap-1 text-xs text-black/45">
                  <Trophy className="w-3.5 h-3.5 text-gold" /> Шууд шинэчлэгдэнэ
                </div>
              </div>

              <div className="podium-grid grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                {podium.map((l, i) => {
                  const place = i + 1;
                  const Icon = place === 1 ? Crown : place === 2 ? Medal : Award;
                  const orderCls = place === 1
                    ? "col-span-2 md:col-span-1 md:order-2"
                    : place === 2 ? "md:order-1" : "md:order-3";
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLightbox(l)}
                      className={`podium-item podium-${place} ${orderCls}`}
                    >
                      <div className="podium-badge">
                        <Icon className="w-3.5 h-3.5" /> {place}-р байр
                      </div>
                      <ShirtMock
                        src={l.url}
                        placement={{
                          x: l.x ?? DEFAULT_PLACEMENT.x,
                          y: l.y ?? DEFAULT_PLACEMENT.y,
                          scale: l.scale ?? DEFAULT_PLACEMENT.scale,
                          rotation: l.rotation ?? DEFAULT_PLACEMENT.rotation,
                        }}
                        className="rounded-xl"
                      />
                      <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
                        <div className="min-w-0 text-left">
                          <div className="font-display text-sm sm:text-lg truncate">{l.title}</div>
                          <div className="text-[11px] sm:text-xs text-black/50 truncate">— {l.authorName}</div>
                        </div>
                        <div className="vote-pill">
                          <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                          <span className="font-display">{l.votes || 0}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ===== Upload modal ===== */}
        {showUploader && (
          <div
            className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
            onClick={() => { setShowUploader(false); clearPick(); }}
          >
            <form
              onSubmit={upload}
              onClick={(e) => e.stopPropagation()}
              className="uploader-card w-full max-w-3xl my-auto shadow-2xl"
            >
              <div className="uploader-top">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gold" />
                  <div className="text-xs uppercase tracking-[0.25em] text-black/65 font-semibold">
                    Шинэ загвар
                  </div>
                </div>
                <button type="button" onClick={() => { setShowUploader(false); clearPick(); }} className="uploader-close" aria-label="Хаах">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid lg:grid-cols-[340px,1fr] gap-8 mt-5">
                {/* Preview */}
                <div>
                  <ShirtMock
                    src={previewUrl}
                    placement={placement}
                    editable={!!previewUrl}
                    onChange={setPlacement}
                  />
                  {previewUrl && (
                    <div className="mt-4 space-y-3">
                      <RangeRow
                        icon={<Maximize2 className="w-3.5 h-3.5" />}
                        label="Хэмжээ"
                        value={Math.round(placement.scale * 100)}
                        suffix="%"
                        min={10} max={80}
                        onChange={(v) => setPlacement((p) => ({ ...p, scale: v / 100 }))}
                      />
                      <RangeRow
                        icon={<RotateCw className="w-3.5 h-3.5" />}
                        label="Эргэлт"
                        value={placement.rotation}
                        suffix="°"
                        min={-45} max={45}
                        onChange={(v) => setPlacement((p) => ({ ...p, rotation: v }))}
                      />
                      <button
                        type="button"
                        onClick={() => setPlacement(DEFAULT_PLACEMENT)}
                        className="text-xs text-black/55 hover:text-wine underline"
                      >
                        Анхны байрлал руу буцаах
                      </button>
                    </div>
                  )}
                </div>

                {/* Form */}
                <div className="flex flex-col gap-5">
                  <label
                    htmlFor="logoFile"
                    className={`upload-zone ${rawFile ? "upload-zone-filled" : ""}`}
                  >
                    <div className={`upload-zone-icon ${rawFile ? "filled" : ""}`}>
                      {processing
                        ? <span className="block w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                        : rawFile ? <Check className="w-5 h-5" /> : <ImagePlus className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {rawFile ? rawFile.name : "Зургийг чирж тавь эсвэл сонгох"}
                      </div>
                      <div className="text-xs text-black/55 mt-0.5">
                        {processing
                          ? "Дэвсгэрийг автоматаар арилгаж байна…"
                          : rawFile
                            ? "Дэвсгэр амжилттай арилав"
                            : "PNG / JPG · 5MB · цагаан дэвсгэр автоматаар арилна"}
                      </div>
                    </div>
                    {rawFile && !processing && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); clearPick(); }}
                        className="upload-clear"
                        aria-label="Арилгах"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </label>
                  <input
                    ref={fileInputRef}
                    id="logoFile"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                  />

                  <div>
                    <label className="label">Загварын нэр</label>
                    <input
                      className="input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Жишээ: Phoenix"
                    />
                  </div>

                  <div className="tip-card">
                    <Sparkles className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                    <div>
                      <b className="text-black/80">Зөвлөмж.</b> Логогоо <b>чирж</b> зөөгөөд, sliders ашиглан хэмжээ/эргэлтийг тохируулна.
                      Цагаан дэвсгэр автоматаар тунгалаг болно.
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary h-[48px] px-6 gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed self-start"
                    disabled={busy || !user || !processedBlob}
                  >
                    <Upload className="w-4 h-4" />
                    {busy ? "Илгээж байна..." : user ? "Загвар нийтлэх" : "Нэвтэрнэ үү"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ===== Browse toolbar + feed ===== */}
        <section id="feed" className="mt-14 mb-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-black/50">Гарагт</div>
              <h2 className="font-display text-3xl md:text-4xl mt-1">Бүх загвар</h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="search-wrap">
                <Search className="w-4 h-4 text-black/40" />
                <input
                  className="search-input"
                  placeholder="Хайх (нэр, зохиогч)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="seg">
                <button
                  className={`seg-btn ${tab === "all" ? "seg-active" : ""}`}
                  onClick={() => setTab("all")}
                >Бүгд</button>
                <button
                  className={`seg-btn ${tab === "mine" ? "seg-active" : ""}`}
                  onClick={() => setTab("mine")}
                  disabled={!user}
                  title={user ? "" : "Нэвтэрнэ үү"}
                >Миний</button>
              </div>

              <div className="seg">
                <button
                  className={`seg-btn ${sort === "top" ? "seg-active" : ""}`}
                  onClick={() => setSort("top")}
                ><ArrowUpDown className="w-3.5 h-3.5 mr-1" />Топ</button>
                <button
                  className={`seg-btn ${sort === "new" ? "seg-active" : ""}`}
                  onClick={() => setSort("new")}
                >Шинэ</button>
              </div>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              hasAny={logos.length > 0}
              onUpload={openUploader}
              filtered={search.trim().length > 0 || tab === "mine"}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {visible.map((l, i) => (
                <LogoCard
                  key={l.id}
                  logo={l}
                  rank={sort === "top" ? i + 1 : undefined}
                  voted={!!voted[l.id]}
                  onVote={() => toggleVote(l)}
                  onOpen={() => setLightbox(l)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ===== Lightbox ===== */}
      {lightbox && (
        <LogoLightbox
          logo={lightbox}
          voted={!!voted[lightbox.id]}
          onVote={() => toggleVote(lightbox)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

function RangeRow({
  icon, label, value, suffix, min, max, onChange,
}: {
  icon: React.ReactNode; label: string; value: number; suffix: string;
  min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-black/55 mb-1.5">
        <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
        <span className="tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-pretty"
      />
    </div>
  );
}

function LogoCard({
  logo, rank, voted, onVote, onOpen,
}: {
  logo: Logo; rank?: number; voted: boolean;
  onVote: () => void; onOpen: () => void;
}) {
  return (
    <article className="logo-card group">
      <button onClick={onOpen} className="relative block w-full text-left">
        <ShirtMock
          src={logo.url}
          placement={{
            x: logo.x ?? DEFAULT_PLACEMENT.x,
            y: logo.y ?? DEFAULT_PLACEMENT.y,
            scale: logo.scale ?? DEFAULT_PLACEMENT.scale,
            rotation: logo.rotation ?? DEFAULT_PLACEMENT.rotation,
          }}
          className="rounded-none"
        />
        {rank !== undefined && rank <= 3 && (
          <div className={`logo-rank rank-${rank}`}>#{rank}</div>
        )}
        <div className="logo-card-hover">
          <Eye className="w-4 h-4" /> Дэлгэрэнгүй
        </div>
      </button>
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="font-display text-sm sm:text-lg truncate">{logo.title}</div>
          <div className="text-[11px] sm:text-xs text-black/50 truncate">— {logo.authorName}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onVote(); }}
          className={`vote-btn ${voted ? "vote-btn-on" : ""}`}
          aria-label="Дэмжих"
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${voted ? "fill-current" : ""}`} />
          <span className="font-display tabular-nums text-sm">{logo.votes || 0}</span>
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  hasAny, filtered, onUpload,
}: { hasAny: boolean; filtered: boolean; onUpload: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-illus">
        <Layers className="w-8 h-8 text-gold" />
      </div>
      <h3 className="font-display text-2xl mt-4">
        {filtered ? "Тохирох загвар олдсонгүй" : hasAny ? "Илэрц алга" : "Эхний загвар чинийх байна"}
      </h3>
      <p className="text-sm text-black/55 mt-2 max-w-sm mx-auto">
        {filtered
          ? "Хайлт эсвэл шүүлтүүрээ цэвэрлээд дахин үзээрэй."
          : "Логогоо илгээж, ангиараа санал хураан хамгийн шилдгийг сонгоцгооё."}
      </p>
      {!filtered && (
        <button onClick={onUpload} className="btn btn-primary mt-5 gap-2">
          <Upload className="w-4 h-4" /> Загвар илгээх
        </button>
      )}
    </div>
  );
}

function LogoLightbox({
  logo, voted, onVote, onClose,
}: { logo: Logo; voted: boolean; onVote: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Хаах"><X className="w-5 h-5" /></button>
      <div className="lb-card" onClick={(e) => e.stopPropagation()}>
        <div className="grid md:grid-cols-[1.1fr,1fr] gap-0">
          <div className="bg-black/30 p-4 md:p-6 flex items-center">
            <ShirtMock
              src={logo.url}
              placement={{
                x: logo.x ?? DEFAULT_PLACEMENT.x,
                y: logo.y ?? DEFAULT_PLACEMENT.y,
                scale: logo.scale ?? DEFAULT_PLACEMENT.scale,
                rotation: logo.rotation ?? DEFAULT_PLACEMENT.rotation,
              }}
              className="rounded-xl"
            />
          </div>
          <div className="p-6 md:p-8 bg-white flex flex-col">
            <div className="text-[11px] uppercase tracking-[0.3em] text-black/50">Загвар</div>
            <h3 className="font-display text-3xl md:text-4xl mt-1">{logo.title}</h3>
            <div className="text-sm text-black/55 mt-1">— {logo.authorName}</div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="stat-mini">
                <div className="stat-mini-label">Санал</div>
                <div className="stat-mini-value">{logo.votes || 0}</div>
              </div>
              <div className="stat-mini">
                <div className="stat-mini-label">Огноо</div>
                <div className="stat-mini-value text-base">
                  {logo.createdAt?.toDate?.()?.toLocaleDateString("mn-MN") || "—"}
                </div>
              </div>
            </div>

            <button
              onClick={onVote}
              className={`mt-6 vote-btn-lg ${voted ? "vote-btn-on" : ""}`}
            >
              <Heart className={`w-5 h-5 ${voted ? "fill-current" : ""}`} />
              {voted ? "Дэмжсэн" : "Дэмжих"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
