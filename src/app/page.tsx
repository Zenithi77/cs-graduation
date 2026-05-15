import Link from "next/link";
import { HandCoins, Camera, Shirt, type LucideIcon } from "lucide-react";
import Countdown from "@/components/Countdown";

const sections: {
  href: string;
  title: string;
  sub: string;
  Icon: LucideIcon;
}[] = [
  {
    href: "/fund",
    title: "Хураамж",
    sub: "1–4-р курсынхний 5-р курсын төгсөлтөд төлөх хураамжийн бүртгэл",
    Icon: HandCoins,
  },
  {
    href: "/photos",
    title: "Зургийн булан",
    sub: "Үйл ажиллагааны дурсамжит хором",
    Icon: Camera,
  },
  {
    href: "/logos",
    title: "Лого сонголт",
    sub: "Футболкан дээр тавих логогоо санал асуулгаар сонгоё",
    Icon: Shirt,
  },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 pb-24">
      {/* Hero */}
      <section className="text-center">
        <p className="font-display italic text-wine">— Таван жилийн аян —</p>
        <h1 className="font-display text-5xl md:text-7xl mt-2 leading-tight">
          Бидний <span className="shimmer">төгсөлт</span>
        </h1>
        <p className="mt-4 text-black/70 max-w-xl mx-auto">
          Компьютерийн ухааны 5-р курсын төгсөгчдийн дурсамж, дүү нараас төлөх төгсөлтийн
          хураамжийн бүртгэл, захидал.
        </p>

        <div className="mt-10">
          <Countdown />
        </div>

        <div className="mt-10 flex justify-center gap-3 flex-wrap">
          <Link href="/profiles" className="btn btn-primary">Төгсөгчид</Link>
          <Link href="/fund" className="btn btn-gold">Хураамж төлөх</Link>
          <Link href="/logos" className="btn btn-ghost">Лого санал өгөх</Link>
        </div>
      </section>

      {/* Three sections */}
      <section className="mt-24">
        <div className="grid md:grid-cols-3 gap-6">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="card p-6 hover:-translate-y-1 transition group"
            >
              <s.Icon className="w-9 h-9 text-wine" strokeWidth={1.5} aria-hidden />
              <h3 className="font-display text-2xl mt-3 group-hover:text-wine">{s.title}</h3>
              <p className="text-sm text-black/60 mt-2">{s.sub}</p>
              <div className="mt-4 text-xs uppercase tracking-widest text-gold">Орох →</div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
