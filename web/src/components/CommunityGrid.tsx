"use client";
import Link from "next/link";
import { COMMUNITY, COMMUNITY_SOURCE } from "@/lib/community";

const RUNS = { browser: "Plays in the browser", local: "Runs locally", video: "Video and article" } as const;

function openPopup(url: string, title: string) {
  const w = Math.min(1400, window.screen.availWidth - 80);
  const h = Math.min(900, window.screen.availHeight - 80);
  const left = Math.max(0, (window.screen.availWidth - w) / 2);
  const top = Math.max(0, (window.screen.availHeight - h) / 2);
  const win = window.open(url, title.replace(/\W+/g, "_"), `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!win) window.open(url, "_blank", "noopener");
}

export default function CommunityGrid() {
  return (
    <>
      <div className="community">
        {COMMUNITY.map((c) => (
          <article key={c.repo} className="panel community-card">
            <div className="exp-meta">
              <span className={`pill ${c.runs === "browser" ? "real" : "local"}`}>{c.runs === "browser" && !c.demo ? "Browser app, start it yourself" : RUNS[c.runs]}</span>
              <span className="pill">{c.author}</span>
            </div>
            <h3>{c.title}</h3>
            <p>{c.what}</p>
            <p className="small faint">{c.brain}</p>
            <div className="row" style={{ marginTop: "auto" }}>
              {c.demo && (
                <button className="btn small primary" onClick={() => openPopup(c.demo!, c.title)}>
                  Play in a new window
                </button>
              )}
              <a className="btn small" href={c.repo} target="_blank" rel="noopener noreferrer">
                {c.runs === "video" ? "Watch" : "Source"}
              </a>
              {c.ours && (
                <Link className="btn small" href={`/experiments/${c.ours.id}`}>
                  Our version: {c.ours.label}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="small faint" style={{ marginTop: 12 }}>
        Collected from <a href={COMMUNITY_SOURCE.url}>{COMMUNITY_SOURCE.label}</a> and the September 2026 coverage. These projects belong to their
        authors and open on their own sites; Connectome Lab links to them and does not host or modify their code.
      </p>
    </>
  );
}
