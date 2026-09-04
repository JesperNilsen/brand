import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChooseView } from "@/components/ChooseView";
import { getGameMode } from "@/domain/modes/registry";

export default async function ChoosePage(props: PageProps<"/velg/[mode]">) {
  const { mode } = await props.params;
  const def = getGameMode(mode);
  if (!def || !def.availableInV1) notFound();
  return (
    <Suspense fallback={null}>
      <ChooseView modeId={def.id} />
    </Suspense>
  );
}
