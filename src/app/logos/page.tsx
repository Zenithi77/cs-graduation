"use client";
import { useEffect, useMemo, useState } from "react";
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, doc,
  runTransaction, getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Heart, Upload, ImagePlus, Sparkles, Check } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Logo = {
  id: string;
  url: string;
  title: string;
  authorName: string;
  authorUid: string;
  votes: number;
  createdAt?: any;
};

export default function LogosPage() {
  const { user } = useAuth();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  // load which logos current user has voted on
  useEffect(() => {
    if (!user) { setVoted({}); return; }
    let cancelled = false;
    (async () => {
      const map: Record<string, boolean> = {};
      // lazy: read on demand per logo via onSnapshot would be too many; we'll fetch a single user doc
      const ref = doc(db, "votes", user.uid);
      const snap = await getDoc(ref);
      if (!cancelled && snap.exists()) {
        const data = snap.data();
        Object.keys(data).forEach((k) => { if (data[k]) map[k] = true; });
        setVoted(map);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    if (!file) return;
    setBusy(true);
    try {
      const r = ref(storage, `logos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await addDoc(collection(db, "logos"), {
        url, title: title.trim() || "Лого",
        authorUid: user.uid,
        authorName: user.displayName || user.email,
        votes: 0,
        createdAt: serverTimestamp(),
      });
      setTitle(""); setFile(null);
      (document.getElementById("logoFile") as HTMLInputElement).value = "";
    } finally { setBusy(false); }
  };

  const toggleVote = async (logo: Logo) => {
    if (!user) { alert("Эхлээд нэвтэрнэ үү."); return; }
    const userVotesRef = doc(db, "votes", user.uid);
    const logoRef = doc(db, "logos", logo.id);
    const wasVoted = !!voted[logo.id];
    setVoted((p) => ({ ...p, [logo.id]: !wasVoted })); // optimistic
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
      // revert
      setVoted((p) => ({ ...p, [logo.id]: wasVoted }));
      console.error(err);
    }
  };

  const top = logos[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-black/50">Логоны санал асуулга</div>
        <h1 className="font-display text-4xl md:text-5xl mt-2">Футболкан дээрх логоо сонгоё</h1>
        <p className="text-black/60 mt-2 max-w-2xl mx-auto">
          Хамгийн их сэтгэл татсан логог дээгүүр харуулна. Зүрхээр санал өгнө үү.
        </p>
      </div>

      {/* T-shirt preview of leader */}
      <div className="mt-10 grid md:grid-cols-2 gap-8 items-center">
        <TShirtPreview src={top?.url} title={top?.title} />
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Тэргүүлэгч</div>
          <h2 className="font-display text-3xl mt-1">{top?.title || "—"}</h2>
          <p className="text-black/60 mt-2">
            {top ? `${top.authorName} • ${top.votes || 0} зүрх` : "Эхний логоо оруулцгаая."}
          </p>
        </div>
      </div>

      {/* Upload */}
      <form
        onSubmit={upload}
        className="relative mt-12 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-white via-white to-cream/60 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
      >
        {/* Decorative gold accent bar */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gold/10 blur-2xl pointer-events-none" />

        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-xs uppercase tracking-[0.25em] text-black/60 font-semibold">
              Логоо илгээх
            </span>
          </div>

          <div className="grid md:grid-cols-[1.1fr,1fr,auto] gap-5 items-end">
            {/* File picker */}
            <div>
              <label className="label">Логоны зураг</label>
              <label
                htmlFor="logoFile"
                className={`group flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-all ${
                  file
                    ? "border-gold bg-gold/5"
                    : "border-black/15 hover:border-gold hover:bg-gold/5"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors ${
                    file ? "bg-gold text-black" : "bg-black/5 text-black/60 group-hover:bg-gold/20 group-hover:text-black"
                  }`}
                >
                  {file ? <Check className="w-5 h-5" /> : <ImagePlus className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">
                    {file ? file.name : "Зураг сонгох"}
                  </div>
                  <div className="text-xs text-black/50">
                    {file
                      ? `${(file.size / 1024).toFixed(0)} KB • дарж солих`
                      : "PNG, JPG · 5MB хүртэл"}
                  </div>
                </div>
              </label>
              <input
                id="logoFile"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            {/* Title */}
            <div>
              <label className="label">Гарчиг</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Логоны нэр"
              />
            </div>

            {/* Submit */}
            <button
              className="btn btn-primary h-[46px] px-6 gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy || !user}
            >
              <Upload className="w-4 h-4" />
              {busy ? "Илгээж байна..." : user ? "Илгээх" : "Нэвтэрнэ үү"}
            </button>
          </div>
        </div>
      </form>

      {/* Ranking */}
      <ol className="mt-12 space-y-5">
        {logos.map((l, i) => (
          <li key={l.id} className="card p-5 flex items-center gap-5">
            <div className="font-display text-3xl text-gold w-10 text-center">#{i + 1}</div>
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-cream flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.url} alt={l.title} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <div className="font-display text-xl">{l.title}</div>
              <div className="text-xs text-black/50">— {l.authorName}</div>
            </div>
            <button
              onClick={() => toggleVote(l)}
              className={`btn ${voted[l.id] ? "btn-gold" : "btn-ghost"}`}
              title={user ? "Зүрх дарж дэмжих" : "Нэвтэрнэ үү"}
            >
              <Heart
                className={`w-4 h-4 mr-2 ${voted[l.id] ? "fill-current" : ""}`}
                aria-hidden
              />
              <span className="font-display">{l.votes || 0}</span>
            </button>
          </li>
        ))}
        {logos.length === 0 && (
          <li className="text-center text-black/40 italic">Эхний логоо оруулцгаая.</li>
        )}
      </ol>
    </div>
  );
}

function TShirtPreview({ src, title }: { src?: string; title?: string }) {
  return (
    <div className="relative mx-auto w-full max-w-sm aspect-square bg-gradient-to-br from-cream to-gold/20 rounded-2xl flex items-center justify-center overflow-hidden">
      {/* simple t-shirt silhouette */}
      <svg viewBox="0 0 200 200" className="w-4/5 h-4/5 drop-shadow">
        <path
          d="M50 30 L80 20 Q100 40 120 20 L150 30 L175 60 L150 80 L150 175 Q150 185 140 185 L60 185 Q50 185 50 175 L50 80 L25 60 Z"
          fill="#1B1B1B"
        />
      </svg>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={title || ""}
          className="absolute w-1/3 h-1/3 object-contain"
          style={{ top: "42%", left: "50%", transform: "translate(-50%,-50%)" }}
        />
      )}
    </div>
  );
}
