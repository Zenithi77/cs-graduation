"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { signUpEmail, signInGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isGraduate, setIsGraduate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await signUpEmail(email, password, name, isGraduate);
      router.push("/");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display text-4xl text-center">Бүртгүүлэх</h1>
      <form onSubmit={submit} className="card p-6 mt-8 space-y-4">
        <div>
          <label className="label">Нэр</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">И-мэйл</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Нууц үг</label>
          <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isGraduate} onChange={(e) => setIsGraduate(e.target.checked)} />
          Би энэ удаа төгсөж байгаа
        </label>
        {err && <p className="text-sm text-wine">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "..." : "Бүртгүүлэх"}
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={() => signInGoogle(isGraduate).then(() => router.push("/"))}>
          Google-ээр үргэлжлүүлэх
        </button>
        <p className="text-sm text-center text-black/60">
          Бүртгэлтэй бол <Link href="/login" className="text-wine underline">нэвтрэх</Link>
        </p>
      </form>
    </div>
  );
}
