import { z } from "zod";
import { LINK_WITH_TEXT } from "./links";
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

/** "www.score.org" becomes "https://www.score.org". */
const withProtocol = (v: string) => (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? `https://${v}` : v);

/** A web page's full address: no spaces, and no "name:password@" before the site. */
const isWebAddress = (v: string) => webAddress.safeParse(v).success && !/\s/.test(v) && !/^https?:\/\/[^/]*@/i.test(v);

/** Empty, or a web page. "www.score.org" is saved as "https://www.score.org". */
const websiteUrl = z
  .string()
  .trim()
  .transform(withProtocol)
  .pipe(z.string().max(2000, tooLong(2000)))
  .refine((v) => v === "" || isWebAddress(v), "Please enter a full web address, e.g. https://www.score.org.");

export const MAX_LINKS = 10;

/**
 * Official sources / useful links: one per line, each a web address or [text](address).
 * Empty lines are skipped, and "www.score.org" is saved as "https://www.score.org".
 */
const links = z.string().transform((value, ctx) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > MAX_LINKS) {
    ctx.addIssue({ code: "custom", message: `Please list ${MAX_LINKS} links or fewer.` });
    return z.NEVER;
  }
  const saved: string[] = [];
  for (const [index, line] of lines.entries()) {
    const withText = LINK_WITH_TEXT.exec(line);
    const address = withProtocol(withText ? withText[2] : line);
    if (line.length > 2000 || !isWebAddress(address)) {
      ctx.addIssue({
        code: "custom",
        message: `Line ${index + 1} isn't a web address. Put one address on each line, e.g. https://www.score.org.`,
      });
      return z.NEVER;
    }
    saved.push(withText ? `[${withText[1]}](${address})` : address);
  }
  return saved;
});

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
    worthExploring: longText,
    peopleToKnow: longText,
    gettingStarted: longText,
    websiteUrl,
    links,
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

/** The form's fields: the profile's text, plus its logo (a file). */
export type FormField = ProfileField | "logo";

/** The form's fields in the order the form shows them. */
export const FORM_FIELDS: FormField[] = PROFILE_FIELDS.flatMap((field) =>
  field === "tagline" ? [field, "logo"] : field,
);

/** What the admin screens call each field. */
export const PROFILE_LABELS: Record<FormField, string> = {
  name: "Organization name",
  slug: "Page address",
  tagline: "Tagline",
  logo: "Logo",
  intro: "Introduction",
  worthExploring: "Worth exploring",
  peopleToKnow: "People to know",
  gettingStarted: "Getting started",
  websiteUrl: "Website",
  links: "Official sources / useful links",
  contactName: "Contact name",
  contactRole: "Role",
  contactEmail: "Email",
  contactPhone: "Phone",
};

/** What a profile needs besides its name before it can be public (the database's profiles_published_complete check). */
export const PUBLISH_FIELDS: ProfileField[] = [
  "tagline",
  "intro",
  "worthExploring",
  "peopleToKnow",
  "gettingStarted",
  "websiteUrl",
];

/** The publish fields that are still empty or only spaces, as typed or as parsed. */
export function missingPublishFields(profile: Record<ProfileField, string>): ProfileField[] {
  return PUBLISH_FIELDS.filter((field) => !profile[field].trim());
}

/** Every field as the form holds it: plain strings, empty when not filled in. */
export type ProfileFormValues = Record<ProfileField, string>;

export const emptyProfileValues = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, ""])) as ProfileFormValues;

/** The form's buttons: save keeps the status, publish makes the profile public, hide makes it a draft again. */
export type ProfileIntent = "save" | "publish" | "hide";

/** What the profile form shows after a save that didn't go through. A successful save redirects instead. */
export type ProfileFormState = {
  values: ProfileFormValues;
  fieldErrors?: Partial<Record<FormField, string>>;
  /** A problem that isn't about one field, e.g. the database couldn't be reached. */
  message?: string;
};

// Logos: what the profile-logos bucket accepts (supabase/migrations/20261029010000_create_profile_logos_bucket.sql).
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_WRONG_TYPE = "Please choose a PNG, JPG or WebP image.";

/** Why a logo of this size can't be used, or null if it can. */
export function logoSizeProblem(bytes: number): string | null {
  if (bytes <= LOGO_MAX_BYTES) return null;
  const mb = Math.ceil((bytes / 1024 / 1024) * 10) / 10;
  return `That image is ${mb} MB. Please choose one of 2 MB or less.`;
}

/** Why a chosen file can't be used as a logo, going by the type the browser reports; null if it can. */
export function logoFileProblem(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type) || file.size === 0) return LOGO_WRONG_TYPE;
  return logoSizeProblem(file.size);
}
