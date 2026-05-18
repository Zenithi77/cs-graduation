"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin/fund";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Нэвтрэхэд алдаа гарлаа.");
      }
      router.push(next);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Алдаа.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-wine/10">
          <ShieldCheck className="w-7 h-7 text-wine" />
        </div>
        <h1 className="font-display text-4xl mt-4">Admin нэвтрэх</h1>
        <p className="text-black/55 mt-2 text-sm">
          Зөвхөн дотоод (localhost) хандалт.
        </p>
      </div>

      <form onSubmit={submit} className="card p-6 mt-8 space-y-4">
        <div>
          <label className="label">Хэрэглэгч</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label">Нууц үг</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {err && (
          <div className="flex items-start gap-2 text-sm text-wine bg-wine/5 border border-wine/20 rounded p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Шалгаж байна...
            </span>
          ) : (
            "Нэвтрэх"
          )}
        </button>

        <p className="text-center text-xs text-black/40">
          Эрх нь <code className="font-mono">.env.local</code>-д
          тохируулагдсан байх ёстой.
        </p>
      </form>
    </div>
  );
}
