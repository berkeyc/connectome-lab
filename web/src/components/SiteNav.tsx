"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "@/lib/account/useAccount";
import { SECTIONS } from "@/lib/site";

export default function SiteNav() {
  const path = usePathname() ?? "/";
  const account = useAccount();
  const [open, setOpen] = useState(false);
  // close the phone menu after navigating
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [path]);
  const active = (href: string, match?: string) => path.startsWith(href) || (match ? path.startsWith(match) : false);
  return (
    <>
      <button className="nav-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
        <span className="sr">Menu</span>
        <span className="nav-toggle-bars" aria-hidden="true" />
      </button>
      <nav id="site-nav" className={`nav ${open ? "open" : ""}`} aria-label="Main">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} aria-current={active(s.href, "match" in s ? s.match : undefined) ? "page" : undefined}>
            <span className="nav-label">{s.label}</span>
            <span className="nav-blurb">{s.blurb}</span>
          </Link>
        ))}
        {account.enabled && (
          <Link href="/account" className="nav-account" aria-current={path.startsWith("/account") ? "page" : undefined}>
            <span className="nav-label">{account.user ? "Account" : "Sign in"}</span>
          </Link>
        )}
      </nav>
    </>
  );
}
