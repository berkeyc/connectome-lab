import type { Metadata } from "next";
import CustomTraining from "@/components/CustomTraining";

export const metadata: Metadata = { title: "Shared experiment", robots: { index: false } };

export default function CustomPage() {
  return (
    <div className="wrap">
      <CustomTraining />
    </div>
  );
}
