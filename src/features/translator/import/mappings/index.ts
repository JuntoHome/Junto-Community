import { REFERENCE_SOLUTIONS_MAPPING } from "./reference-solutions";
import { SYNTHETIC_MAPPING } from "./synthetic";
import type { LayoutMapping } from "./types";

/**
 * Every layout the parser can recognise. The one with the most signature headers in row 1 wins
 * (see `detectLayout()` in parse.ts), so the order here doesn't matter. A new input layout is a
 * new mapping file added here.
 */
export const LAYOUT_MAPPINGS: readonly LayoutMapping[] = [SYNTHETIC_MAPPING, REFERENCE_SOLUTIONS_MAPPING];
