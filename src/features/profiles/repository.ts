import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileInput } from "./schema";

/** Unique-violation code from Postgres. The only unique rule on profiles is the page address (`profiles_slug_key`). */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

export type SaveProfileResult = { status: "saved"; id: string } | { status: "duplicate-slug" };

export type UpdateProfileResult =
  | { status: "saved"; published: boolean }
  | { status: "duplicate-slug" }
  /** Published, and a field it needs to stay public was emptied. */
  | { status: "incomplete" }
  /** Unknown or deleted. */
  | { status: "not-found" };

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
 * Adds a profile as a draft. Writes as the logged-in admin, so row level security checks
 * they're an admin, and the database records them as the last editor.
 */
export async function insertProfileDraft(input: ProfileInput): Promise<SaveProfileResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .insert({ ...toRow(input), status: "draft" })
    .select("id")
    .single();
  if (!error) return { status: "saved", id: data.id };
  if (error.code === UNIQUE_VIOLATION) return { status: "duplicate-slug" };
  throw new Error(`Couldn't add profile: ${error.message}`);
}

/**
 * Saves a profile's fields; its status stays as it is. Writes as the logged-in admin, and
 * the database records them as the last editor.
 */
export async function updateProfileFields(id: string, input: ProfileInput): Promise<UpdateProfileResult> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .update(toRow(input))
    .eq("id", id)
    .is("deleted_at", null)
    .select("status")
    .maybeSingle();
  if (!error) return data ? { status: "saved", published: data.status === "published" } : { status: "not-found" };
  if (error.code === UNIQUE_VIOLATION) return { status: "duplicate-slug" };
  if (error.code === CHECK_VIOLATION && error.message.includes("profiles_published_complete")) {
    return { status: "incomplete" };
  }
  throw new Error(`Couldn't save profile ${id}: ${error.message}`);
}
