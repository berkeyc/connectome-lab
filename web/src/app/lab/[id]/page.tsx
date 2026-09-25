import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LabClient from "@/components/LabClient";
import { getLibrary, getSpecies, getSummary } from "@/lib/data";
import type { SpeciesMeta } from "@/lib/engine/types";

export async function generateStaticParams() {
  const lib = await getLibrary();
  const ids: { id: string }[] = [];
  for (const s of lib) if ((await getSummary(s.id))?.browserSimulation) ids.push({ id: s.id });
  return ids;
}

export async function generateMetadata(props: PageProps<"/lab/[id]">): Promise<Metadata> {
  const s = await getSpecies((await props.params).id);
  return { title: `Lab · ${s?.common_name ?? ""}` };
}

export default async function LabPage(props: PageProps<"/lab/[id]">) {
  const { id } = await props.params;
  const s = await getSpecies(id);
  const summary = await getSummary(id);
  if (!s || !summary?.browserSimulation) notFound();
  const others = (await getLibrary()).filter((x) => x.browser && x.id !== id);

  return (
    <div className="wrap">
      <div className="page-head" style={{ paddingBottom: 8 }}>
        <div>
          <div className="eyebrow">Lab · {s.latin_name}</div>
          <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)", marginTop: 8 }}>{s.common_name}</h1>
        </div>
        <div className="row">
          <Link className="btn small" href={`/species/${id}`}>
            About this dataset
          </Link>
          {others.map((o) => (
            <Link key={o.id} className="btn small" href={`/lab/${o.id}`}>
              Switch to {o.common_name}
            </Link>
          ))}
        </div>
      </div>
      <LabClient meta={s as SpeciesMeta} types={summary.types.map((t) => ({ type: t.type, cls: t.cls, n: t.n }))} />
    </div>
  );
}
