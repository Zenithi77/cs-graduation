"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import confetti from "canvas-confetti";

type Grad = {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
};

export default function ProfilesPage() {
  const [grads, setGrads] = useState<Grad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Left cannon
    confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.65 } });
    // Right cannon
    confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.65 } });

    // Second wave after short delay
    const t1 = setTimeout(() => {
      confetti({ particleCount: 60, angle: 70, spread: 60, origin: { x: 0.1, y: 0.6 } });
      confetti({ particleCount: 60, angle: 110, spread: 60, origin: { x: 0.9, y: 0.6 } });
    }, 350);

    // Center burst finale
    const t2 = setTimeout(() => {
      confetti({ particleCount: 100, spread: 120, origin: { x: 0.5, y: 0.55 }, scalar: 1.1 });
    }, 700);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, "users"),
        where("isGraduate", "==", true),
        where("class", "==", "КУ-5"),
      );
      const snap = await getDocs(q);
      setGrads(snap.docs.map((d) => d.data() as Grad));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-black/50">Class of 2026</div>
        <h1 className="font-display text-4xl md:text-5xl mt-2">Төгсөгчид</h1>
        <p className="text-black/60 mt-2">Хүн бүрийн нэр дээр дарж захидал үлдээгээрэй.</p>
      </div>

      {loading ? (
        <p className="text-center text-black/50">Уншиж байна...</p>
      ) : grads.length === 0 ? (
        <p className="text-center text-black/60">Одоогоор төгсөгч бүртгэгдээгүй байна.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {grads.map((g, i) => (
            <div key={g.uid} className="flex flex-col items-center gap-3">
              <Link href={`/profiles/${g.uid}`} className="block">
                <div
                  className="frame-polaroid"
                  style={{ ["--rot" as any]: `${(i % 5) - 2}deg` }}
                >
                  <div className="aspect-square bg-gradient-to-br from-cream to-gold/20 flex items-center justify-center overflow-hidden">
                    {g.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.photoURL} alt={g.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-5xl text-ink/40">
                        {(g.displayName || "?").charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="text-center font-display mt-3 text-lg">{g.displayName}</div>
                </div>
              </Link>
              <Link
                href={`/profiles/${g.uid}#messages`}
                className="btn btn-gold btn-lure text-xs px-4 py-2 w-full text-center"
              >
                Сэтгэгдэл бичих
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
