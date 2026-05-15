"use client";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { GRADUATION_DATE_ISO, GRADUATION_LABEL } from "@/lib/constants";

function diff(target: Date) {
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  const clamp = Math.max(ms, 0);
  const s = Math.floor(clamp / 1000);
  return {
    done: ms <= 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export default function Countdown() {
  const target = new Date(GRADUATION_DATE_ISO);
  const [t, setT] = useState(() => ({
    done: false,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  }));

  useEffect(() => {
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, []);

  const Cell = ({ v, l }: { v: number; l: string }) => (
    <div className="card px-5 py-4 md:px-7 md:py-6 text-center min-w-[78px] md:min-w-[110px] animate-floaty">
      <div className="font-display text-4xl md:text-6xl text-ink leading-none">
        {String(v).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.25em] text-black/60">{l}</div>
    </div>
  );

  return (
    <div className="text-center">
      <div className="text-xs md:text-sm uppercase tracking-[0.3em] text-black/50">{GRADUATION_LABEL}</div>
      <h2 className="font-display text-3xl md:text-5xl mt-2 inline-flex items-center justify-center gap-3">
        {t.done ? (
          <>
            Бид төгслөө
            <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-gold" aria-hidden />
          </>
        ) : (
          "Төгсөлт хүртэл"
        )}
      </h2>

      {!t.done && (
        <div className="mt-7 flex items-center justify-center gap-3 md:gap-5" suppressHydrationWarning>
          <Cell v={t.days} l="өдөр" />
          <Cell v={t.hours} l="цаг" />
          <Cell v={t.minutes} l="мин" />
          <Cell v={t.seconds} l="сек" />
        </div>
      )}
    </div>
  );
}
