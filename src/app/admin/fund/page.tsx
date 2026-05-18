"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Search,
  Users,
  Coins,
  Download,
  LogOut,
} from "lucide-react";
import { FUND_FEE, CLASS_NAMES } from "@/lib/constants";

type Row = {
  uid: string;
  displayName: string;
  email: string;
  class: string;
  totalDonated: number;
  lastDonatedAt: string | null;
  paid: boolean;
};

export default function AdminFundPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/fund-data", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/admin/login?next=/admin/fund");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { users: Row[] };
        if (alive) setUsers(data.users);
      } catch (e: any) {
        if (alive) setError(e?.message || "Алдаа гарлаа.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const cls of CLASS_NAMES) map.set(cls, []);
    for (const u of users) {
      const cls = u.class || "—";
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(u);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "", "mn"),
      );
    }
    return map;
  }, [users]);

  const overall = useMemo(() => {
    let paid = 0;
    let amount = 0;
    for (const u of users) {
      amount += u.totalDonated;
      if (u.paid) paid += 1;
    }
    return { paid, total: users.length, amount };
  }, [users]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-black/50">
        Уншиж байна...
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-wine">Алдаа</h1>
        <p className="text-black/60 mt-3">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-black/50">
            Admin · localhost
          </div>
          <h1 className="font-display text-4xl mt-1">Төлбөрийн хяналт</h1>
          <p className="text-black/60 mt-2 text-sm">
            Курс тус бүрээр төгсөгчдийн хураамжийн төлөв.
          </p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => exportCsv(grouped)}
            className="btn btn-ghost text-sm inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV татах
          </button>
          <button
            onClick={logout}
            className="btn btn-ghost text-sm inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Гарах
          </button>
        </div>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5 text-wine" />}
          label="Нийт төгсөгч"
          value={overall.total.toString()}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label="Төлсөн"
          value={`${overall.paid} / ${overall.total}`}
          hint={
            overall.total
              ? `${Math.round((overall.paid / overall.total) * 100)}%`
              : ""
          }
        />
        <StatCard
          icon={<Coins className="w-5 h-5 text-gold" />}
          label="Нийт цуглуулсан"
          value={`${overall.amount.toLocaleString()}₮`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Нэр эсвэл и-мэйлээр хайх..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "paid", "unpaid"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-lg text-sm border transition ${
                filter === v
                  ? "bg-wine text-cream border-wine"
                  : "bg-cream border-black/10 hover:border-wine/40"
              }`}
            >
              {v === "all"
                ? "Бүгд"
                : v === "paid"
                ? "Төлсөн"
                : "Төлөөгүй"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-10">
        {Array.from(grouped.entries()).map(([cls, list]) => (
          <ClassTable
            key={cls}
            className={cls}
            users={list}
            search={search}
            filter={filter}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Class table ─────────────── */
function ClassTable({
  className,
  users,
  search,
  filter,
}: {
  className: string;
  users: Row[];
  search: string;
  filter: "all" | "paid" | "unpaid";
}) {
  const filtered = users.filter((u) => {
    if (filter === "paid" && !u.paid) return false;
    if (filter === "unpaid" && u.paid) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(needle) ||
      u.email.toLowerCase().includes(needle)
    );
  });

  const paidCount = users.filter((u) => u.paid).length;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-black/10 bg-cream/60">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl">{className}</h2>
          <span className="text-xs text-black/50">
            {users.length} төгсөгч
          </span>
        </div>
        <div className="text-sm">
          <span className="text-emerald-700 font-semibold">{paidCount}</span>
          <span className="text-black/40"> / {users.length} төлсөн</span>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center text-black/40 text-sm">
          Тохирох төгсөгч олдсонгүй.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-black/50 border-b border-black/10">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Нэр</th>
                <th className="px-5 py-3">И-мэйл</th>
                <th className="px-5 py-3 text-right">Дүн</th>
                <th className="px-5 py-3">Сүүлд төлсөн</th>
                <th className="px-5 py-3">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const date = u.lastDonatedAt
                  ? new Date(u.lastDonatedAt)
                  : null;
                return (
                  <tr
                    key={u.uid}
                    className="border-b border-black/5 hover:bg-cream/40 transition"
                  >
                    <td className="px-5 py-3 text-black/40">{i + 1}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/profiles/${u.uid}`}
                        className="font-medium hover:text-wine hover:underline"
                      >
                        {u.displayName || "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-black/60">
                      {u.email || "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {u.totalDonated
                        ? `${u.totalDonated.toLocaleString()}₮`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-black/60">
                      {date
                        ? date.toLocaleDateString("mn-MN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {u.paid ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          Төлсөн
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-700/80 text-xs font-semibold">
                          <XCircle className="w-4 h-4" />
                          Төлөөгүй
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-black/50">
        {icon}
        {label}
      </div>
      <div className="font-display text-3xl mt-2">{value}</div>
      {hint && <div className="text-xs text-black/40 mt-1">{hint}</div>}
    </div>
  );
}

function exportCsv(grouped: Map<string, Row[]>) {
  const rows: string[] = ["Курс,Нэр,И-мэйл,Дүн,Сүүлд төлсөн,Төлөв"];
  for (const [cls, list] of grouped.entries()) {
    for (const u of list) {
      const date = u.lastDonatedAt ? new Date(u.lastDonatedAt) : null;
      const cells = [
        cls,
        u.displayName,
        u.email,
        u.totalDonated.toString(),
        date ? date.toISOString().slice(0, 10) : "",
        u.paid ? "Төлсөн" : "Төлөөгүй",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      rows.push(cells.join(","));
    }
  }
  const blob = new Blob(["﻿" + rows.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fund-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
