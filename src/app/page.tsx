import { ClaimIntake } from "@/components/claim-intake";
import {
  demoSuggestedAnswer,
  getDemoScenario,
} from "@/lib/demo/scenarios";

type HomeProps = {
  searchParams: Promise<{ demo?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { demo } = await searchParams;
  const scenario = getDemoScenario(demo);

  return (
    <ClaimIntake
      demoScenario={
        scenario
          ? {
              key: scenario.key,
              name: scenario.name,
              expectedCode: scenario.expectedCode,
              summary: scenario.summary,
              rawText: scenario.rawText,
              suggestedAnswer: demoSuggestedAnswer(scenario),
            }
          : null
      }
    />
  );
}
