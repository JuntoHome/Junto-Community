import { REFERENCE_SOLUTIONS_MAPPING } from "./reference-solutions";
import { SYNTHETIC_MAPPING } from "./synthetic";
import type { LayoutMapping } from "./types";

/**
 * Every layout the parser can recognise, in the order it tries them: the first mapping whose
 * detection headers are all in row 1 wins. A new input layout is a new mapping file added here.
 */
export const LAYOUT_MAPPINGS: readonly LayoutMapping[] = [SYNTHETIC_MAPPING, REFERENCE_SOLUTIONS_MAPPING];
