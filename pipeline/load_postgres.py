"""Load every species in the library into PostgreSQL.

    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/connectome
    python pipeline/load_postgres.py                 # all species with data
    python pipeline/load_postgres.py c-elegans       # only some

Recreates the schema, so run it again whenever a species is added or updated.
Works the same against Supabase: use its connection string as DATABASE_URL.
"""

from __future__ import annotations

import io
import json
import os
import sys
import time

import psycopg

from common import LARGE_DIR, ROOT, SPECIES_DIR, list_species

URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/connectome")


def data_dir(species_id: str):
    for base in (SPECIES_DIR / species_id, LARGE_DIR / species_id):
        if (base / "neurons.csv").exists():
            return base
    return None


def copy_csv(cur, table: str, species_id: str, path, cols: list[str]):
    """Stream a CSV into a table, prefixing every row with the species id."""
    with open(path, encoding="utf-8") as f, \
            cur.copy(f"COPY {table} (species_id, {', '.join(cols)}) FROM STDIN "
                     f"WITH (FORMAT csv, NULL '')") as cp:
        header = f.readline()
        assert header.strip().split(",") == cols, f"unexpected header in {path}: {header}"
        buf = io.StringIO()
        for line in f:
            buf.write(f"{species_id},{line}")
            if buf.tell() > 1 << 20:
                cp.write(buf.getvalue())
                buf = io.StringIO()
        cp.write(buf.getvalue())


def main():
    wanted = sys.argv[1:] or list_species()
    t0 = time.time()
    with psycopg.connect(URL) as conn, conn.cursor() as cur:
        cur.execute((ROOT / "db" / "schema.sql").read_text())
        for sid in wanted:
            meta = json.loads((SPECIES_DIR / sid / "species.json").read_text(encoding="utf-8"))
            cur.execute(
                "INSERT INTO species (species_id, common_name, latin_name, status, dataset, "
                "source_url, license, meta) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (sid, meta["common_name"], meta["latin_name"], meta["status"],
                 meta.get("dataset"), meta.get("source_url"), meta.get("license"),
                 json.dumps(meta)))
            for nt, sign in meta.get("sign", {}).items():
                cur.execute("INSERT INTO nt_sign VALUES (%s,%s,%s)", (sid, nt, sign))
            d = data_dir(sid)
            if d is None:
                print(f"{sid}: listed in the library, no data imported yet")
                continue
            copy_csv(cur, "neurons", sid, d / "neurons.csv",
                     ["neuron_id", "super_class", "class", "cell_type", "side",
                      "nt_type", "nt_score"])
            copy_csv(cur, "connections", sid, d / "connections.csv",
                     ["pre_id", "post_id", "region", "syn_type", "syn_count"])
            print(f"{sid}: loaded from {d.relative_to(ROOT)}")
        cur.execute((ROOT / "db" / "views.sql").read_text())
        cur.execute("ANALYZE")
        conn.commit()
        cur.execute("SELECT species_id, neurons, neuron_pairs, synapses FROM species_summary "
                    "ORDER BY species_id")
        for row in cur.fetchall():
            print("  {:<22} {:>8,} neurons {:>10,} pairs {:>12,} synapses".format(*row))
    print(f"done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
