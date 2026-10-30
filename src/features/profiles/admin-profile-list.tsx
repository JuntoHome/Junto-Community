import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ProfileStatus, ProfileSummary } from "./admin-queries";
import { PROFILES_PATH } from "./queries";

// Admins work in Arizona (no daylight saving), like the subscribe notifications.
const updatedFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Phoenix",
});

const statusLabels: Record<ProfileStatus, string> = { published: "Published", draft: "Draft" };

function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
        status === "published" ? "bg-sage text-green" : "bg-parchment text-parchment-text",
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

const editPath = (profile: ProfileSummary) => `/admin/profiles/${profile.id}`;

function NameLink({ profile }: { profile: ProfileSummary }) {
  return (
    <Link href={editPath(profile)} className="font-serif text-lg font-bold underline-offset-4 hover:underline">
      {profile.name}
    </Link>
  );
}

function Address({ slug }: { slug: string }) {
  return <span className="block text-sm text-subtle wrap-anywhere">{`${PROFILES_PATH}/${slug}`}</span>;
}

function Updated({ profile, adminEmail }: { profile: ProfileSummary; adminEmail: string }) {
  const by = profile.updatedBy === adminEmail ? "you" : profile.updatedBy;
  return (
    <>
      <time dateTime={profile.updatedAt}>{updatedFormat.format(new Date(profile.updatedAt))}</time>
      {by && <span className="block text-sm text-subtle wrap-anywhere">by {by}</span>}
    </>
  );
}

/** Edit, and View on site once published. The name links to the edit page too; this makes it obvious. */
function Actions({ profile, className }: { profile: ProfileSummary; className?: string }) {
  return (
    <div className={cn("flex gap-5 text-[15px] font-semibold whitespace-nowrap", className)}>
      <Link href={editPath(profile)}>
        Edit<span className="sr-only"> {profile.name}</span>
      </Link>
      {profile.status === "published" && (
        <a href={`${PROFILES_PATH}/${profile.slug}`} target="_blank" rel="noopener noreferrer">
          View<span className="sr-only"> {profile.name}</span> on site <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

/** Every profile with its status and last change. */
export function AdminProfileList({ profiles, adminEmail }: { profiles: ProfileSummary[]; adminEmail: string }) {
  return (
    <div className="rounded-[18px] border border-sand bg-white px-5 md:px-6">
      {/* Phones: one block per profile. */}
      <ul className="divide-y divide-sand md:hidden">
        {profiles.map((profile) => (
          <li key={profile.id} className="flex flex-col gap-1.5 py-4">
            <div className="flex items-start justify-between gap-3">
              <NameLink profile={profile} />
              <StatusBadge status={profile.status} />
            </div>
            <Address slug={profile.slug} />
            <p className="text-[15px] text-slate">
              Updated <Updated profile={profile} adminEmail={adminEmail} />
            </p>
            <Actions profile={profile} className="pt-1" />
          </li>
        ))}
      </ul>

      {/* Tablets and up: a table. */}
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">Profiles</caption>
        <thead className="border-b border-sand text-sm font-bold tracking-[0.08em] text-slate uppercase">
          <tr>
            <th scope="col" className="py-4 pr-4">
              Name
            </th>
            <th scope="col" className="py-4 pr-4">
              Status
            </th>
            <th scope="col" className="py-4 pr-4">
              Last updated
            </th>
            <th scope="col" className="py-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {profiles.map((profile) => (
            <tr key={profile.id} className="align-top">
              <th scope="row" className="py-4 pr-4 font-normal">
                <NameLink profile={profile} />
                <Address slug={profile.slug} />
              </th>
              <td className="py-4 pr-4">
                <StatusBadge status={profile.status} />
              </td>
              <td className="py-4 pr-4 text-[15px] text-slate">
                <Updated profile={profile} adminEmail={adminEmail} />
              </td>
              <td className="py-4">
                <Actions profile={profile} className="justify-end" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
