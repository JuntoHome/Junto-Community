"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { insertProfileDraft, type SaveProfileResult } from "./repository";
import { PROFILE_FIELDS, type ProfileFormState, type ProfileFormValues, profileDraftSchema } from "./schema";

const DUPLICATE_SLUG = "Another profile already uses this address. Please choose a different one.";
const NOT_SAVED = "The profile couldn't be saved. Please try again in a moment.";

function readValues(formData: FormData): ProfileFormValues {
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ProfileFormValues;
}

/** Saves a new profile as a draft, then opens it. Drafts never appear on the public site. */
export async function createProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const parsed = profileDraftSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: ProfileFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ProfileFormValues;
      fieldErrors[field] ??= issue.message;
    }
    return { values, fieldErrors };
  }

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
