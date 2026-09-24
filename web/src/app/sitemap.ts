import type { MetadataRoute } from "next";
import { getLibrary } from "@/lib/data";
import { EXPERIMENTS } from "@/lib/experiments/catalog";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://connectome-lab-gamma.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lib = await getLibrary();
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, priority: 1 },
    { url: `${SITE}/experiments`, lastModified: now, priority: 0.9 },
    ...EXPERIMENTS.map((e) => ({ url: `${SITE}/experiments/${e.id}`, lastModified: now, priority: 0.8 })),
    ...lib.filter((s) => s.status !== "planned").map((s) => ({ url: `${SITE}/species/${s.id}`, lastModified: now, priority: 0.6 })),
    ...lib.filter((s) => s.available).map((s) => ({ url: `${SITE}/lab/${s.id}`, lastModified: now, priority: 0.6 })),
    { url: `${SITE}/about`, lastModified: now, priority: 0.4 },
  ];
}
