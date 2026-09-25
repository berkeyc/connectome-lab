import type { Metadata } from "next";
import CommunityGrid from "@/components/CommunityGrid";
import UserExperiments from "@/components/UserExperiments";

export const metadata: Metadata = {
  title: "Community",
  description: "Connectome experiments from around the web, credited to their authors with links to their code, and experiments built by Connectome Lab users.",
};

export default function CommunityPage() {
  return (
    <div className="wrap">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">Community</div>
          <h1>Everyone&apos;s connectome experiments</h1>
          <p className="lede">
            In 2026 people wired fly connectomes into games, cars and robot bodies. Here they are with their authors, their
            code and, where it matters, what the method can and cannot show. Below them: experiments built on this site.
          </p>
        </div>
      </header>
      <UserExperiments />
      <div style={{ marginTop: 48 }}>
        <CommunityGrid />
      </div>
    </div>
  );
}
