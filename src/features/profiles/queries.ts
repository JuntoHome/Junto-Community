import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { getSupabasePublic } from "@/lib/supabase/public";
import type { Profile } from "./types";

/** Base path of the public profile pages. Each profile lives at `${PROFILES_PATH}/<slug>`. */
export const PROFILES_PATH = "/who-can-help";

/** Cache tag for every public profile read. Saving a profile in /admin revalidates it. */
export const PROFILES_TAG = "profiles";

/**
 * How stale public profile data may get. The first visit after this serves the old copy
 * while a new one is built, so 30 seconds keeps every change visible within a minute.
 * Keep the pages' `revalidate` exports the same.
 */
const REVALIDATE_SECONDS = 30;

const COLUMNS =
  "id, name, slug, tagline, intro, how_they_help, who_should_explore, history, contact_name, contact_role, contact_email, contact_phone, website_url, logo_path, updated_at";

type ProfileRow = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  intro: string | null;
  how_they_help: string | null;
  who_should_explore: string | null;
  history: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  logo_path: string | null;
  updated_at: string;
};

const LOGO_BUCKET = "profile-logos";

// The database only lets a profile be published once the required fields are filled in,
// so the fallbacks below are never shown; they keep the types honest.
function toProfile(row: ProfileRow, db: SupabaseClient): Profile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline ?? "",
    intro: row.intro ?? "",
    howTheyHelp: row.how_they_help ?? "",
    whoShouldExplore: row.who_should_explore ?? "",
    history: row.history?.trim() ? row.history : null,
    contact: {
      name: row.contact_name || null,
      role: row.contact_role || null,
      email: row.contact_email || null,
      phone: row.contact_phone || null,
    },
    websiteUrl: row.website_url ?? "",
    logoUrl: row.logo_path ? db.storage.from(LOGO_BUCKET).getPublicUrl(row.logo_path).data.publicUrl : null,
    updatedAt: row.updated_at,
  };
}

/** Published profiles in display order. Drafts and deleted profiles are never returned. */
export const listPublishedProfiles = unstable_cache(
  async (): Promise<Profile[]> => {
    const db = getSupabasePublic();
    if (!db) return [];
    // Row level security already limits visitors to published profiles; the filters say so explicitly.
    const { data, error } = await db
      .from("profiles")
      .select(COLUMNS)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("display_order")
      .order("name");
    if (error) throw new Error(`Couldn't load profiles: ${error.message}`);
    return (data as ProfileRow[]).map((row) => toProfile(row, db));
  },
  ["published-profiles"],
  { tags: [PROFILES_TAG], revalidate: REVALIDATE_SECONDS },
);

/** One published profile by its address, or null (unknown, draft or deleted). */
export const getPublishedProfile = unstable_cache(
  async (slug: string): Promise<Profile | null> => {
    const db = getSupabasePublic();
    if (!db) return null;
    const { data, error } = await db
      .from("profiles")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(`Couldn't load profile "${slug}": ${error.message}`);
    if (!data) return null;
    return toProfile(data as ProfileRow, db);
  },
  ["published-profile"],
  { tags: [PROFILES_TAG], revalidate: REVALIDATE_SECONDS },
);
