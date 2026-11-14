import { BRIEF_DIMENSIONS, FIELD_DIMENSION, type BriefDimension, type BriefField } from "../criteria/schema";

/**
 * The scoring constants (TR-18). `score.ts` turns them into the weights for one brief.
 *
 * Pure: no React, no I/O, no logging.
 */

/**
 * The scored dimensions, in default order. Weights are computed and breakdowns listed in this
 * order, and dimensions missing from `priorityOrder` are appended in it. The same list as
 * `BRIEF_DIMENSIONS` in the schema, so `priorityOrder` and scoring can never disagree.
 */
export const DIMENSIONS: readonly BriefDimension[] = BRIEF_DIMENSIONS;

/**
 * Points per dimension when the brief has no `priorityOrder`. Only active dimensions (those with a
 * preference) count, and the score is scaled by their total, so these are relative, not a budget.
 */
export const DEFAULT_WEIGHTS: Readonly<Record<BriefDimension, number>> = {
  industry: 35,
  geography: 30,
  title: 25,
  employees: 10,
};

/**
 * Points by position when the brief has a `priorityOrder`: the most important dimension gets 4,
 * the next 3, then 2, then 1. There are four dimensions, so there are four weights.
 */
export const ORDERED_WEIGHTS: readonly number[] = [4, 3, 2, 1];

/** The dimension each field is scored under: city and state both go to geography. Same map as the schema's. */
export const FIELD_TO_DIMENSION: Readonly<Record<BriefField, BriefDimension>> = FIELD_DIMENSION;
