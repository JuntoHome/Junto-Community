import { BRIEF_FIELDS } from "../criteria/schema";

/**
 * The Translator's internal fields: one record shape for every input layout, so the rest of
 * the code never cares which file a row came from. The layout mappings (mappings/) say which
 * source columns fill each field; map-row.ts applies them.
 *
 * Values are raw text from the workbook, or null when the cell is blank. Trimming, matching
 * case and parsing employee counts is the normalize step's job (TR-10).
 */

/** Used for filtering and ranking. */
export const CORE_FIELDS = ["recordId", "company", "city", "state", "industry", "employees", "title"] as const;
export type CoreField = (typeof CORE_FIELDS)[number];

/** Who to contact and how. Shown, not ranked. */
export const CONTACT_FIELDS = ["name", "email", "phone", "website", "address", "zip"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Extra information about the business. Shown, not ranked in Phase 1. */
export const EXTRA_FIELDS = ["naicsDescription", "employeeRange", "otherExecutives"] as const;
export type ExtraField = (typeof EXTRA_FIELDS)[number];

export const RECORD_FIELDS = [...CORE_FIELDS, ...CONTACT_FIELDS, ...EXTRA_FIELDS] as const;
export type RecordField = (typeof RECORD_FIELDS)[number];

/**
 * What each field is called on screen, whichever layout the file uses. User messages name
 * fields with these (for example the possible-duplicate warning, TR-12).
 */
export const FIELD_LABELS: Record<RecordField, string> = {
  recordId: "Record ID",
  company: "Company",
  city: "City",
  state: "State",
  industry: "Industry",
  employees: "Employees",
  title: "Title",
  name: "Name",
  email: "Email",
  phone: "Phone",
  website: "Website",
  address: "Address",
  zip: "ZIP Code",
  naicsDescription: "NAICS Description",
  employeeRange: "Employee Size Range",
  otherExecutives: "Other Executives",
};

/** The fields that hold one piece of text: everything except recordId (always set) and otherExecutives (a list). */
export type TextField = Exclude<RecordField, "recordId" | "otherExecutives">;
export const TEXT_FIELDS = RECORD_FIELDS.filter(
  (field): field is TextField => field !== "recordId" && field !== "otherExecutives",
);

/** A file can't be ranked without these. */
export const REQUIRED_FIELDS = ["company", "city", "state", "industry"] as const satisfies readonly CoreField[];
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

// Every field a SearchBrief can test (criteria/schema.ts) must be a core field here.
// This line stops compiling if the two lists drift apart.
BRIEF_FIELDS satisfies readonly CoreField[];

/** One of the additional executives listed for a business (display only). */
export type Executive = {
  name: string | null;
  title: string | null;
};

/** One business, whichever layout it came from. */
export type TranslatorRecord = {
  /** The source ID (Record ID or IUSA Number), or "ROW-0001" style when it is blank. Never null. */
  recordId: string;
  /** Additional executives in source order. Empty when the layout has none. */
  otherExecutives: Executive[];
} & Record<TextField, string | null>;
