import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { aiEnabled, aiFailureSimulationAllowed } from "@/features/translator/ai/client";
import { SimulationBanner } from "@/features/translator/ui/simulation-banner";
import { SyntheticBanner } from "@/features/translator/ui/synthetic-banner";
import { TranslatorSession } from "@/features/translator/ui/translator-session";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Data Axle Translator" };

export default async function TranslatorPage({ searchParams }: { searchParams: Promise<{ aiFail?: string | string[] }> }) {
  await requireAdmin();
  // TR-50 test mode: `?aiFail=1` makes every chat message fail, never in production. Read here,
  // so the environment stays in ai/client.ts; the flag carries no data.
  const { aiFail } = await searchParams;
  const simulateAiFailure = aiFailureSimulationAllowed() && aiFail === "1";

  return (
    <AdminPage
      title="Data Axle Translator"
      description="Turn a spreadsheet of business contacts into a ranked, explained shortlist. The workbook stays in your browser and is never uploaded."
    >
      <div className="flex flex-col gap-6">
        {/* Outside the session, so it stays on every step and through Start over. */}
        <SyntheticBanner />
        {simulateAiFailure && <SimulationBanner />}
        {/* Read on the server (only ai/client.ts reads the environment); the UI gets booleans. */}
        <TranslatorSession aiEnabled={aiEnabled()} simulateAiFailure={simulateAiFailure} />
      </div>
    </AdminPage>
  );
}
