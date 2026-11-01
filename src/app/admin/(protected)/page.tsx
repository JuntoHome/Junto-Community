import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { editPath, NoProfilesYet, StatusBadge } from "@/features/profiles/admin-profile-list";
import { listProfilesForAdmin, type ProfileSummary } from "@/features/profiles/admin-queries";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { type Admin, requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getPage } from "@/lib/content";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

const RECENT_COUNT = 5;

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Phoenix" }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const tones = { green: "bg-sage text-green", gold: "bg-parchment text-gold-text", navy: "bg-mist text-navy" };

function StatCard({
  label,
  icon,
  tone,
  children,
  footer,
}: {
  label: string;
  icon: IconName;
  tone: keyof typeof tones;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-sand bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-[0.08em] text-slate uppercase">{label}</h2>
        <span className={cn("flex size-10 items-center justify-center rounded-full", tones[tone])}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="mt-2 flex-1">{children}</div>
      {footer && <div className="mt-4 border-t border-sand pt-4 text-sm text-muted">{footer}</div>}
    </section>
  );
}

function UpdatedBy({ profile, admin, now }: { profile: ProfileSummary; admin: Admin; now: Date }) {
  const by = profile.updatedBy === admin.email ? "you" : profile.updatedBy;
  return (
    <>
      <time dateTime={profile.updatedAt} title={formatDateTime(profile.updatedAt)}>
        {timeAgo(profile.updatedAt, now)}
      </time>
      {by && <> · by {by}</>}
    </>
  );
}

const steps = [
  { title: "Add a profile", text: "Save it as a draft at any point. Drafts stay private." },
  { title: "Fill in the essentials", text: "Everything marked “Needed to publish” has to be filled in first." },
  { title: "Publish", text: "It appears on the public site within a minute, and you can hide it again at any time." },
];

export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const [profiles, page] = await Promise.all([listProfilesForAdmin(), getPage("whoCanHelp")]);
  const now = new Date();

  const published = profiles.filter((profile) => profile.status === "published").length;
  const drafts = profiles.length - published;
  const recent = profiles.toSorted((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, RECENT_COUNT);
  const latest = recent[0];

  return (
    <AdminPage
      eyebrow="Admin home"
      title={greeting(now)}
      description={`Here's where the ${page.heading} profiles stand.`}
      actions={
        <ButtonLink href="/admin/profiles/new" size="sm">
          <Icon name="plus" size={18} />
          Add a profile
        </ButtonLink>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard
          label="Published"
          icon="globe"
          tone="green"
          footer={
            <a href={PROFILES_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold">
              See the public page <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          }
        >
          <p className="font-serif text-5xl font-bold text-navy">{published}</p>
        </StatCard>
        <StatCard
          label={drafts === 1 ? "Draft" : "Drafts"}
          icon="pencil"
          tone="gold"
          footer="Only admins can see drafts."
        >
          <p className="font-serif text-5xl font-bold text-navy">{drafts}</p>
        </StatCard>
        <StatCard label="Last edited" icon="clock" tone="navy">
          {latest ? (
            <>
              <Link href={editPath(latest)} className="font-serif text-xl leading-snug font-bold">
                {latest.name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                <UpdatedBy profile={latest} admin={admin} now={now} />
              </p>
            </>
          ) : (
            <p className="mt-2 text-base text-muted">Nothing yet.</p>
          )}
        </StatCard>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="rounded-[18px] border border-sand bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-sand px-6 py-4">
            <h2 className="font-serif text-xl font-bold text-navy">Recently updated</h2>
            {recent.length > 0 && (
              <Link href="/admin/profiles" className="text-[15px] font-semibold">
                All profiles <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          {recent.length > 0 ? (
            <ul className="divide-y divide-sand px-6">
              {recent.map((profile) => (
                <li key={profile.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={editPath(profile)} className="block font-semibold">
                      {profile.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-subtle">
                      <UpdatedBy profile={profile} admin={admin} now={now} />
                    </p>
                  </div>
                  <StatusBadge status={profile.status} />
                </li>
              ))}
            </ul>
          ) : (
            <NoProfilesYet />
          )}
        </section>

        <section className="rounded-[18px] bg-navy-deep p-6 text-white">
          <h2 className="font-serif text-xl font-bold">How profiles work</h2>
          <ol className="mt-5 flex flex-col gap-5">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-navy-deep">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm text-fog">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AdminPage>
  );
}
