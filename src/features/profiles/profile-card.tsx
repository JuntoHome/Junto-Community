import Link from "next/link";
import { ProfileLogo } from "./profile-logo";
import { PROFILES_PATH } from "./queries";
import type { Profile } from "./types";

/** One organization on the overview page. The whole card links to its profile. */
export function ProfileCard({ profile, linkLabel }: { profile: Profile; linkLabel: string }) {
  return (
    <Link
      href={`${PROFILES_PATH}/${profile.slug}`}
      className="group flex h-full flex-col rounded-[18px] border border-sand bg-white px-6 py-7 no-underline transition-shadow hover:shadow-card md:px-7"
    >
      {profile.logoUrl && <ProfileLogo src={profile.logoUrl} name={profile.name} className="mb-5 h-12 w-40" />}
      <h2 className="font-serif text-2xl leading-tight font-bold text-navy">{profile.name}</h2>
      <p className="mt-2 text-base leading-relaxed text-slate md:text-[17px]">{profile.tagline}</p>
      <span className="mt-auto pt-5 font-semibold text-navy transition-colors group-hover:text-green">
        {linkLabel} <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
