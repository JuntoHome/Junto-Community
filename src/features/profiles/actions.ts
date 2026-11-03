"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { type LogoUpload, readLogoFile, removeLogoFile, uploadLogo } from "./logo-storage";
import { PROFILES_TAG } from "./queries";
import {
  type DeleteProfileResult,
  insertProfile,
  type SaveProfileResult,
  softDeleteProfile,
  type UpdateProfileResult,
  updateProfileFields,
} from "./repository";
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
const LOGO_NOT_SAVED = "The logo couldn't be uploaded, so nothing was saved. Please try again in a moment.";
const GONE = "This profile no longer exists, so the changes couldn't be saved. It may have been deleted.";
const NOT_DELETED = "The profile couldn't be deleted. Please try again in a moment.";
const ALREADY_DELETED = "This profile no longer exists. Someone may have deleted it already.";
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

/** The form's logo: a new file to upload, a request to remove the current one, or no change. */
type LogoChoice = { upload: LogoUpload } | { remove: true } | { keep: true } | { error: string };

async function readLogo(formData: FormData): Promise<LogoChoice> {
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const logo = await readLogoFile(file);
    return "error" in logo ? logo : { upload: logo };
  }
  return formData.get("removeLogo") === "1" ? { remove: true } : { keep: true };
}

/** Uploads a chosen logo before the profile is saved; null if there's none or the upload failed. */
async function upload(logo: LogoChoice): Promise<{ path: string | null } | { failed: true }> {
  if (!("upload" in logo)) return { path: null };
  try {
    return { path: await uploadLogo(logo.upload) };
  } catch (error) {
    console.error("[profiles] logo upload failed", error);
    return { failed: true };
  }
}

/** Deletes a logo file nothing uses: an upload whose profile wasn't saved, or a replaced logo. */
async function discard(path: string | null) {
  if (path) await removeLogoFile(path);
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
 * Checks what was typed, and the chosen logo. A draft only needs its name; publishing also
 * needs every "Needed to publish" field, and all the problems are listed together.
 */
function check(
  values: ProfileFormValues,
  intent: Intent,
  logo: LogoChoice,
): { input: ProfileInput } | { state: ProfileFormState } {
  const parsed = profileDraftSchema.safeParse(values);
  const missing = intent === "publish" ? missingPublishFields(values) : [];
  const logoError = "error" in logo ? logo.error : undefined;
  if (parsed.success && missing.length === 0 && !logoError) return { input: parsed.data };

  const fieldErrors: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
  for (const field of missing) fieldErrors[field] ??= NEEDED_TO_PUBLISH;
  if (logoError) fieldErrors.logo = logoError;
  // Only empty fields in the way: say why it wasn't published, and that a draft can still be saved.
  const onlyEmpty = parsed.success && !logoError;
  return { state: { values, fieldErrors, message: onlyEmpty ? NOT_PUBLISHED : undefined } };
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
  const logo = await readLogo(formData);
  const checked = check(values, publish ? "publish" : "save", logo);
  if ("state" in checked) return checked.state;

  const uploaded = await upload(logo);
  if ("failed" in uploaded) return { values, message: LOGO_NOT_SAVED };
  let result: SaveProfileResult;
  try {
    result = await insertProfile(checked.input, publish ? "published" : "draft", uploaded.path);
  } catch (error) {
    console.error("[profiles] create failed", error);
    await discard(uploaded.path);
    return { values, message: NOT_SAVED };
  }
  if (result.status !== "saved") await discard(uploaded.path);
  if (result.status === "duplicate-slug") return { values, fieldErrors: { slug: DUPLICATE_SLUG } };
  if (result.status === "incomplete") return incomplete(values, NEEDED_TO_PUBLISH);

  if (publish) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles/${result.id}?${publish ? "published" : "created"}=1`);
}

/**
 * Saves changes to a profile, logo included, then reloads it. Save keeps the status (a
 * published profile's changes go live straight away), publish makes it public, and hide
 * takes it off the public site. Bind the profile's id: `updateProfile.bind(null, id)`.
 */
export async function updateProfile(
  id: string,
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await requireAdmin();

  const values = readValues(formData);
  const intent = readIntent(formData);
  const logo = await readLogo(formData);
  const checked = check(values, intent, logo);
  if ("state" in checked) return checked.state;

  const uploaded = await upload(logo);
  if ("failed" in uploaded) return { values, message: LOGO_NOT_SAVED };
  const status = intent === "publish" ? "published" : intent === "hide" ? "draft" : undefined;
  const logoPath = "remove" in logo ? null : (uploaded.path ?? undefined);
  let result: UpdateProfileResult;
  try {
    result = await updateProfileFields(id, checked.input, { status, logoPath });
  } catch (error) {
    console.error("[profiles] update failed", error);
    await discard(uploaded.path);
    return { values, message: NOT_SAVED };
  }
  if (result.status !== "saved") await discard(uploaded.path);
  switch (result.status) {
    case "duplicate-slug":
      return { values, fieldErrors: { slug: DUPLICATE_SLUG } };
    case "not-found":
      return { values, message: GONE };
    case "incomplete":
      return incomplete(values, intent === "publish" ? NEEDED_TO_PUBLISH : NEEDED_WHILE_PUBLISHED);
  }

  await discard(result.oldLogo);
  // Visitors see the change on their next visit, not after the usual 30 seconds.
  if (status || result.published) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles/${id}?${intent === "publish" ? "published" : intent === "hide" ? "hidden" : "saved"}=1`);
}

export type DeleteProfileState = { message?: string };

/**
 * Deletes a profile, then goes back to the list. The profile is kept in the database, so
 * it can be restored. Bind the profile's id: `deleteProfile.bind(null, id)`.
 */
export async function deleteProfile(id: string): Promise<DeleteProfileState> {
  await requireAdmin();

  let result: DeleteProfileResult;
  try {
    result = await softDeleteProfile(id);
  } catch (error) {
    console.error("[profiles] delete failed", error);
    return { message: NOT_DELETED };
  }
  if (result.status === "not-found") return { message: ALREADY_DELETED };

  if (result.published) updateTag(PROFILES_TAG);
  redirect(`/admin/profiles?deleted=${id}`);
}
