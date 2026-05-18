"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

const CLASSES = ["КУ-1", "КУ-2", "КУ-3", "КУ-4", "КУ-5"];

interface AccountDoc {
  uid: string;
  class: string;
  firstname: string;
  lastname: string;
  email: string;
}

export default function LoginPage() {
  const { signInEmail } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountDoc[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedFirstname, setSelectedFirstname] = useState("");
  const [selectedLastname, setSelectedLastname] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch accounts once on mount.
  useEffect(() => {
    getDocs(collection(db, "accounts"))
      .then((snap) => setAccounts(snap.docs.map((d) => d.data() as AccountDoc)))
      .catch((e) => {
        console.error("[login] accounts fetch failed:", e);
        setErr("Дансны жагсаалт ачаалахад алдаа гарлаа. Дахин оролдоно уу.");
      })
      .finally(() => setLoadingAccounts(false));
  }, []);

  // Reset downstream selections when parent changes.
  const handleClassChange = (v: string) => {
    setSelectedClass(v);
    setSelectedFirstname("");
    setSelectedLastname("");
    setErr(null);
  };
  const handleFirstnameChange = (v: string) => {
    setSelectedFirstname(v);
    setSelectedLastname("");
    setErr(null);
  };

  // Unique firstnames in the selected class, sorted.
  const availableFirstnames = useMemo(() => {
    if (!selectedClass) return [];
    const names = accounts
      .filter((a) => a.class === selectedClass)
      .map((a) => a.firstname);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "mn"));
  }, [accounts, selectedClass]);

  // Accounts that match the current class + firstname selection.
  const matchingAccounts = useMemo(() => {
    if (!selectedClass || !selectedFirstname) return [];
    return accounts.filter(
      (a) => a.class === selectedClass && a.firstname === selectedFirstname
    );
  }, [accounts, selectedClass, selectedFirstname]);

  const hasDuplicateFirstname = matchingAccounts.length > 1;

  // The single resolved account (null if ambiguous or not yet chosen).
  const resolvedAccount = useMemo<AccountDoc | null>(() => {
    if (!hasDuplicateFirstname) return matchingAccounts[0] ?? null;
    if (!selectedLastname) return null;
    return matchingAccounts.find((a) => a.lastname === selectedLastname) ?? null;
  }, [hasDuplicateFirstname, matchingAccounts, selectedLastname]);

  const nameResolved = resolvedAccount !== null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedAccount) return;
    setErr(null);
    setBusy(true);
    try {
      await signInEmail(resolvedAccount.email, password);
      router.push("/");
    } catch {
      setErr("Нууц үг буруу байна. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="font-display text-4xl text-center">Нэвтрэх</h1>

      <form onSubmit={submit} className="card p-6 mt-8 space-y-4">

        {/* Class */}
        <div>
          <label className="label">Анги</label>
          <select
            className="input"
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            required
            disabled={loadingAccounts}
          >
            <option value="">— Анги сонгох —</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Firstname — appears once class is chosen */}
        {selectedClass && (
          <div>
            <label className="label">Нэр</label>
            <select
              className="input"
              value={selectedFirstname}
              onChange={(e) => handleFirstnameChange(e.target.value)}
              required
            >
              <option value="">— Нэр сонгох —</option>
              {availableFirstnames.map((fn) => (
                <option key={fn} value={fn}>{fn}</option>
              ))}
            </select>
          </div>
        )}

        {/* Lastname — appears only when there are duplicate firstnames */}
        {hasDuplicateFirstname && (
          <div>
            <label className="label">Овог</label>
            <select
              className="input"
              value={selectedLastname}
              onChange={(e) => { setSelectedLastname(e.target.value); setErr(null); }}
              required
            >
              <option value="">— Овог сонгох —</option>
              {matchingAccounts.map((a) => (
                <option key={a.uid} value={a.lastname}>{a.lastname}</option>
              ))}
            </select>
          </div>
        )}

        {/* Password — appears once name is uniquely resolved */}
        {nameResolved && (
          <div>
            <label className="label">Нууц үг</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(null); }}
              required
              autoFocus
            />
          </div>
        )}

        {err && <p className="text-sm text-wine">{err}</p>}

        <button
          className="btn btn-primary w-full"
          disabled={busy || !nameResolved || !password}
        >
          {busy ? "..." : "Нэвтрэх"}
        </button>

      </form>
    </div>
  );
}
