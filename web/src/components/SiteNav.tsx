"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/lib/account/useAccount";

const LINKS = [
  { href: "/experiments", label: "Experiments" },
  { href: "/train", label: "Train" },
  { href: "/community", label: "Community" },
  { href: "/#library", label: "Library", match: "/species" },
  { href: "/about", label: "Method" },
];

export default function SiteNav() {
  const path = usePathname() ?? "/";
  const account = useAccount();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => {
        const active = path.startsWith(l.match ?? l.href) && l.href !== "/";
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
      {account.enabled && (
        <Link href="/account" className="nav-account" aria-current={path.startsWith("/account") ? "page" : undefined}>
          {account.user ? "Account" : "Sign in"}
        </Link>
      )}
    </nav>
  );
}
