import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap narrow">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">404</div>
          <h1>This page is not in the connectome</h1>
          <p className="lede">The link may be old, or the dataset may have moved. These still work:</p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn primary" href="/experiments">
              Experiments
            </Link>
            <Link className="btn" href="/train">
              Train
            </Link>
            <Link className="btn" href="/">
              Home
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
