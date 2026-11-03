import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logoUrl, type ProfileRow, toProfile } from "./queries";
import type { ProfileFormValues } from "./schema";
import type { Profile } from "./types";

export type ProfileStatus = "draft" | "published";

/** One profile as the admin list shows it. */
export type ProfileSummary = {
  id: string;
  name: string;
  slug: string;
  status: ProfileStatus;
  updatedAt: string;
  /** Email of the admin who last saved it; null if it was changed outside the admin. */
  updatedBy: string | null;
};

const SUMMARY_COLUMNS = "id, name, slug, status, updated_at, editor:admins(email)";

type SummaryRow = {
  id: string;
  name: string;
  slug: string;
  status: ProfileStatus;
  updated_at: string;
  editor: { email: string } | null;
};

/** One profile with every field and its logo's link, as the edit form shows it. */
export type AdminProfile = ProfileSummary & { values: ProfileFormValues; logoUrl: string | null };

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, tagline, intro, how_they_help, who_should_explore, history, website_url, contact_name, contact_role, contact_email, contact_phone, links, logo_path`;

type DetailRow = SummaryRow & {
  tagline: string | null;
  intro: string | null;
  how_they_help: string | null;
  who_should_explore: string | null;
  history: string | null;
  website_url: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  links: string[] | null;
  logo_path: string | null;
};

/** One profile with every field, plus the page visitors would see (the preview). */
export type ProfilePreview = AdminProfile & { page: Profile };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSummary(row: SummaryRow): ProfileSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    updatedBy: row.editor?.email ?? null,
  };
}

function toAdminProfile(row: DetailRow, db: SupabaseClient): AdminProfile {
  return {
    ...toSummary(row),
    logoUrl: logoUrl(db, row.logo_path),
    values: {
      name: row.name,
      slug: row.slug,
      tagline: row.tagline ?? "",
      intro: row.intro ?? "",
      worthExploring: row.how_they_help ?? "",
      peopleToKnow: row.who_should_explore ?? "",
      gettingStarted: row.history ?? "",
      websiteUrl: row.website_url ?? "",
      links: (row.links ?? []).join("\n"),
      contactName: row.contact_name ?? "",
      contactRole: row.contact_role ?? "",
      contactEmail: row.contact_email ?? "",
      contactPhone: row.contact_phone ?? "",
    },
  };
}

// These read as the logged-in admin, so row level security applies (drafts are visible
// to admins only). Call requireAdmin() first. Nothing here is cached: admins always see
// the latest data.

/** Every profile that hasn't been deleted, drafts included, in the public overview's order. */
export async function listProfilesForAdmin(): Promise<ProfileSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(SUMMARY_COLUMNS)
    .is("deleted_at", null)
    .order("display_order")
    .order("name");
  if (error) throw new Error(`Couldn't load profiles: ${error.message}`);
  return (data as unknown as SummaryRow[]).map(toSummary);
}

/** One profile by id, or null (unknown or deleted). Asked once per request, however many callers. */
export const getProfileForAdmin = cache(async (id: string): Promise<AdminProfile | null> => {
  if (!UUID.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load profile ${id}: ${error.message}`);
  return data ? toAdminProfile(data as unknown as DetailRow, db) : null;
});

/** One profile by id as its public page would show it, drafts included, or null (unknown or deleted). */
export const getProfilePreview = cache(async (id: string): Promise<ProfilePreview | null> => {
  if (!UUID.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load profile ${id}: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow & ProfileRow;
  return { ...toAdminProfile(row, db), page: toProfile(row, db) };
});

/** A deleted profile's name, for the message after deleting it, or null (unknown or not deleted). */
export async function getDeletedProfileName(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select("name")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load profile ${id}: ${error.message}`);
  return data?.name ?? null;
}
