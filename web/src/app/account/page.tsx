import type { Metadata } from "next";
import AccountClient from "@/components/AccountClient";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="wrap narrow">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Your lab notebook</h1>
        </div>
      </header>
      <AccountClient />
    </div>
  );
}
