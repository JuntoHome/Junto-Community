import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { getProfilePreview } from "@/features/profiles/admin-queries";
import { ProfileArticle } from "@/features/profiles/profile-article";
import { missingPublishFields, PROFILE_LABELS } from "@/features/profiles/schema";
import { requireAdmin } from "@/lib/auth";
import { getPage } from "@/lib/content";
import { formatDateTime, timeAgo } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const preview = await getProfilePreview((await params).id);
  return { title: preview ? `Preview: ${preview.name}` : "Profile not found" };
}

const list = new Intl.ListFormat("en-US", { type: "conjunction" });

/** A profile exactly as visitors will see it, drafts included, under a notice that it's a preview. */
export default async function ProfilePreviewPage({ params }: Props) {
  await requireAdmin();
  const [preview, page] = await Promise.all([getProfilePreview((await params).id), getPage("whoCanHelp")]);
  if (!preview) notFound();

  const draft = preview.status === "draft";
  const missing = draft ? missingPublishFields(preview.values) : [];

  return (
    <>
      <aside aria-label="Preview" className="bg-navy-deep text-white">
        <Container className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-semibold">
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold tracking-[0.06em] text-navy-deep uppercase">
                Preview
              </span>{" "}
              {draft
                ? "This draft isn't on the public site. Visitors will see this page once it's published."
                : "This profile is published, so visitors see this page now."}
            </p>
            <p className="text-[15px] text-mist">
              Showing the version saved{" "}
              <time dateTime={preview.updatedAt} title={formatDateTime(preview.updatedAt)}>
                {timeAgo(preview.updatedAt, new Date())}
              </time>
              . To see new changes, save them in the editor, then refresh this page.
            </p>
            {missing.length > 0 && (
              <p className="text-[15px] font-semibold text-gold-light">
                Still needed before publishing: {list.format(missing.map((field) => PROFILE_LABELS[field]))}.
              </p>
            )}
          </div>
          <ButtonLink
            href={`/admin/profiles/${preview.id}`}
            variant="gold"
            size="sm"
            className="shrink-0 self-start md:self-auto"
          >
            Edit this profile
          </ButtonLink>
        </Container>
      </aside>
      <ProfileArticle profile={preview.page} page={page} />
    </>
  );
}
