import { type BriefCriterion, type BriefDimension, type BriefField, FIELD_DIMENSION, type SearchBrief } from "./schema";

/**
 * A SearchBrief in plain language, for the criteria summary (TR-16) and the export's Criteria
 * sheet (TR-26). Every value is passed through as plain text, never as HTML: the caller renders
 * it as text.
 *
 * Pure: no React, no I/O. The same brief always gives the same items in the same order.
 */

/** The parts of the brief, in the order they are described. */
export type BriefSection = "intent" | "mustHaves" | "preferences" | "exclusions" | "listSize" | "assumptions";

/**
 * Stable keys for the summary's items. The form can produce every one of them except
 * `pref-geo`, `must-employees`, `exclude-state`, `exclude-employees` and `assumptions`; those
 * appear only for a brief from elsewhere (Phase 2's AI), so the summary still shows all of it.
 */
export type BriefItemId =
  | "goal"
  | "must-geo"
  | "must-industry"
  | "must-title"
  | "must-employees"
  | "pref-geo"
  | "pref-industry"
  | "pref-title"
  | "pref-employees"
  | "priority"
  | "exclude-industry"
  | "exclude-title"
  | "exclude-city"
  | "exclude-state"
  | "exclude-employees"
  | "list-size"
  | "assumptions";

/**
 * One thing the brief says. Most items are a full sentence ("Show 40."). Preference items are
 * the part of the Preferences sentence they stand for ("Owner"), and `priority` says the order
 * ("Most important first: Title, Industry, Company size."); `describeLines()` joins them.
 */
export type BriefItem = { id: BriefItemId; section: BriefSection; text: string };

/** One line of the summary: a sentence and the items it is made of (each can be changed on its own). */
export type BriefLine = { section: BriefSection; text: string; items: BriefItem[] };

const GOALS: Record<SearchBrief["intent"], string> = {
  business_owner: "Goal: find prospective customers or partners.",
  job_seeker: "Goal: find potential employers.",
};

/** What each dimension is called in the importance order. */
const DIMENSION_NAMES: Record<BriefDimension, string> = {
  industry: "Industry",
  geography: "Location",
  title: "Title",
  employees: "Company size",
};

/** "A", "A or B", "A, B or C". */
function orList(items: readonly string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

const number = (n: number) => n.toLocaleString("en-US");

/** One criterion's values as words: "Phoenix or Tempe", "10 to 99 employees". */
function criterionText(criterion: BriefCriterion): string {
  if (criterion.operator === "equals") return criterion.value;
  if (criterion.operator === "in") return orList(criterion.value);
  const { min, max } = criterion.value;
  return min === max ? `${number(min)} employees` : `${number(min)} to ${number(max)} employees`;
}

/**
 * The values `criteria` give `field`, or null when none is about it. Several criteria on one
 * field are joined with `join`: "and" for must-haves (a row must pass each), "or" for preferences
 * and exclusions (any one is enough).
 */
function fieldText(criteria: readonly BriefCriterion[], field: BriefField, join: "and" | "or"): string | null {
  const parts = criteria.filter((criterion) => criterion.field === field).map(criterionText);
  return parts.length === 0 ? null : parts.join(` ${join} `);
}

/** City and state together, "Phoenix or Tempe, AZ", or whichever one is set. Null when neither is. */
function placeText(criteria: readonly BriefCriterion[], join: "and" | "or"): string | null {
  const parts = [fieldText(criteria, "city", join), fieldText(criteria, "state", join)].filter((p) => p !== null);
  return parts.length === 0 ? null : parts.join(", ");
}

/** A preference dimension as words, or null when the brief has no preference for it. */
function preferenceText(brief: SearchBrief, dimension: BriefDimension): string | null {
  return dimension === "geography" ? placeText(brief.preferences, "or") : fieldText(brief.preferences, dimension, "or");
}

const PREFERENCE_IDS: Record<BriefDimension, BriefItemId> = {
  geography: "pref-geo",
  industry: "pref-industry",
  title: "pref-title",
  employees: "pref-employees",
};

/** The dimensions with a preference, in the order they first appear in `preferences`. */
function preferredDimensions(brief: SearchBrief): BriefDimension[] {
  return [...new Set(brief.preferences.map((criterion) => FIELD_DIMENSION[criterion.field]))];
}

/** Whether the brief orders its preferences. An empty priorityOrder is the same as none. */
const isOrdered = (brief: SearchBrief) => (brief.priorityOrder ?? []).length > 0;

/**
 * The preferences in the order the summary shows them: the priority order when there is one,
 * then any preferred dimension it doesn't list; otherwise the order of `preferences`.
 */
function preferenceOrder(brief: SearchBrief): BriefDimension[] {
  const preferred = preferredDimensions(brief);
  if (!isOrdered(brief)) return preferred;
  const ranked = brief.priorityOrder ?? [];
  return [...ranked, ...preferred.filter((dimension) => !ranked.includes(dimension))];
}

const EXCLUSIONS = [
  ["exclude-industry", "industry"],
  ["exclude-title", "title"],
  ["exclude-city", "city"],
  ["exclude-state", "state"],
  ["exclude-employees", "employees"],
] as const satisfies readonly (readonly [BriefItemId, BriefField])[];

/**
 * Everything the brief says, one item each, in a fixed order: goal; must-haves (location, then
 * industry, title, company size); preferences (in importance order), then the importance order
 * itself when there is one; exclusions (industry, title, city, state, company size); list size;
 * assumptions. Items with nothing set are left out, except list size and assumptions
 * ("No assumptions.").
 */
export function describeBrief(brief: SearchBrief): BriefItem[] {
  const items: BriefItem[] = [{ id: "goal", section: "intent", text: GOALS[brief.intent] }];
  const push = (id: BriefItemId, section: BriefSection, text: string | null) => {
    if (text !== null) items.push({ id, section, text });
  };

  const place = placeText(brief.mustHaves, "and");
  push("must-geo", "mustHaves", place && `Must be in ${place}.`);
  const industry = fieldText(brief.mustHaves, "industry", "and");
  push("must-industry", "mustHaves", industry && `Industry must be ${industry}.`);
  const title = fieldText(brief.mustHaves, "title", "and");
  push("must-title", "mustHaves", title && `Title must be ${title}.`);
  const employees = fieldText(brief.mustHaves, "employees", "and");
  push("must-employees", "mustHaves", employees && `Must have ${employees}.`);

  const order = preferenceOrder(brief);
  for (const dimension of order) push(PREFERENCE_IDS[dimension], "preferences", preferenceText(brief, dimension));
  if (isOrdered(brief)) {
    const names = (brief.priorityOrder ?? []).map((dimension) => DIMENSION_NAMES[dimension]);
    push("priority", "preferences", `Most important first: ${names.join(", ")}.`);
  }

  for (const [id, field] of EXCLUSIONS) {
    const values = fieldText(brief.exclusions, field, "or");
    push(id, "exclusions", values && `Leave out ${values}.`);
  }

  push("list-size", "listSize", `Show ${number(brief.listSize)}.`);

  const assumptions = brief.assumptions.filter((assumption) => assumption !== "");
  if (assumptions.length === 0) push("assumptions", "assumptions", "No assumptions.");
  for (const assumption of assumptions) push("assumptions", "assumptions", assumption);
  return items;
}

/**
 * The summary's lines: every item is its own line, except the preferences, which make one
 * sentence: "Prefer Fabrication, Owner, 10 to 99 employees." or, when ordered,
 * "Prefer, most important first: 1. Owner, 2. Fabrication, 3. 10 to 99 employees." A preferred
 * dimension the priority order doesn't list follows as "Also prefer ...".
 */
export function describeLines(brief: SearchBrief): BriefLine[] {
  const lines: BriefLine[] = [];
  let preferences: BriefLine | null = null;
  for (const item of describeBrief(brief)) {
    if (item.section !== "preferences") {
      lines.push({ section: item.section, text: item.text, items: [item] });
      continue;
    }
    if (!preferences) {
      preferences = { section: "preferences", text: "", items: [] };
      lines.push(preferences);
    }
    preferences.items.push(item);
  }
  if (preferences) preferences.text = preferenceSentence(brief, preferences.items);
  return lines;
}

/** The Preferences sentence from its items. */
function preferenceSentence(brief: SearchBrief, items: readonly BriefItem[]): string {
  const parts = items.filter((item) => item.id !== "priority").map((item) => item.text);
  if (!isOrdered(brief)) return `Prefer ${parts.join(", ")}.`;
  const ranked = parts.slice(0, (brief.priorityOrder ?? []).length);
  const rest = parts.slice(ranked.length);
  const sentence = `Prefer, most important first: ${ranked.map((part, i) => `${i + 1}. ${part}`).join(", ")}.`;
  return rest.length === 0 ? sentence : `${sentence} Also prefer ${rest.join(", ")}.`;
}
