"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PROFILES_TAG } from "./queries";
import {
  insertProfileDraft,
  type SaveProfileResult,
  type UpdateProfileResult,
  updateProfileFields,
} from "./repository";
import {
  missingPublishFields,
  PROFILE_FIELDS,
  type ProfileFormState,
  type ProfileFormValues,
  profileDraftSchema,
} from "./schema";

const DUPLICATE_SLUG = "Another profile already uses this address. Please choose a different one.";
const NOT_SAVED = "The profile couldn't be saved. Please try again in a moment.";
const GONE = "This profile no longer exists, so the changes couldn't be saved. It may have been deleted.";
const NEEDED_WHILE_PUBLISHED = "Needed while the profile is published.";

function readValues(formData: FormData): ProfileFormValues {
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ProfileFormValues;
}

/** The first problem with each field. */
function toFieldErrors(error: z.ZodError): ProfileFormState["fieldErrors"] {
  const fieldErrors: ProfileFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof ProfileFormValues;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/** Saves a new profile as a draft, then opens it. Drafts never appear on the public site. */
export async function createProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const parsed = profileDraftSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: toFieldErrors(parsed.error) };

  let result: SaveProfileResult;
  try {
    result = await insertProfileDraft(parsed.data);
  } catch (error) {
    console.error("[profiles] create failed", error);
    return { values, message: NOT_SAVED };
  }
  if (result.status === "duplicate-slug") return { values, fieldErrors: { slug: DUPLICATE_SLUG } };

  redirect(`/admin/profiles/${result.id}?created=1`);
}

/**
 * Saves changes to a profile, then reloads it. A draft stays a draft; a published profile's
 * changes go live straight away. Bind the profile's id: `updateProfile.bind(null, id)`.
 */
export async function updateProfile(
  id: string,
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const parsed = profileDraftSchema.safeParse(values);
  if (!parsed.success) return { values, fieldErrors: toFieldErrors(parsed.error) };

  let result: UpdateProfileResult;
  try {
    result = await updateProfileFields(id, parsed.data);
  } catch (error) {
    console.error("[profiles] update failed", error);
    return { values, message: NOT_SAVED };
  }
  switch (result.status) {
    case "duplicate-slug":
      return { values, fieldErrors: { slug: DUPLICATE_SLUG } };
    case "not-found":
      return { values, message: GONE };
    case "incomplete": {
      // The database refused to leave a published profile without something it shows.
      const missing = missingPublishFields(parsed.data);
      if (missing.length === 0) return { values, message: NOT_SAVED };
      return { values, fieldErrors: Object.fromEntries(missing.map((field) => [field, NEEDED_WHILE_PUBLISHED])) };
    }
  }

  // Visitors get the new version on their next visit, not after the usual 30 seconds.
  if (result.published) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles/${id}?saved=1`);
}
