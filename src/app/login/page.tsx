"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signInEmail, signInGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await signInEmail(email, password);
      router.push("/");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display text-4xl text-center">Нэвтрэх</h1>
      <form onSubmit={submit} className="card p-6 mt-8 space-y-4">
        <div>
          <label className="label">И-мэйл</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Нууц үг</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <p className="text-sm text-wine">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "..." : "Нэвтрэх"}
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={() => signInGoogle().then(() => router.push("/"))}>
          Google-ээр нэвтрэх
        </button>
        <p className="text-sm text-center text-black/60">
          Шинэ бол <Link href="/signup" className="text-wine underline">бүртгүүлэх</Link>
        </p>
      </form>
    </div>
  );
}
