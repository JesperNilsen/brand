import { ResultView } from "@/components/ResultView";

export default async function ResultPage(props: PageProps<"/resultat/[id]">) {
  const { id } = await props.params;
  return <ResultView id={id} />;
}
