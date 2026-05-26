"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/lib/auth";

type Profile = {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  isGraduate?: boolean;
};
type Msg = {
  id: string;
  authorName: string;
  authorUid: string;
  text: string;
  createdAt?: any;
};

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.data() as Profile | undefined;
        if (data) {
          setP(data);
          setBio(data.bio || "");
          setName(data.displayName || "");
        }
      } catch (err) {
        console.warn("[profile] load failed:", err);
      }
    })();
    const q = query(collection(db, "users", uid, "messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => console.warn("[profile] messages snapshot:", err)
    );
    return () => unsub();
  }, [uid]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Захидал илгээхийн тулд эхлээд нэвтэрнэ үү."); return; }
    if (!text.trim()) return;
    await addDoc(collection(db, "users", uid, "messages"), {
      text: text.trim(),
      authorUid: user.uid,
      authorName: user.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  const saveProfile = async () => {
    if (!user || user.uid !== uid) return;
    await updateDoc(doc(db, "users", uid), { bio, displayName: name });
    setP((prev) => prev ? { ...prev, bio, displayName: name } : prev);
    setEditing(false);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || user.uid !== uid) return;
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { secure_url: url } = await uploadToCloudinary(file, {
        folder: `avatars/${uid}`,
        fileName: `${Date.now()}_${file.name}`,
      });
      await updateDoc(doc(db, "users", uid), { photoURL: url });
      setP((prev) => prev ? { ...prev, photoURL: url } : prev);
    } catch (err) {
      console.error("[profile] photo upload failed:", err);
      alert("Зураг илгээхэд алдаа гарлаа. Дахин оролдоно уу.");
    } finally { setUploading(false); }
  };

  if (!p) return <div className="text-center py-20 text-black/50">Уншиж байна...</div>;
  const isOwner = user?.uid === uid;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-[260px,1fr] gap-8 items-start">
        <div className="frame-polaroid mx-auto" style={{ ["--rot" as any]: "-3deg" }}>
          <div className="aspect-square w-56 bg-gradient-to-br from-cream to-gold/20 overflow-hidden flex items-center justify-center">
            {p.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.photoURL} src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-7xl text-ink/40">{(p.displayName || "?").charAt(0)}</span>
            )}
          </div>
          <div className="text-center font-display mt-3 text-xl">{p.displayName}</div>
          {isOwner && (
            <label className="block text-center text-xs text-wine mt-1 cursor-pointer">
              {uploading ? "Илгээж байна..." : "Зураг солих"}
              <input type="file" accept="image/*" hidden onChange={onPhoto} />
            </label>
          )}
        </div>

        <div>
          {editing ? (
            <div className="card p-5 space-y-3">
              <div>
                <label className="label">Нэр</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Танилцуулга</label>
                <textarea className="input min-h-[120px]" value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={saveProfile}>Хадгалах</button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Болих</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-4xl">{p.displayName}</h1>
              <p className="mt-3 text-black/70 whitespace-pre-wrap">
                {p.bio || (isOwner ? "Танилцуулга нэмэх..." : "—")}
              </p>
              {isOwner && (
                <button className="btn btn-ghost mt-4 text-sm" onClick={() => setEditing(true)}>
                  Профайл засах
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <section className="mt-14">
        <h2 className="font-display text-2xl">Дүү нараас захидал</h2>

        <form onSubmit={send} className="card p-5 mt-4 space-y-3">
          <textarea
            className="input min-h-[100px]"
            placeholder={user ? "Сэтгэгдэл, ерөөл бичих..." : "Бичихийн тулд эхлээд нэвтэрнэ үү"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!user}
          />
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={!user || !text.trim()}>
              Илгээх
            </button>
          </div>
        </form>

        <ul className="mt-6 space-y-4">
          {msgs.map((m) => (
            <li key={m.id} className="card p-5">
              <div className="text-sm font-semibold text-wine">{m.authorName}</div>
              <p className="mt-2 whitespace-pre-wrap">{m.text}</p>
            </li>
          ))}
          {msgs.length === 0 && (
            <p className="text-center text-black/40 italic">Эхний захидлыг та үлдээгээрэй.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
