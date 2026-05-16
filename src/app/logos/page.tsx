"use client";
import { useEffect, useRef, useState } from "react";
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, doc,
  runTransaction, getDoc,
} from "firebase/firestore";
import {
  Heart, Upload, ImagePlus, Sparkles, Check, RotateCw, Maximize2, Move,
  Trophy, X,
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

// ───────────────────────── helpers ─────────────────────────

/**
 * Strip near-white background from an image and return a transparent PNG Blob.
 * Works well for typical logos exported on white. Pixels with
 * R,G,B all >= threshold become transparent; near-edge pixels get partial alpha
 * for a soft cutout.
 */
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
      // fully transparent
      d[i + 3] = 0;
    } else if (minRGB >= threshold - 30) {
      // soft edge: scale alpha
      const t = (minRGB - (threshold - 30)) / 30; // 0..1 closer to white
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
      {/* T-shirt SVG */}
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

        {/* Body */}
        <g filter="url(#shirtShadow)">
          <path
            d="M100 70
               L155 50
               Q200 95 245 50
               L300 70
               L355 120
               L320 160
               L305 150
               L305 360
               Q305 375 290 375
               L110 375
               Q95 375 95 360
               L95 150
               L80 160
               L45 120 Z"
            fill="url(#shirtGrad)"
          />
          {/* Highlight */}
          <path
            d="M100 70
               L155 50
               Q200 95 245 50
               L300 70
               L355 120
               L320 160
               L305 150
               L305 360
               Q305 375 290 375
               L110 375
               Q95 375 95 360
               L95 150
               L80 160
               L45 120 Z"
            fill="url(#shirtHi)"
          />
          {/* Collar inner */}
          <path
            d="M155 50 Q200 95 245 50 Q200 78 155 50 Z"
            fill="#070707"
          />
          {/* Stitch lines */}
          <path d="M95 150 L95 360" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <path d="M305 150 L305 360" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </g>
      </svg>

      {/* Logo overlay */}
      {src && (
        <div
          onPointerDown={onPointerDown}
          className={`absolute select-none ${
            editable ? "cursor-move ring-1 ring-gold/0 hover:ring-gold/60" : ""
          }`}
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
        <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 text-white text-[10px] uppercase tracking-widest px-2.5 py-1">
          <Move className="w-3 h-3" /> чирж байрлуул
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function LogosPage() {
  const { user } = useAuth();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  // Upload state
  const [title, setTitle] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "logos"));
    const unsub = onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Logo[];
      list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
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
      const snap = await getDoc(refDoc);
      if (!cancelled && snap.exists()) {
        const data = snap.data();
        Object.keys(data).forEach((k) => { if (data[k]) map[k] = true; });
        setVoted(map);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // When user picks a file: preview + auto background removal
  const onPickFile = async (f: File | null) => {
    if (!f) {
      setRawFile(null); setPreviewUrl(null); setProcessedBlob(null);
      return;
    }
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
    const el = document.getElementById("logoFile") as HTMLInputElement | null;
    if (el) el.value = "";
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
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: placement.rotation,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      clearPick();
    } finally { setBusy(false); }
  };

  const toggleVote = async (logo: Logo) => {
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    const userVotesRef = doc(db, "votes", user.uid);
    const logoRef = doc(db, "logos", logo.id);
    const wasVoted = !!voted[logo.id];
    setVoted((p) => ({ ...p, [logo.id]: !wasVoted }));
    try {
      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userVotesRef);
        const lSnap = await tx.get(logoRef);
        const cur = (lSnap.data()?.votes as number) || 0;
        const userMap = (uSnap.exists() ? uSnap.data() : {}) as Record<string, boolean>;
        const has = !!userMap[logo.id];
        if (has) {
          tx.set(userVotesRef, { ...userMap, [logo.id]: false }, { merge: true });
          tx.update(logoRef, { votes: Math.max(0, cur - 1) });
        } else {
          tx.set(userVotesRef, { ...userMap, [logo.id]: true }, { merge: true });
          tx.update(logoRef, { votes: cur + 1 });
        }
      });
    } catch (err) {
      setVoted((p) => ({ ...p, [logo.id]: wasVoted }));
      console.error(err);
    }
  };

  const top = logos[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-black/50">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          Логоны санал асуулга
        </div>
        <h1 className="font-display text-4xl md:text-6xl mt-3 leading-tight">
          Футболкан дээрх <span className="gold-text">логоо</span> сонгоё
        </h1>
        <p className="text-black/60 mt-3 max-w-2xl mx-auto">
          Логогоо хүссэн газраа байрлуулж байршуулна. Хамгийн их зүрх авсан загвар тэргүүлнэ.
        </p>
      </div>

      {/* Leader showcase */}
      {top && (
        <div className="mt-10 grid md:grid-cols-[auto,1fr] gap-8 items-center card p-6 md:p-8">
          <div className="w-full md:w-80">
            <ShirtMock
              src={top.url}
              placement={{
                x: top.x ?? DEFAULT_PLACEMENT.x,
                y: top.y ?? DEFAULT_PLACEMENT.y,
                scale: top.scale ?? DEFAULT_PLACEMENT.scale,
                rotation: top.rotation ?? DEFAULT_PLACEMENT.rotation,
              }}
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
              <Trophy className="w-4 h-4" /> Тэргүүлэгч
            </div>
            <h2 className="font-display text-3xl md:text-4xl mt-1">{top.title}</h2>
            <p className="text-black/60 mt-2">— {top.authorName}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-wine/10 text-wine px-4 py-2">
              <Heart className="w-4 h-4 fill-current" />
              <span className="font-display text-xl">{top.votes || 0}</span>
              <span className="text-xs uppercase tracking-widest">зүрх</span>
            </div>
          </div>
        </div>
      )}

      {/* Upload editor */}
      <form
        onSubmit={upload}
        className="relative mt-10 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-white via-white to-cream/60 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gold/10 blur-2xl pointer-events-none" />

        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-xs uppercase tracking-[0.25em] text-black/60 font-semibold">
              Логоо илгээх — шууд футболкан дээрээ байрлуулна
            </span>
          </div>

          <div className="grid md:grid-cols-[320px,1fr] gap-6">
            {/* Live preview / editor */}
            <div>
              <ShirtMock
                src={previewUrl}
                placement={placement}
                editable={!!previewUrl}
                onChange={setPlacement}
              />
              {!previewUrl && (
                <div className="mt-3 text-xs text-black/45 text-center italic">
                  Зураг сонгомогц энд харагдана
                </div>
              )}
              {previewUrl && (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-black/55">
                      <span className="inline-flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5" /> Хэмжээ
                      </span>
                      <span>{Math.round(placement.scale * 100)}%</span>
                    </div>
                    <input
                      type="range" min={10} max={80} step={1}
                      value={Math.round(placement.scale * 100)}
                      onChange={(e) => setPlacement((p) => ({ ...p, scale: Number(e.target.value) / 100 }))}
                      className="w-full accent-[#C8A24B]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-black/55">
                      <span className="inline-flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5" /> Эргэлт
                      </span>
                      <span>{placement.rotation}°</span>
                    </div>
                    <input
                      type="range" min={-45} max={45} step={1}
                      value={placement.rotation}
                      onChange={(e) => setPlacement((p) => ({ ...p, rotation: Number(e.target.value) }))}
                      className="w-full accent-[#C8A24B]"
                    />
                  </div>
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

            {/* Form fields */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Логоны зураг</label>
                <label
                  htmlFor="logoFile"
                  className={`group flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-all ${
                    rawFile
                      ? "border-gold bg-gold/5"
                      : "border-black/15 hover:border-gold hover:bg-gold/5"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors ${
                      rawFile ? "bg-gold text-black" : "bg-black/5 text-black/60 group-hover:bg-gold/20 group-hover:text-black"
                    }`}
                  >
                    {processing ? (
                      <span className="block w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    ) : rawFile ? <Check className="w-5 h-5" /> : <ImagePlus className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {rawFile ? rawFile.name : "Зураг сонгох"}
                    </div>
                    <div className="text-xs text-black/50">
                      {processing
                        ? "Дэвсгэрийг автоматаар арилгаж байна…"
                        : rawFile
                          ? "Дэвсгэр нь автоматаар арилсан"
                          : "PNG / JPG · 5MB хүртэл · цагаан дэвсгэр автоматаар арилна"}
                    </div>
                  </div>
                  {rawFile && !processing && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); clearPick(); }}
                      className="p-1.5 rounded-md text-black/50 hover:text-wine hover:bg-black/5"
                      aria-label="Арилгах"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </label>
                <input
                  id="logoFile"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="label">Гарчиг</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Логоны нэр"
                />
              </div>

              <div className="rounded-xl bg-cream/60 border border-black/5 p-4 text-xs text-black/65 leading-relaxed">
                <b className="text-black/80">Зөвлөмж:</b> Цагаан дэвсгэртэй PNG/JPG илгээхэд
                дэвсгэрийг автоматаар тунгалаг болгож, футболка дээр байрлуулна. Логогоо
                <b> чирж</b> зөөгөөд, sliders ашиглан хэмжээ/эргэлтийг тохируулна.
              </div>

              <button
                type="submit"
                className="btn btn-primary h-[46px] px-6 gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed self-start"
                disabled={busy || !user || !processedBlob}
              >
                <Upload className="w-4 h-4" />
                {busy ? "Илгээж байна..." : user ? "Илгээх" : "Нэвтэрнэ үү"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Feed of posts */}
      <section className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl md:text-3xl">Бүх логонууд</h2>
          <div className="text-xs uppercase tracking-widest text-black/45">{logos.length} загвар</div>
        </div>

        {logos.length === 0 ? (
          <div className="mt-6 text-center text-black/40 italic card p-10">
            Эхний логоо оруулцгаая.
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {logos.map((l, i) => (
              <article key={l.id} className="card overflow-hidden flex flex-col">
                <div className="relative">
                  <ShirtMock
                    src={l.url}
                    placement={{
                      x: l.x ?? DEFAULT_PLACEMENT.x,
                      y: l.y ?? DEFAULT_PLACEMENT.y,
                      scale: l.scale ?? DEFAULT_PLACEMENT.scale,
                      rotation: l.rotation ?? DEFAULT_PLACEMENT.rotation,
                    }}
                    className="rounded-none"
                  />
                  <div className="absolute top-3 left-3 rank-badge rank-x bg-white/90 backdrop-blur">
                    #{i + 1}
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg truncate">{l.title}</div>
                    <div className="text-xs text-black/50 truncate">— {l.authorName}</div>
                  </div>
                  <button
                    onClick={() => toggleVote(l)}
                    className={`btn ${voted[l.id] ? "btn-gold" : "btn-ghost"} !py-2 !px-3 shrink-0`}
                    title={user ? "Зүрх дарж дэмжих" : "Нэвтэрнэ үү"}
                  >
                    <Heart
                      className={`w-4 h-4 mr-1.5 ${voted[l.id] ? "fill-current" : ""}`}
                      aria-hidden
                    />
                    <span className="font-display">{l.votes || 0}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
