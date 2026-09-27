import type { Metadata } from "next";
import RenderStage from "@/components/RenderStage";

// Frame by frame renderer for preview clips (scripts/capture-thumbs.mjs). Not part of the site's navigation.
export const metadata: Metadata = { title: "Render", robots: { index: false, follow: false } };

export default async function RenderPage(props: PageProps<"/render/[id]">) {
  const { id } = await props.params;
  return <RenderStage id={id} />;
}
