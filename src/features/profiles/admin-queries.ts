import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
export const getProfileForAdmin = cache(async (id: string): Promise<ProfileSummary | null> => {
  if (!UUID.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(SUMMARY_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load profile ${id}: ${error.message}`);
  return data ? toSummary(data as unknown as SummaryRow) : null;
});
