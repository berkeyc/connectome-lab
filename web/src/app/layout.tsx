import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import Sigil from "@/components/Sigil";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://connectome-lab-gamma.vercel.app"),
  openGraph: { siteName: "Connectome Lab", type: "website" },
  title: { default: "Connectome Lab", template: "%s · Connectome Lab" },
  description:
    "Run experiments on real connectomes in your browser: a fly brain drives a car and parks it, a worm backs away from walls and searches for food. Open library of mapped nervous systems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <Sigil id="connectome-lab" size={28} />
              <span>Connectome Lab</span>
            </Link>
            <nav className="nav">
              <Link href="/experiments">Experiments</Link>
              <Link href="/#library">Library</Link>
              <Link href="/lab/c-elegans">Lab</Link>
              <Link href="/about">Method</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>Connectome Lab · open source under the MIT licence</span>
            <span>Data belongs to its original authors. Every species page lists what to cite.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
