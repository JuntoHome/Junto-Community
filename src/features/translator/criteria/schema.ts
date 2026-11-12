import { z } from "zod";

/**
 * The Translator's criteria: what the user is looking for. The Phase 1 form fills a
 * SearchBrief, and the Phase 2 AI will fill the same object, so there is only one shape.
 *
 * Example from the spec, a business owner looking for Phoenix fabrication owners:
 *
 *   {
 *     intent: "business_owner",
 *     mustHaves: [
 *       { field: "city", operator: "equals", value: "Phoenix" },
 *       { field: "state", operator: "equals", value: "AZ" },
 *     ],
 *     preferences: [
 *       { field: "industry", operator: "equals", value: "Fabrication" },
 *       { field: "title", operator: "equals", value: "Owner" },
 *       { field: "employees", operator: "range", value: { min: 10, max: 99 } },
 *     ],
 *     exclusions: [],
 *     listSize: 40,
 *     assumptions: [],
 *   }
 *
 * Values are only trimmed here. Matching case and spelling is the normalize step's job (TR-10).
 * This module is pure (no React, no I/O) so it runs in the browser and on the server.
 */

/** Bump when the ranking rules change, so an export says which rules produced it. */
export const SCORING_VERSION = "1.0";

/** What the user wants the list for. */
export const BRIEF_INTENTS = ["business_owner", "job_seeker"] as const;
export type BriefIntent = (typeof BRIEF_INTENTS)[number];

/** The internal fields a criterion can test (see the field mapping in docs/translator/README.md). */
export const BRIEF_FIELDS = ["city", "state", "industry", "title", "employees"] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

/** How a criterion compares a field with its value. */
export const BRIEF_OPERATORS = ["equals", "in", "range"] as const;
export type BriefOperator = (typeof BRIEF_OPERATORS)[number];

const TEXT_FIELDS = ["city", "state", "industry", "title"] as const satisfies readonly BriefField[];
const RANGE_FIELDS = ["employees"] as const satisfies readonly BriefField[];

/** The fields each operator works with. */
export const OPERATOR_FIELDS: Record<BriefOperator, readonly BriefField[]> = {
  equals: TEXT_FIELDS,
  in: TEXT_FIELDS,
  range: RANGE_FIELDS,
};

/** Most priorities a user can order; the ranking weights them 4, 3, 2, 1. */
export const PRIORITY_MAX = 4;

export const LIST_SIZE_MIN = 1;
export const LIST_SIZE_MAX = 100;
export const LIST_SIZE_DEFAULT = 40;

// Messages. They name the problem and say how to fix it.
const orList = (items: readonly string[]) => `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
const quoted = (value: unknown) => (typeof value === "string" ? `"${value}"` : String(JSON.stringify(value)));
const FIELD_LIST = orList(BRIEF_FIELDS);
const OPERATOR_LIST = orList(BRIEF_OPERATORS);
const isBriefField = (value: unknown): value is BriefField => (BRIEF_FIELDS as readonly unknown[]).includes(value);

const fieldProblem = (input: unknown, wrongOperator: string) => {
  if (input === undefined) return `Choose a field: ${FIELD_LIST}.`;
  if (!isBriefField(input)) return `Unsupported field ${quoted(input)}. Use ${FIELD_LIST}.`;
  return wrongOperator;
};

const unknownKeys = (keys: string[], allowed: string) =>
  `Unknown ${keys.length === 1 ? "key" : "keys"} ${keys.map(quoted).join(", ")}. ${allowed}`;

const CRITERION_SHAPE = 'Each criterion needs a field, an operator and a value, e.g. { field: "city", operator: "equals", value: "Phoenix" }.';
const EQUALS_VALUE = '"equals" needs a value with text in it, e.g. "Phoenix".';
const IN_VALUE = '"in" needs a list of one or more values, e.g. ["Phoenix", "Tempe"].';
const IN_ITEM = 'Each value in an "in" list needs text in it. Remove any empty values.';
const RANGE_VALUE = '"range" needs a min and a max, e.g. { min: 10, max: 99 }.';
const RANGE_NUMBER = "min and max must be whole numbers of 0 or more, e.g. { min: 10, max: 99 }.";
const LIST_SIZE = `List size must be a whole number from ${LIST_SIZE_MIN} to ${LIST_SIZE_MAX}.`;

/** Errors for a strict object: unknown keys are named; anything else gets `otherwise`, or zod's default. */
const keysError =
  (allowed: string, otherwise?: string): z.core.$ZodErrorMap =>
  (iss) =>
    iss.code === "unrecognized_keys" ? unknownKeys(iss.keys, allowed) : otherwise;

const CRITERION_KEYS = keysError("A criterion has only field, operator and value.");

/** A trimmed string that isn't empty. */
const text = (message: string) => z.string({ error: message }).trim().min(1, { error: message });

/** One field of text, e.g. city equals "Phoenix". */
const equalsCriterion = z.strictObject(
  {
    field: z.enum(TEXT_FIELDS, {
      error: (iss) => fieldProblem(iss.input, '"equals" doesn\'t work with employees. Use "range", e.g. { min: 10, max: 99 }.'),
    }),
    operator: z.literal("equals"),
    value: text(EQUALS_VALUE),
  },
  { error: CRITERION_KEYS },
);

/** Any one of several values, e.g. city in ["Phoenix", "Tempe"]. */
const inCriterion = z.strictObject(
  {
    field: z.enum(TEXT_FIELDS, {
      error: (iss) => fieldProblem(iss.input, '"in" doesn\'t work with employees. Use "range", e.g. { min: 10, max: 99 }.'),
    }),
    operator: z.literal("in"),
    value: z.array(text(IN_ITEM), { error: IN_VALUE }).min(1, { error: IN_VALUE }),
  },
  { error: CRITERION_KEYS },
);

/** A whole number of 0 or more. */
const count = z.int({ error: RANGE_NUMBER }).min(0, { error: RANGE_NUMBER });

/** An inclusive number range, e.g. employees from 10 to 99. Only for employees. */
const rangeCriterion = z.strictObject(
  {
    field: z.enum(RANGE_FIELDS, {
      error: (iss) =>
        fieldProblem(iss.input, `"range" only works with employees. For ${String(iss.input)}, use "equals" or "in".`),
    }),
    operator: z.literal("range"),
    value: z
      .strictObject(
        { min: count, max: count },
        { error: keysError("A range has only min and max.", RANGE_VALUE) },
      )
      .superRefine((range, ctx) => {
        if (range.min > range.max) {
          ctx.addIssue({
            code: "custom",
            message: `min (${range.min}) is bigger than max (${range.max}). Swap them so min is the smaller number.`,
          });
        }
      }),
  },
  { error: CRITERION_KEYS },
);

/** One test on one field: { field, operator, value }. The operator decides what value holds. */
export const criterionSchema = z.discriminatedUnion("operator", [equalsCriterion, inCriterion, rangeCriterion], {
  error: (iss) => {
    if (iss.code !== "invalid_union") return CRITERION_SHAPE;
    const operator = (iss.input as { operator?: unknown } | undefined)?.operator;
    return operator === undefined
      ? `Choose an operator: ${OPERATOR_LIST}.`
      : `Unsupported operator ${quoted(operator)}. Use ${OPERATOR_LIST}.`;
  },
});

export type BriefCriterion = z.infer<typeof criterionSchema>;

/** A list of criteria; empty when not given. */
const criteria = (name: string) => z.array(criterionSchema, { error: `${name} must be a list of criteria.` }).default([]);

const BRIEF_KEYS = "A search brief has only intent, mustHaves, preferences, exclusions, priorityOrder, listSize and assumptions.";

export const searchBriefSchema = z
  .strictObject(
    {
      /** What the list is for: finding customers (business_owner) or employers (job_seeker). */
      intent: z.enum(BRIEF_INTENTS, { error: 'Choose a goal: "business_owner" or "job_seeker".' }),
      /** Rows must match all of these to be eligible. A missing value fails. E.g. city equals Phoenix. */
      mustHaves: criteria("mustHaves"),
      /** Matches add to a row's score. A missing value scores 0. E.g. title equals Owner. */
      preferences: criteria("preferences"),
      /** Rows that match any of these are removed first. A missing value is not a match. */
      exclusions: criteria("exclusions"),
      /**
       * Optional: preference fields from most to least important, e.g. ["industry", "title"].
       * When given, the ranking uses weights 4, 3, 2, 1 instead of the defaults.
       * Each field once, at most 4, and each must have a preference.
       */
      priorityOrder: z
        .array(
          z.enum(BRIEF_FIELDS, { error: (iss) => `Unsupported field ${quoted(iss.input)}. Use ${FIELD_LIST}.` }),
          { error: "priorityOrder must be a list of fields." },
        )
        .max(PRIORITY_MAX, { error: `priorityOrder can list at most ${PRIORITY_MAX} fields.` })
        .optional(),
      /** How many rows the shortlist holds: 1 to 100, 40 by default. Fewer when fewer rows are eligible. */
      listSize: z
        .int({ error: LIST_SIZE })
        .min(LIST_SIZE_MIN, { error: LIST_SIZE })
        .max(LIST_SIZE_MAX, { error: LIST_SIZE })
        .default(LIST_SIZE_DEFAULT),
      /** Plain-language notes on anything assumed while filling the brief, e.g. "No exclusions given." */
      assumptions: z
        .array(z.string({ error: "Each assumption must be text." }).trim(), {
          error: "assumptions must be a list of text.",
        })
        .default([]),
    },
    { error: keysError(BRIEF_KEYS, 'A search brief must be an object with an intent, e.g. { intent: "business_owner" }.') },
  )
  .superRefine((brief, ctx) => {
    const preferred = new Set(brief.preferences.map((criterion) => criterion.field));
    const seen = new Set<BriefField>();
    for (const [index, field] of (brief.priorityOrder ?? []).entries()) {
      const path = ["priorityOrder", index];
      if (seen.has(field)) {
        ctx.addIssue({ code: "custom", path, message: `priorityOrder lists "${field}" more than once. List each field once.` });
      } else if (!preferred.has(field)) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `priorityOrder lists "${field}", but there is no ${field} preference. Add one, or remove "${field}" from priorityOrder.`,
        });
      }
      seen.add(field);
    }
  });

/** The criteria for one search, after validation and defaults. */
export type SearchBrief = z.infer<typeof searchBriefSchema>;
