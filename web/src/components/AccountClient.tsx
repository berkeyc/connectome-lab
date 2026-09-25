"use client";
// Sign in with a one time email link (no passwords stored anywhere), see and
// manage saved training runs and community submissions.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/account/client";
import { useAccount } from "@/lib/account/useAccount";
import { runLabel, type RunRecord } from "@/lib/training/runs";
import { getTask } from "@/lib/training/tasks";

type Submission = { id: string; title: string; status: string; created_at: string };

export default function AccountClient() {
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);

  useEffect(() => {
    if (!account.user) return;
    let alive = true;
    account.listRuns().then((r) => alive && setRuns(r)).catch((e) => alive && setMsg(String(e.message ?? e)));
    supabase()
      ?.from("community_experiments")
      .select("id,title,status,created_at")
      .eq("user_id", account.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => alive && setSubs((data as Submission[]) ?? []));
    return () => {
      alive = false;
    };
  }, [account]);

  if (!account.enabled) {
    return (
      <div className="panel block prose">
        <h3>Accounts are not switched on for this copy of the site</h3>
        <p>
          Everything works without an account: training runs are saved in your browser and can be exported as files. To turn
          accounts on for your own deployment, create a Supabase project, apply <code>supabase/migrations</code>, and set
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      </div>
    );
  }
  if (!account.ready) return <div className="panel block skeleton" style={{ height: 180 }} />;

  if (!account.user) {
    const send = async (e: React.FormEvent) => {
      e.preventDefault();
      const sb = supabase();
      if (!sb) return;
      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) || clean.length > 254) {
        setMsg("Please enter a valid email address.");
        return;
      }
      setBusy(true);
      setMsg(null);
      const { error } = await sb.auth.signInWithOtp({ email: clean, options: { emailRedirectTo: `${window.location.origin}/account` } });
      setBusy(false);
      if (error) setMsg(error.message);
      else setSent(true);
    };
    return (
      <div className="auth-card panel">
        <h2>Sign in or create an account</h2>
        <p className="muted">We email you a one time link. No password to remember, none stored.</p>
        {sent ? (
          <p className="notice">Check your inbox for a sign in link sent to {email}. You can close this tab.</p>
        ) : (
          <form onSubmit={send} className="auth-form">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lab.org" />
            <button className="btn primary" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign in link"}
            </button>
          </form>
        )}
        {msg && <p className="error">{msg}</p>}
        <p className="small faint">An account keeps your training runs across devices and lets you submit experiments to the community gallery.</p>
      </div>
    );
  }

  return (
    <div className="account-grid">
      <section className="panel block">
        <div className="section-row">
          <h3>Your training runs</h3>
          <button className="btn small ghost" onClick={() => void supabase()?.auth.signOut()}>
            Sign out
          </button>
        </div>
        <p className="small muted">Signed in as {account.user.email}</p>
        {runs.length === 0 ? (
          <p className="muted">No runs saved to your account yet. <Link href="/train">Train a connectome</Link> and press Save run.</p>
        ) : (
          <ul className="run-list">
            {runs.map((r) => (
              <li key={r.id}>
                <span>
                  <b>{getTask(r.taskId)?.title ?? r.taskId}</b>
                  <br />
                  <span className="small muted">{runLabel(r)}</span>
                </span>
                <span className="faint small">{new Date(r.updatedAt).toLocaleDateString()}</span>
                <Link className="btn small" href={`/train/${encodeURIComponent(r.taskId)}`}>
                  Open task
                </Link>
                <span />
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="error">{msg}</p>}
      </section>
      <section className="panel block">
        <h3>Your community submissions</h3>
        {subs.length === 0 ? (
          <p className="muted">
            Nothing submitted yet. Build an experiment in the <Link href="/community/new">experiment builder</Link>.
          </p>
        ) : (
          <ul className="run-list">
            {subs.map((s) => (
              <li key={s.id}>
                <span>{s.title}</span>
                <span className={`pill ${s.status === "published" ? "real" : "planned"}`}>{s.status}</span>
                <span className="faint small">{new Date(s.created_at).toLocaleDateString()}</span>
                <span />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
