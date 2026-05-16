"use client";
import { useEffect, useState } from "react";
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "photos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) =>
      setPhotos(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    return () => unsub();
  }, []);

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
      setCaption(""); setFile(null);
      (document.getElementById("photoFile") as HTMLInputElement).value = "";
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-black/50">Дурсамжийн булан</div>
        <h1 className="font-display text-4xl md:text-5xl mt-2">Зургийн булан</h1>
      </div>

      <form onSubmit={upload} className="card p-6 mt-10 grid md:grid-cols-[1fr,1fr,1fr,auto] gap-4 items-end">
        <div>
          <label className="label">Зураг</label>
          <input id="photoFile" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        </div>
        <div>
          <label className="label">Тайлбар</label>
          <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Хаана, хэн, хэзээ?" />
        </div>
        <div>
          <label className="label">Хүрээ</label>
          <select className="input" value={frame} onChange={(e) => setFrame(e.target.value as any)}>
            {frames.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy || !user}>
          {busy ? "..." : user ? "Оруулах" : "Нэвтэрнэ үү"}
        </button>
      </form>

      {/* Gallery */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-12">
        {photos.map((p, i) => (
          <figure key={p.id} className="flex flex-col items-center">
            <FrameWrap frame={p.frame} index={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || ""} className="w-full h-full object-cover" />
            </FrameWrap>
            {p.caption && (
              <figcaption className="font-display text-sm mt-2 text-center">{p.caption}</figcaption>
            )}
            <div className="text-[11px] text-black/40">— {p.authorName}</div>
          </figure>
        ))}
      </div>

      {photos.length === 0 && (
        <p className="text-center text-black/40 italic mt-12">Эхний зургаа орууллаа гэхэд...</p>
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
