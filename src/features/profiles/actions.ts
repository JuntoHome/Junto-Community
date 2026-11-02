"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PROFILES_TAG } from "./queries";
import { insertProfile, type SaveProfileResult, type UpdateProfileResult, updateProfileFields } from "./repository";
import {
  missingPublishFields,
  PROFILE_FIELDS,
  type ProfileFormState,
  type ProfileFormValues,
  type ProfileInput,
  type ProfileIntent as Intent,
  profileDraftSchema,
} from "./schema";

const DUPLICATE_SLUG = "Another profile already uses this address. Please choose a different one.";
const NOT_SAVED = "The profile couldn't be saved. Please try again in a moment.";
const GONE = "This profile no longer exists, so the changes couldn't be saved. It may have been deleted.";
const NEEDED_TO_PUBLISH = "Needed to publish.";
const NEEDED_WHILE_PUBLISHED = "Needed while the profile is published.";
const NOT_PUBLISHED =
  "The profile wasn't published. Please fill in the following, or choose Save draft to keep your changes for now:";

function readIntent(formData: FormData): Intent {
  const intent = formData.get("intent");
  return intent === "publish" || intent === "hide" ? intent : "save";
}

function readValues(formData: FormData): ProfileFormValues {
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ProfileFormValues;
}

type FieldErrors = NonNullable<ProfileFormState["fieldErrors"]>;

/** The first problem with each field. */
function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof ProfileFormValues;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Checks what was typed. A draft only needs its name; publishing also needs every
 * "Needed to publish" field, and all the problems are listed together.
 */
function check(values: ProfileFormValues, intent: Intent): { input: ProfileInput } | { state: ProfileFormState } {
  const parsed = profileDraftSchema.safeParse(values);
  const missing = intent === "publish" ? missingPublishFields(values) : [];
  if (parsed.success && missing.length === 0) return { input: parsed.data };

  const fieldErrors: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
  for (const field of missing) fieldErrors[field] ??= NEEDED_TO_PUBLISH;
  // Only empty fields in the way: say why it wasn't published, and that a draft can still be saved.
  return { state: { values, fieldErrors, message: parsed.success ? NOT_PUBLISHED : undefined } };
}

/** The database refused to publish, or to leave a published profile without something it shows. */
function incomplete(values: ProfileFormValues, error: string): ProfileFormState {
  const missing = missingPublishFields(values);
  if (missing.length === 0) return { values, message: NOT_SAVED };
  return { values, fieldErrors: Object.fromEntries(missing.map((field) => [field, error])) };
}

/** Saves a new profile as a draft, or publishes it straight away, then opens it. */
export async function createProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const publish = readIntent(formData) === "publish";
  const checked = check(values, publish ? "publish" : "save");
  if ("state" in checked) return checked.state;

  let result: SaveProfileResult;
  try {
    result = await insertProfile(checked.input, publish ? "published" : "draft");
  } catch (error) {
    console.error("[profiles] create failed", error);
    return { values, message: NOT_SAVED };
  }
  if (result.status === "duplicate-slug") return { values, fieldErrors: { slug: DUPLICATE_SLUG } };
  if (result.status === "incomplete") return incomplete(values, NEEDED_TO_PUBLISH);

  if (publish) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles/${result.id}?${publish ? "published" : "created"}=1`);
}

/**
 * Saves changes to a profile, then reloads it. Save keeps the status (a published
 * profile's changes go live straight away), publish makes it public, and hide takes it
 * off the public site. Bind the profile's id: `updateProfile.bind(null, id)`.
 */
export async function updateProfile(
  id: string,
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const intent = readIntent(formData);
  const checked = check(values, intent);
  if ("state" in checked) return checked.state;

  const status = intent === "publish" ? "published" : intent === "hide" ? "draft" : undefined;
  let result: UpdateProfileResult;
  try {
    result = await updateProfileFields(id, checked.input, status);
  } catch (error) {
    console.error("[profiles] update failed", error);
    return { values, message: NOT_SAVED };
  }
  switch (result.status) {
    case "duplicate-slug":
      return { values, fieldErrors: { slug: DUPLICATE_SLUG } };
    case "not-found":
      return { values, message: GONE };
    case "incomplete":
      return incomplete(values, intent === "publish" ? NEEDED_TO_PUBLISH : NEEDED_WHILE_PUBLISHED);
  }

  // Visitors see the change on their next visit, not after the usual 30 seconds.
  if (status || result.published) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles/${id}?${intent === "publish" ? "published" : intent === "hide" ? "hidden" : "saved"}=1`);
}
