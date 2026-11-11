import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { SyntheticBanner } from "@/features/translator/ui/synthetic-banner";
import { TranslatorWizard } from "@/features/translator/ui/translator-wizard";
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
        <SyntheticBanner />
        <TranslatorWizard />
      </div>
    </AdminPage>
  );
}
