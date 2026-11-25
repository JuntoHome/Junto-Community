import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { aiEnabled } from "@/features/translator/ai/client";
import { SyntheticBanner } from "@/features/translator/ui/synthetic-banner";
import { TranslatorSession } from "@/features/translator/ui/translator-session";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Data Axle Translator" };

export default async function TranslatorPage() {
  await requireAdmin();

  return (
    <AdminPage
      title="Data Axle Translator"
      description="Turn a spreadsheet of business contacts into a ranked, explained shortlist. The workbook stays in your browser and is never uploaded."
    >
      <div className="flex flex-col gap-6">
        {/* Outside the session, so it stays on every step and through Start over. */}
        <SyntheticBanner />
        {/* Read on the server (only ai/client.ts reads the environment); the UI gets a boolean. */}
        <TranslatorSession aiEnabled={aiEnabled()} />
      </div>
    </AdminPage>
  );
}
