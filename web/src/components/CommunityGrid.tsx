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

/** A small picture for each kind of project, drawn in the site's own line style. */
function KindGlyph({ kind }: { kind: CommunityKind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className={`kind-glyph kind-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22">
        {kind === "play" && (
          <>
            <rect x="3" y="7" width="18" height="11" rx="4" {...common} />
            <path d="M8 10.5v4M6 12.5h4" {...common} />
            <circle cx="16" cy="11.5" r="1" fill="currentColor" />
            <circle cx="17.5" cy="14" r="1" fill="currentColor" />
          </>
        )}
        {kind === "video" && (
          <>
            <rect x="3" y="5" width="18" height="14" rx="3" {...common} />
            <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" />
          </>
        )}
        {kind === "games" && (
          <>
            <rect x="4" y="4" width="16" height="16" rx="3" {...common} />
            <circle cx="9" cy="9" r="1.2" fill="currentColor" />
            <circle cx="15" cy="15" r="1.2" fill="currentColor" />
            <circle cx="15" cy="9" r="1.2" fill="currentColor" />
            <circle cx="9" cy="15" r="1.2" fill="currentColor" />
          </>
        )}
        {kind === "tools" && (
          <>
            <circle cx="6" cy="12" r="2.2" {...common} />
            <circle cx="18" cy="6" r="2.2" {...common} />
            <circle cx="18" cy="18" r="2.2" {...common} />
            <path d="M8 11l8-4M8 13l8 4" {...common} />
          </>
        )}
        {kind === "data" && (
          <>
            <ellipse cx="12" cy="6" rx="7" ry="2.6" {...common} />
            <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" {...common} />
          </>
        )}
      </svg>
    </span>
  );
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
                <div className="community-by">
                  <KindGlyph kind={c.kind} />
                  {c.author}
                </div>
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
