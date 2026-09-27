import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import Sigil from "@/components/Sigil";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://connectome-lab-gamma.vercel.app"),
  openGraph: { siteName: "Connectome Lab", type: "website" },
  title: { default: "Connectome Lab", template: "%s · Connectome Lab" },
  description:
    "Train and test real connectomes in your browser: FlyWire fly circuits and the C. elegans worm drive cars, escape shadows and find food, always next to rewired controls. An open library of mapped nervous systems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <Sigil id="connectome-lab" size={28} />
              <span>Connectome Lab</span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div className="footer-brand">
              <Link href="/" className="brand">
                <Sigil id="connectome-lab" size={24} />
                <span>Connectome Lab</span>
              </Link>
              <p>Real wiring diagrams of flies and worms, running live in your browser, always next to rewired controls.</p>
            </div>
            <nav aria-label="Explore">
              <h4>Explore</h4>
              <Link href="/experiments">Experiments</Link>
              <Link href="/gym">Benchmark</Link>
              <Link href="/train">Train</Link>
              <Link href="/library">Library</Link>
            </nav>
            <nav aria-label="Project">
              <h4>Project</h4>
              <Link href="/about">Method and limits</Link>
              <Link href="/research">Research landscape</Link>
              <Link href="/community">Community</Link>
              <a href="https://github.com/berkeyc/connectome-lab">GitHub</a>
            </nav>
            <div className="footer-note">
              <h4>Data and licences</h4>
              <p>Code under the MIT licence. Data belongs to its original authors; every library page lists what to cite.</p>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
