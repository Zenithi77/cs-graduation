import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Компьютерийн ухааны төгсөгчдийн дурсамжийн вэб",
};

// All pages depend on Firebase auth/firestore at runtime — skip static prerender.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="text-center py-10 text-sm text-black/50">
            © 2026 · CS төгсөгчид · Дурсамж үлдээе
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
