/**
 * Capability: the current brief as the AI may see it (fix B, after TR-55).
 * Input: the brief the chat sends as `currentBrief` and the file summary sent with it.
 * Output: `briefForAi()` gives the brief with only values the summary holds, and the values it
 * had to leave out; `briefFitsSummary()` says whether a brief already meets that rule.
 *
 * Why: the summary is the privacy wall (TR-40): its values are cleaned, and anything that looks
 * like contact data is left out. A brief from the form can hold any value the pickers offer,
 * which is every value in the file, uncleaned. So the rule is the same for both: a value reaches
 * the AI only when the summary holds it (compared by `matchKey()`), and an assumption only when
 * it is at most MAX_ASSUMPTION_CHARS long, doesn't look like contact data, and is one of at most
 * MAX_ASSUMPTIONS. The browser sends `briefForAi(...).brief`; the route refuses (`400`) a
 * `currentBrief` that doesn't fit its own summary, so even a browser bug can't send more.
 *
 * Privacy: reads only the brief and the summary. Never logs.
 * This module is pure (zod only, no React, no I/O).
 */
import { type BriefCriterion, type BriefField, FIELD_DIMENSION, type SearchBrief, searchBriefSchema } from "../criteria/schema";
import { matchKey } from "../normalize/match-key";
import { cutText, looksLikeContactData, MAX_SUMMARY_VALUE_CHARS } from "./guardrails";
import type { FileSummary } from "./summary";
import { MAX_ASSUMPTION_CHARS, MAX_ASSUMPTIONS } from "./validate";

type TextField = Exclude<BriefField, "employees">;

const SUMMARY_LIST: Record<TextField, "cities" | "states" | "industries" | "titles"> = {
  city: "cities",
  state: "states",
  industry: "industries",
  title: "titles",
};

/** For each text field, the match keys of the summary's values. */
function summaryKeys(summary: FileSummary): Record<TextField, Set<string>> {
  const keys = {} as Record<TextField, Set<string>>;
  for (const field of Object.keys(SUMMARY_LIST) as TextField[]) {
    keys[field] = new Set(summary[SUMMARY_LIST[field]].map(({ value }) => matchKey(value)));
  }
  return keys;
}

const textValues = (criterion: BriefCriterion): string[] =>
  criterion.operator === "range" ? [] : criterion.operator === "equals" ? [criterion.value] : criterion.value;

const allCriteria = (brief: SearchBrief) => [...brief.mustHaves, ...brief.preferences, ...brief.exclusions];

/** An assumption the AI may see: short enough and not contact-looking. */
const assumptionFits = (assumption: string) => assumption.length <= MAX_ASSUMPTION_CHARS && !looksLikeContactData(assumption);

/** True when every text value of `brief` is in `summary` and its assumptions meet the limits. */
export function briefFitsSummary(brief: SearchBrief, summary: FileSummary): boolean {
  const keys = summaryKeys(summary);
  return (
    allCriteria(brief).every((criterion) =>
      criterion.operator === "range" ? true : textValues(criterion).every((value) => keys[criterion.field as TextField].has(matchKey(value))),
    ) &&
    brief.assumptions.length <= MAX_ASSUMPTIONS &&
    brief.assumptions.every(assumptionFits)
  );
}

export type BriefForAi = {
  /** The brief to send as `currentBrief`, or undefined when there is none. */
  brief: SearchBrief | undefined;
  /** The criteria values left out because the summary doesn't hold them, each once, for a note. */
  withheld: string[];
};

/**
 * `brief` with only the values `summary` holds: each value the summary doesn't hold is taken out
 * (an `in` left with one value becomes `equals`, a criterion left with none is removed, and the
 * importance order loses a dimension whose preference went), and assumptions that don't fit are
 * dropped. The values taken out are listed in `withheld`, so the chat can say so. Never changes
 * a value it keeps.
 */
export function briefForAi(brief: SearchBrief | undefined, summary: FileSummary): BriefForAi {
  if (!brief) return { brief: undefined, withheld: [] };
  const keys = summaryKeys(summary);
  const withheld: string[] = [];

  const keep = (criteria: readonly BriefCriterion[]): BriefCriterion[] =>
    criteria.flatMap((criterion): BriefCriterion[] => {
      if (criterion.operator === "range") return [criterion];
      const field = criterion.field as TextField;
      const values = textValues(criterion);
      const fits = values.filter((value) => keys[field].has(matchKey(value)));
      withheld.push(...values.filter((value) => !keys[field].has(matchKey(value))));
      if (fits.length === 0) return [];
      return fits.length === 1 ? [{ field, operator: "equals", value: fits[0] }] : [{ field, operator: "in", value: fits }];
    });

  const mustHaves = keep(brief.mustHaves);
  const preferences = keep(brief.preferences);
  const exclusions = keep(brief.exclusions);
  const preferred = new Set(preferences.map((criterion) => FIELD_DIMENSION[criterion.field]));
  const priorityOrder = (brief.priorityOrder ?? []).filter((dimension) => preferred.has(dimension));
  const candidate = {
    intent: brief.intent,
    mustHaves,
    preferences,
    exclusions,
    ...(priorityOrder.length > 0 && { priorityOrder }),
    listSize: brief.listSize,
    assumptions: brief.assumptions.filter(assumptionFits).slice(0, MAX_ASSUMPTIONS),
  };
  const checked = searchBriefSchema.safeParse(candidate);
  const shown = [...new Set(withheld.map((value) => cutText(value.replace(/\s+/g, " ").trim(), MAX_SUMMARY_VALUE_CHARS)))];
  return { brief: checked.success ? checked.data : undefined, withheld: shown };
}
