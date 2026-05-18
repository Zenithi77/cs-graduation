"use client";
import Link from "next/link";
import { Menu, X, GraduationCap, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/constants";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Нүүр" },
  { href: "/profiles", label: "Төгсөгчид" },
  { href: "/fund", label: "Хураамж" },
  { href: "/photos", label: "Зургийн булан" },
  { href: "/logos", label: "Лого сонголт" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 backdrop-blur bg-cream/80 border-b border-black/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl tracking-tight">
            <span className="shimmer">{SITE_NAME}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-wine transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href={`/profiles/${user.uid}`}
                  className="text-sm hover:underline"
                >
                  {user.displayName || "Профайл"}
                </Link>
                <button
                  onClick={() => logout()}
                  className="btn btn-ghost text-sm"
                >
                  Гарах
                </button>
              </>
            ) : (
              <Link href="/login" className="btn btn-ghost text-sm">
                Нэвтрэх
              </Link>
            )}
          </div>

          <button
            className="md:hidden btn btn-ghost text-sm p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Цэс"
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile side drawer — rendered OUTSIDE <header> so backdrop-filter
          there doesn't trap our `fixed` positioning inside it. */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-500 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* Backdrop with blur */}
        <div
          className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          onClick={close}
        />

        {/* Drawer panel */}
        <aside
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm
            bg-gradient-to-br from-cream via-cream to-[#EFE4D0]
            shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.35)]
            transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
            ${open ? "translate-x-0" : "translate-x-full"}
            overflow-hidden`}
          role="dialog"
          aria-modal="true"
        >
          {/* Decorative gold edge */}
          <div className="absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-transparent via-gold to-transparent opacity-70" />

          {/* Decorative blurred wine glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-wine/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-gold/15 blur-3xl" />

          {/* Header */}
          <div className="relative h-20 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-wine" strokeWidth={1.5} />
              <span className="font-display italic text-wine tracking-wide">
                {SITE_NAME}
              </span>
            </div>
            <button
              onClick={close}
              className="rounded-full w-9 h-9 flex items-center justify-center
                border border-black/10 bg-cream/60 hover:bg-cream
                hover:border-wine/40 transition"
              aria-label="Хаах"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Ornament divider */}
          <div className="px-6">
            <div className="flex items-center gap-3 text-gold">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/50" />
              <span className="text-[10px] tracking-[0.4em]">⁕</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/50" />
            </div>
          </div>

          {/* Links */}
          <nav className="relative px-6 mt-8 flex flex-col">
            {links.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                style={{
                  transitionDelay: open ? `${120 + i * 60}ms` : "0ms",
                }}
                className={`group relative py-3 flex items-center justify-between
                  font-display text-2xl text-ink/90 hover:text-wine
                  border-b border-black/5
                  transition-all duration-500
                  ${open ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`}
              >
                <span className="relative">
                  {l.label}
                  <span className="absolute left-0 -bottom-0.5 h-[2px] w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                </span>
                <ArrowUpRight
                  className="w-4 h-4 text-black/30 group-hover:text-wine
                    group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition"
                  strokeWidth={1.5}
                />
              </Link>
            ))}
          </nav>

          {/* Auth section pinned bottom */}
          <div
            className={`absolute bottom-0 left-0 right-0 px-6 pb-8 pt-6
              transition-all duration-500
              ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: open ? "420ms" : "0ms" }}
          >
            <div className="flex items-center gap-3 text-gold mb-5">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
              <span className="text-[10px] tracking-[0.4em] uppercase text-black/40">
                Профайл
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
            </div>

            {user ? (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/profiles/${user.uid}`}
                  onClick={close}
                  className="btn btn-ghost text-sm justify-center"
                >
                  {user.displayName || "Миний профайл"}
                </Link>
                <button
                  onClick={() => {
                    close();
                    logout();
                  }}
                  className="text-xs uppercase tracking-[0.3em] text-black/50 hover:text-wine py-2 transition"
                >
                  Гарах
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={close}
                className="btn btn-ghost text-sm justify-center w-full"
              >
                Нэвтрэх
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
