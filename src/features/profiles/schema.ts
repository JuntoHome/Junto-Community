import { z } from "zod";
import { SLUG_MAX, slugify } from "./slug";

// Limits match the checks on public.profiles (supabase/migrations/20261029000000_create_profiles.sql).
const tooLong = (max: number) => `Please use ${max.toLocaleString("en-US")} characters or fewer.`;
const text = (max: number) => z.string().trim().max(max, tooLong(max));
// Browsers send a textarea's line breaks as "\r\n". Store "\n", and count it as one
// character, as the textarea's own limit does.
const longText = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, "\n"))
  .pipe(text(20000));

const webAddress = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });

/** Empty, or a web page. "www.score.org" is saved as "https://www.score.org". */
const websiteUrl = z
  .string()
  .trim()
  .transform((v) => (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.string().max(2000, tooLong(2000)))
  .refine(
    // No spaces, and no "name:password@" before the site.
    (v) => v === "" || (webAddress.safeParse(v).success && !/\s/.test(v) && !/^https?:\/\/[^/]*@/i.test(v)),
    "Please enter a full web address, e.g. https://www.score.org.",
  );

const contactEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Please enter a valid email address, or leave it empty.");

/**
 * A profile's fields as typed in the admin form. Only the name is needed to save a draft;
 * an empty page address is filled in from the name.
 */
export const profileDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter the organization's name.").max(200, tooLong(200)),
    slug: z.string().trim().max(SLUG_MAX, tooLong(SLUG_MAX)),
    tagline: text(300),
    intro: longText,
    howTheyHelp: longText,
    whoShouldExplore: longText,
    history: longText,
    websiteUrl,
    contactName: text(200),
    contactRole: text(200),
    contactEmail,
    contactPhone: text(50),
  })
  .transform((profile) => ({ ...profile, slug: slugify(profile.slug || profile.name) }))
  .refine((profile) => profile.slug !== "", {
    path: ["slug"],
    message: "Please enter a page address using letters or numbers.",
  });

export type ProfileInput = z.output<typeof profileDraftSchema>;
export type ProfileField = keyof ProfileInput;
export const PROFILE_FIELDS = Object.keys(profileDraftSchema.in.shape) as ProfileField[];

/** Every field as the form holds it: plain strings, empty when not filled in. */
export type ProfileFormValues = Record<ProfileField, string>;

export const emptyProfileValues = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, ""])) as ProfileFormValues;

/** What the profile form shows after a save that didn't go through. A successful save redirects instead. */
export type ProfileFormState = {
  values: ProfileFormValues;
  fieldErrors?: Partial<Record<ProfileField, string>>;
  /** A problem that isn't about one field, e.g. the database couldn't be reached. */
  message?: string;
};
