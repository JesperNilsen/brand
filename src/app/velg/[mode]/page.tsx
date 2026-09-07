import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChooseView } from "@/components/ChooseView";
import { getGameMode } from "@/domain/modes/registry";

export default async function ChoosePage(props: PageProps<"/velg/[mode]">) {
  const { mode } = await props.params;
  const def = getGameMode(mode);
  // A mode without a chooser has no page here — Drill exists so a reader can
  // start without choosing, and a /velg/drill would be that undone.
  if (!def || !def.availableInV1 || !def.hasChooser) notFound();
  return (
    <Suspense fallback={null}>
      <ChooseView modeId={def.id} />
    </Suspense>
  );
}
