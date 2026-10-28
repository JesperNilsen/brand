import type { Metadata } from "next";
import { OrthographyView } from "@/components/OrthographyView";

export const metadata: Metadata = { title: "Rettskrivning" };

export default function OrthographyPage() {
  return <OrthographyView />;
}
