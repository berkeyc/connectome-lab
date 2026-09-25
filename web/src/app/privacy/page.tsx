import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="wrap narrow">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">Privacy</div>
          <h1>What this site keeps about you</h1>
        </div>
      </header>
      <div className="prose">
        <p>
          <b>Without an account:</b> nothing leaves your browser. Simulations and training run on your own computer. Saved
          training runs live in your browser&apos;s local storage until you delete them. There are no analytics or advertising
          trackers.
        </p>
        <p>
          <b>With an account:</b> we store your email address (to send sign in links), the training runs you choose to save,
          and the experiments you submit to the community. Runs are private unless you make them public; submissions are
          reviewed before anyone else can see them. Accounts are hosted on Supabase.
        </p>
        <p>
          <b>Local runner:</b> it listens only on your own computer (127.0.0.1) and accepts connections only from this site
          and from localhost.
        </p>
        <p>
          <b>Community projects</b> open on their authors&apos; own websites, which have their own privacy terms.
        </p>
        <p>
          To delete your account and everything stored with it, open an issue on{" "}
          <a href="https://github.com/berkeyc/connectome-lab/issues">GitHub</a> or write to the maintainer listed there.
        </p>
      </div>
    </div>
  );
}
