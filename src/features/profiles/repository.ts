import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileStatus } from "./admin-queries";
import type { ProfileInput } from "./schema";

/** Unique-violation code from Postgres. The only unique rule on profiles is the page address (`profiles_slug_key`). */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

export type SaveProfileResult =
  | { status: "saved"; id: string }
  | { status: "duplicate-slug" }
  /** Asked to publish, and a field a published profile needs is empty. */
  | { status: "incomplete" };

export type UpdateProfileResult =
  /** `oldLogo`: the logo file this save replaced or removed, to delete now. */
  | { status: "saved"; published: boolean; oldLogo: string | null }
  | { status: "duplicate-slug" }
  /** Published or being published, and a field it needs is empty. */
  | { status: "incomplete" }
  /** Unknown or deleted. */
  | { status: "not-found" };

export type DeleteProfileResult =
  | { status: "deleted"; published: boolean }
  /** Unknown, or already deleted. */
  | { status: "not-found" };

/** The database errors an admin can cause by what they typed. */
function knownError(error: PostgrestError): { status: "duplicate-slug" } | { status: "incomplete" } | null {
  if (error.code === UNIQUE_VIOLATION) return { status: "duplicate-slug" };
  if (error.code === CHECK_VIOLATION && error.message.includes("profiles_published_complete")) {
    return { status: "incomplete" };
  }
  return null;
}

/** Database columns for a profile's fields. Empty optional fields are stored as null. */
function toRow(input: ProfileInput) {
  const orNull = (value: string) => value || null;
  return {
    name: input.name,
    slug: input.slug,
    tagline: orNull(input.tagline),
    intro: orNull(input.intro),
    how_they_help: orNull(input.howTheyHelp),
    who_should_explore: orNull(input.whoShouldExplore),
    history: orNull(input.history),
    website_url: orNull(input.websiteUrl),
    contact_name: orNull(input.contactName),
    contact_role: orNull(input.contactRole),
    contact_email: orNull(input.contactEmail),
    contact_phone: orNull(input.contactPhone),
  };
}

/**
 * Adds a profile, as a draft or published, with an uploaded logo's path if there is one.
 * Writes as the logged-in admin, so row level security checks they're an admin, and the
 * database records them as the last editor.
 */
export async function insertProfile(
  input: ProfileInput,
  status: ProfileStatus,
  logoPath: string | null = null,
): Promise<SaveProfileResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .insert({ ...toRow(input), status, logo_path: logoPath })
    .select("id")
    .single();
  if (!error) return { status: "saved", id: data.id };
  const known = knownError(error);
  if (known) return known;
  throw new Error(`Couldn't add profile: ${error.message}`);
}

/**
 * Saves a profile's fields. The status changes only when given (publish or hide), and the
 * logo only when given: a newly uploaded file's path, or null to remove it. Writes as the
 * logged-in admin, and the database records them as the last editor.
 */
export async function updateProfileFields(
  id: string,
  input: ProfileInput,
  { status, logoPath }: { status?: ProfileStatus; logoPath?: string | null } = {},
): Promise<UpdateProfileResult> {
  const db = await createSupabaseServerClient();
  let oldLogo: string | null = null;
  if (logoPath !== undefined) {
    const { data, error } = await db.from("profiles").select("logo_path").eq("id", id).maybeSingle();
    if (error) throw new Error(`Couldn't load profile ${id}: ${error.message}`);
    oldLogo = data?.logo_path ?? null;
  }
  const { data, error } = await db
    .from("profiles")
    .update({ ...toRow(input), ...(status && { status }), ...(logoPath !== undefined && { logo_path: logoPath }) })
    .eq("id", id)
    .is("deleted_at", null)
    .select("status")
    .maybeSingle();
  if (!error) {
    if (!data) return { status: "not-found" };
    return { status: "saved", published: data.status === "published", oldLogo: oldLogo !== logoPath ? oldLogo : null };
  }
  const known = knownError(error);
  if (known) return known;
  throw new Error(`Couldn't save profile ${id}: ${error.message}`);
}

/**
 * Marks a profile as deleted. It disappears from the admin and the public site, but the
 * row is kept so it can be restored (README, "Restoring a deleted profile"), and its page
 * address is free for another profile. The database records the admin who deleted it as
 * the last editor.
 */
export async function softDeleteProfile(id: string): Promise<DeleteProfileResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("status")
    .maybeSingle();
  if (error) throw new Error(`Couldn't delete profile ${id}: ${error.message}`);
  return data ? { status: "deleted", published: data.status === "published" } : { status: "not-found" };
}

export type MoveProfileResult =
  | { status: "moved"; position: number; total: number }
  /** Already first (moving up) or last (moving down). */
  | { status: "unchanged"; position: number; total: number }
  /** Unknown or deleted. */
  | { status: "not-found" };

/**
 * Moves a profile one place up or down the list (display order), by swapping its number
 * with its neighbour's. Numbers that tie (a move interrupted halfway) are spread out on
 * the way, so the next move still works. Writes as the logged-in admin.
 */
export async function moveInOrder(id: string, direction: "up" | "down"): Promise<MoveProfileResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, display_order")
    .is("deleted_at", null)
    .order("display_order")
    .order("name");
  if (error) throw new Error(`Couldn't load the profile order: ${error.message}`);

  const rows = data as { id: string; display_order: number }[];
  const from = rows.findIndex((row) => row.id === id);
  if (from === -1) return { status: "not-found" };
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return { status: "unchanged", position: from + 1, total: rows.length };

  const order = rows.slice();
  [order[from], order[to]] = [order[to], order[from]];
  // The new order gets the same numbers as before, kept strictly increasing.
  let previous = -Infinity;
  for (const [index, row] of order.entries()) {
    const value = Math.max(rows[index].display_order, previous + 1);
    previous = value;
    if (row.display_order === value) continue;
    const { error } = await db.from("profiles").update({ display_order: value }).eq("id", row.id);
    if (error) throw new Error(`Couldn't move profile ${row.id}: ${error.message}`);
  }
  return { status: "moved", position: to + 1, total: rows.length };
}
