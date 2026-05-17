"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, addDoc, serverTimestamp, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/lib/auth";

type Photo = {
  id: string;
  url: string;
  caption?: string;
  frame: "polaroid" | "gold" | "vintage";
  authorName: string;
  authorUid: string;
  createdAt?: any;
};

const frames = [
  { key: "polaroid", label: "Polaroid" },
  { key: "gold",     label: "Алтан" },
  { key: "vintage",  label: "Сонгодог" },
] as const;

export default function PhotosPage() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [frame, setFrame] = useState<Photo["frame"]>("polaroid");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) =>
      setPhotos(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft")  setLightbox((i) => (i === null ? null : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [lightbox, photos.length]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    setFile(f);
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    if (!file) return;
    setBusy(true);
    try {
      const { secure_url: url } = await uploadToCloudinary(file, {
        folder: `photos/${user.uid}`,
        fileName: `${Date.now()}_${file.name}`,
      });
      await addDoc(collection(db, "photos"), {
        url, caption: caption.trim(), frame,
        authorUid: user.uid,
        authorName: user.displayName || user.email,
        createdAt: serverTimestamp(),
      });
      setCaption("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("upload failed", err);
      alert("Зураг оруулахад алдаа гарлаа: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const scrollReel = (dir: -1 | 1) => {
    const el = reelRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 32 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const authors = useMemo(() => {
    const map = new Map<string, { uid: string; name: string; latest: string; count: number }>();
    photos.forEach((p) => {
      const prev = map.get(p.authorUid);
      if (prev) { prev.count += 1; }
      else map.set(p.authorUid, { uid: p.authorUid, name: p.authorName, latest: p.url, count: 1 });
    });
    return Array.from(map.values()).slice(0, 16);
  }, [photos]);

  return (
    <div className="relative">
      {/* === Hero === */}
      <section className="photos-hero">
        <div className="photos-hero-inner">
          <div className="text-center relative z-10">
            <div className="text-[11px] uppercase tracking-[0.4em] text-[#f3d77a]/90">Дурсамжийн булан</div>
            <h1 className="font-display text-5xl md:text-7xl mt-3 text-white">
              Зургийн <span className="gold-text">түүх</span>
            </h1>
            <p className="mt-4 max-w-xl mx-auto text-white/70 text-sm md:text-base">
              Хичээлийн жилүүдийг гэрэлд тогтоосон агшнууд. Хажуу тийш гүйлгэн үзээрэй.
            </p>
          </div>
          <div className="hero-deco" aria-hidden>
            {photos.slice(0, 5).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className={`hero-deco-img hero-deco-${i}`} />
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-10">
        {/* === Story rail === */}
        {authors.length > 0 && (
          <div className="story-rail card px-4 py-4 mb-10">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
              {authors.map((a) => (
                <div key={a.uid} className="flex flex-col items-center gap-1 min-w-[68px]">
                  <div className="story-ring">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.latest} alt={a.name} />
                  </div>
                  <div className="text-[10px] text-black/60 max-w-[68px] truncate text-center">{a.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === Upload card === */}
        <form
          onSubmit={upload}
          className="card p-6 md:p-8 grid md:grid-cols-[260px,1fr] gap-6 items-stretch"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
        >
          <label
            htmlFor="photoFile"
            className={`dropzone ${dragOver ? "dropzone-over" : ""} ${preview ? "has-preview" : ""}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="text-center px-4">
                <div className="text-3xl mb-2">＋</div>
                <div className="text-sm font-semibold">Зургаа чирж тавь</div>
                <div className="text-[11px] text-black/50 mt-1">эсвэл дарж сонгоно уу</div>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="photoFile" type="file" accept="image/*" className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>

          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Тайлбар</label>
              <input
                className="input"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Хаана, хэн, хэзээ?"
              />
            </div>

            <div>
              <label className="label">Хүрээ сонгох</label>
              <div className="grid grid-cols-3 gap-3">
                {frames.map((f) => (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => setFrame(f.key as Photo["frame"])}
                    className={`frame-pick ${frame === f.key ? "frame-pick-active" : ""}`}
                  >
                    <span className={`fp-swatch fp-${f.key}`} />
                    <span className="text-sm">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-auto pt-2">
              <div className="text-xs text-black/50 truncate">
                {file ? <>📷 <b className="text-black/70">{file.name}</b></> : "Зураг хараахан сонгоогүй байна"}
              </div>
              <button className="btn btn-primary shrink-0" disabled={busy || !user || !file}>
                {busy ? "Илгээж байна…" : user ? "Дурсамж нэмэх" : "Нэвтэрнэ үү"}
              </button>
            </div>
          </div>
        </form>

        {/* === Reel (story-like horizontal scroll) === */}
        <div className="mt-14">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-black/50">Сүүлийн агшнууд</div>
              <h2 className="font-display text-3xl md:text-4xl mt-1">Гүйлгэн үзэх</h2>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button onClick={() => scrollReel(-1)} className="reel-nav" aria-label="Зүүн">‹</button>
              <button onClick={() => scrollReel(1)}  className="reel-nav" aria-label="Баруун">›</button>
            </div>
          </div>

          <div className="reel-wrap">
            <div ref={reelRef} className="reel">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  data-card
                  onClick={() => setLightbox(i)}
                  className="reel-card group"
                  style={{ ["--i" as any]: i }}
                >
                  <FrameWrap frame={p.frame} index={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || ""} className="w-full h-full object-cover" />
                  </FrameWrap>
                  <div className="mt-3 text-center px-2">
                    {p.caption && (
                      <div className="font-display text-base leading-tight line-clamp-2">{p.caption}</div>
                    )}
                    <div className="text-[11px] text-black/45 mt-1">— {p.authorName}</div>
                  </div>
                </button>
              ))}
              {photos.length === 0 && (
                <div className="w-full text-center text-black/40 italic py-16">
                  Эхний зургаа орууллаа гэхэд…
                </div>
              )}
            </div>
            <div className="reel-fade-l" />
            <div className="reel-fade-r" />
          </div>
        </div>

        <div className="mb-24" />
      </div>

      {/* === Lightbox === */}
      {lightbox !== null && photos[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button
            className="lb-btn lb-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Хаах"
          >✕</button>
          {lightbox > 0 && (
            <button
              className="lb-btn lb-prev"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? null : Math.max(0, i - 1))); }}
              aria-label="Өмнөх"
            >‹</button>
          )}
          {lightbox < photos.length - 1 && (
            <button
              className="lb-btn lb-next"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? null : Math.min(photos.length - 1, i + 1))); }}
              aria-label="Дараах"
            >›</button>
          )}
          <figure className="lb-figure" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[lightbox].url} alt="" />
            <figcaption>
              {photos[lightbox].caption && (
                <div className="font-display text-xl">{photos[lightbox].caption}</div>
              )}
              <div className="text-xs opacity-70 mt-1">— {photos[lightbox].authorName}</div>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

function FrameWrap({ children, frame, index }: { children: React.ReactNode; frame: Photo["frame"]; index: number }) {
  const rot = ((index % 5) - 2) + "deg";
  if (frame === "polaroid") {
    return (
      <div className="frame-polaroid w-full" style={{ ["--rot" as any]: rot }}>
        <div className="aspect-square overflow-hidden">{children}</div>
      </div>
    );
  }
  if (frame === "gold") {
    return (
      <div className="frame-gold w-full">
        <div className="inner aspect-square overflow-hidden">{children}</div>
      </div>
    );
  }
  return (
    <div className="frame-vintage w-full">
      <div className="aspect-square overflow-hidden">{children}</div>
    </div>
  );
}
