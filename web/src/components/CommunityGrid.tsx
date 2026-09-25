"use client";
import Link from "next/link";
import { COMMUNITY, COMMUNITY_KINDS, COMMUNITY_SOURCE, type CommunityKind } from "@/lib/community";

// Third party demos open in their own window without a reference back to this
// page (noopener), so they can never script or redirect our tab.
function openPopup(url: string, title: string) {
  const w = Math.min(1400, window.screen.availWidth - 80);
  const h = Math.min(900, window.screen.availHeight - 80);
  const left = Math.max(0, (window.screen.availWidth - w) / 2);
  const top = Math.max(0, (window.screen.availHeight - h) / 2);
  window.open(url, title.replace(/\W+/g, "_"), `popup=yes,noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`);
}

export default function CommunityGrid({ kinds }: { kinds?: CommunityKind[] }) {
  const groups = COMMUNITY_KINDS.filter((k) => !kinds || kinds.includes(k.id));
  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="community-group">
          <div className="section-row">
            <h3>{g.title}</h3>
            <span className="small muted">{g.blurb}</span>
          </div>
          <div className="community">
            {COMMUNITY.filter((c) => c.kind === g.id).map((c) => (
              <article key={c.repo} className="community-card">
                <div className="community-by">{c.author}</div>
                <h4>{c.title}</h4>
                <p>{c.what}</p>
                <p className="small faint">{c.brain}</p>
                {c.note && <p className="community-note">{c.note}</p>}
                <div className="row" style={{ marginTop: "auto" }}>
                  {c.demo && g.id === "play" && (
                    <button className="btn small primary" onClick={() => openPopup(c.demo!, c.title)}>
                      Play in a new window
                    </button>
                  )}
                  <a className="btn small" href={c.repo} target="_blank" rel="noopener noreferrer">
                    {c.kind === "video" ? "Original post" : c.repo.includes("github.com") ? "Source" : "Website"}
                  </a>
                  {c.ours && (
                    <Link className="btn small ghost" href={c.ours.href}>
                      {c.ours.label} →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="small faint" style={{ marginTop: 12 }}>
        Collected from <a href={COMMUNITY_SOURCE.url}>{COMMUNITY_SOURCE.label}</a> and the 2026 coverage. These projects belong to their
        authors, under their own licences, and open on their own sites. Connectome Lab links to them and does not host or modify their code.
      </p>
    </>
  );
}
