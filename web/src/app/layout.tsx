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
          <div className="wrap">
            <span>Connectome Lab · open source under the MIT licence · <a href="https://github.com/berkeyc/connectome-lab">GitHub</a></span>
            <span>
              Data belongs to its original authors; every species page lists what to cite. <Link href="/privacy">Privacy</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
