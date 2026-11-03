import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { ProfileStatus, ProfileSummary } from "./admin-queries";
import { MoveButtons } from "./move-buttons";
import { PREVIEW_PATH, PROFILES_PATH } from "./queries";

const statusLabels: Record<ProfileStatus, string> = { published: "Published", draft: "Draft" };

export function StatusBadge({ status }: { status: ProfileStatus }) {
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

export const editPath = (profile: ProfileSummary) => `/admin/profiles/${profile.id}`;

/** Shown in place of the profiles until the first one is added. */
export function NoProfilesYet() {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sage text-green">
        <Icon name="users" size={24} />
      </span>
      <p className="mt-4 font-semibold text-ink">No profiles yet</p>
      <p className="mt-1 max-w-80 text-[15px] text-muted">
        Add the first organization. You can save it as a draft and finish it later.
      </p>
      <ButtonLink href="/admin/profiles/new" variant="outline" size="sm" className="mt-5">
        Add the first profile
      </ButtonLink>
    </div>
  );
}

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
      <time dateTime={profile.updatedAt}>{formatDateTime(profile.updatedAt)}</time>
      {by && <span className="block text-sm text-subtle wrap-anywhere">by {by}</span>}
    </>
  );
}

/** Edit, then Preview for a draft or View on site once published. The name links to the edit page too; this makes it obvious. */
function Actions({ profile, className }: { profile: ProfileSummary; className?: string }) {
  return (
    <div className={cn("flex gap-5 text-[15px] font-semibold whitespace-nowrap", className)}>
      <Link href={editPath(profile)}>
        Edit<span className="sr-only"> {profile.name}</span>
      </Link>
      {profile.status === "published" ? (
        <a href={`${PROFILES_PATH}/${profile.slug}`} target="_blank" rel="noopener noreferrer">
          View<span className="sr-only"> {profile.name}</span> on site <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <a href={`${PREVIEW_PATH}/${profile.id}`} target={`preview-${profile.id}`}>
          Preview<span className="sr-only"> {profile.name}</span> <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

/** Every profile in display order, with its status and last change, and buttons to change the order. */
export function AdminProfileList({ profiles, adminEmail }: { profiles: ProfileSummary[]; adminEmail: string }) {
  const move = (profile: ProfileSummary, index: number, className?: string) => (
    <MoveButtons
      id={profile.id}
      name={profile.name}
      position={index + 1}
      total={profiles.length}
      className={className}
    />
  );
  const reorderable = profiles.length > 1;

  return (
    <div className="rounded-[18px] border border-sand bg-white px-5 md:px-6">
      {/* Phones: one block per profile. */}
      <ul className="divide-y divide-sand md:hidden">
        {profiles.map((profile, index) => (
          <li key={profile.id} className="flex flex-col gap-1.5 py-4">
            <div className="flex items-start justify-between gap-3">
              <NameLink profile={profile} />
              <StatusBadge status={profile.status} />
            </div>
            <Address slug={profile.slug} />
            <p className="text-[15px] text-slate">
              Updated <Updated profile={profile} adminEmail={adminEmail} />
            </p>
            <div className="flex items-center justify-between gap-4 pt-1">
              <Actions profile={profile} />
              {move(profile, index)}
            </div>
          </li>
        ))}
      </ul>

      {/* Tablets and up: a table. */}
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">Profiles</caption>
        <thead className="border-b border-sand text-sm font-bold tracking-[0.08em] text-slate uppercase">
          <tr>
            {reorderable && (
              <th scope="col" className="py-4 pr-4">
                Order
              </th>
            )}
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
          {profiles.map((profile, index) => (
            <tr key={profile.id} className="align-top">
              {reorderable && <td className="py-3 pr-4">{move(profile, index)}</td>}
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
