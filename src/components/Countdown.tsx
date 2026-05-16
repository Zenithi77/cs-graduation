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

function Cell({ v, l }: { v: number; l: string }) {
  const text = String(v).padStart(2, "0");
  return (
    <div className="cd-cell text-center">
      <div className="font-display text-4xl md:text-6xl text-ink leading-none [perspective:600px]">
        {/* key on text triggers the flip animation each tick */}
        <span key={text} className="cd-num">{text}</span>
      </div>
      <div className="mt-2 text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-black/55">
        {l}
      </div>
    </div>
  );
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

  return (
    <div className="text-center relative">
      <div className="text-[11px] md:text-sm uppercase tracking-[0.4em] text-black/50">
        {GRADUATION_LABEL}
      </div>
      <h2 className="font-display text-3xl md:text-5xl mt-3 inline-flex items-center justify-center gap-3">
        {t.done ? (
          <>
            Бид төгслөө
            <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-gold" aria-hidden />
          </>
        ) : (
          <>Төгсөлт хүртэл <span className="gold-text">үлдсэн</span></>
        )}
      </h2>

      {!t.done && (
        <div
          className="mt-8 flex items-center justify-center gap-2 md:gap-4 flex-wrap"
          suppressHydrationWarning
        >
          <Cell v={t.days} l="өдөр" />
          <span className="cd-colon hidden sm:inline">:</span>
          <Cell v={t.hours} l="цаг" />
          <span className="cd-colon hidden sm:inline">:</span>
          <Cell v={t.minutes} l="мин" />
          <span className="cd-colon hidden sm:inline">:</span>
          <Cell v={t.seconds} l="сек" />
        </div>
      )}
    </div>
  );
}
