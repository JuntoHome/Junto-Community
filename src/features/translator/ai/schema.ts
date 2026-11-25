/**
 * Capability: the shape of the AI's interview reply (TR-42).
 * - `interviewReplySchema`: the app's check. Reuses `searchBriefSchema`, so there is one brief shape.
 * - `interviewReplyJsonSchema`: the transport schema sent to OpenAI as structured output. Only for
 *   OpenAI: never use it as the app's type or to check a reply.
 * - `fromTransport()`: turns the transport's `null` for "not given" back into a missing key.
 *
 * Why two: OpenAI's strict structured output needs every key required, `additionalProperties:
 * false`, no `oneOf` and no `default`. `z.toJSONSchema(interviewReplySchema)` gives `oneOf` for
 * the criterion union, `default` for the lists and an optional `priorityOrder`, and OpenAI
 * rejects it ("'oneOf' is not permitted"). So the transport schema is written out here, from the
 * same constants as the brief, and the full zod check on the server stays the real gate.
 *
 * Privacy: shapes only, no data. This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import { BRIEF_DIMENSIONS, BRIEF_INTENTS, OPERATOR_FIELDS, searchBriefSchema } from "../criteria/schema";

/** Longest message the AI may show, in characters. */
export const MAX_REPLY_MESSAGE_CHARS = 800;

export const interviewReplySchema = z
  .object({
    message: z.string().min(1).max(MAX_REPLY_MESSAGE_CHARS), // what the user sees
    proposal: searchBriefSchema.nullable(), // null while still asking questions
  })
  .strict();

export type InterviewReply = z.infer<typeof interviewReplySchema>;

/** The name OpenAI gets for the format. */
export const INTERVIEW_REPLY_FORMAT_NAME = "interview_reply";

/** A closed object: every key required, nothing else allowed (strict mode needs both). */
const closedObject = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const oneOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

/** One criterion per operator, from OPERATOR_FIELDS, so a new field or operator shows up here. */
const transportCriterion = {
  anyOf: [
    closedObject({ field: oneOf(OPERATOR_FIELDS.equals), operator: oneOf(["equals"]), value: { type: "string" } }),
    closedObject({
      field: oneOf(OPERATOR_FIELDS.in),
      operator: oneOf(["in"]),
      value: { type: "array", items: { type: "string" } },
    }),
    closedObject({
      field: oneOf(OPERATOR_FIELDS.range),
      operator: oneOf(["range"]),
      value: closedObject({ min: { type: "integer" }, max: { type: "integer" } }),
    }),
  ],
};

const transportCriteria = { type: "array", items: transportCriterion };

/**
 * The brief for transport: the keys with a default are required and never null, the optional
 * `priorityOrder` is nullable (`fromTransport()` removes a null), and there are no refinements:
 * list size, ranges and the cross-field rules are checked by `searchBriefSchema` on the server.
 */
const transportBrief = closedObject({
  intent: oneOf(BRIEF_INTENTS),
  mustHaves: transportCriteria,
  preferences: transportCriteria,
  exclusions: transportCriteria,
  priorityOrder: { anyOf: [{ type: "array", items: oneOf(BRIEF_DIMENSIONS) }, { type: "null" }] },
  listSize: { type: "integer" },
  assumptions: { type: "array", items: { type: "string" } },
});

/** The JSON Schema sent to OpenAI (strict structured output). Transport only. */
export const interviewReplyJsonSchema = closedObject({
  message: { type: "string" },
  proposal: { anyOf: [transportBrief, { type: "null" }] },
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A transport reply made ready for `interviewReplySchema`: a proposal key whose value is null
 * ("not given", such as `priorityOrder`) is removed. Anything else is passed on unchanged, so
 * the zod check sees it as it came.
 */
export function fromTransport(raw: unknown): unknown {
  if (!isPlainObject(raw) || !isPlainObject(raw.proposal)) return raw;
  const proposal = Object.fromEntries(Object.entries(raw.proposal).filter(([, value]) => value !== null));
  return { ...raw, proposal };
}
