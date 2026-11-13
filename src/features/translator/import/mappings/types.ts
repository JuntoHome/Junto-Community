import type { RequiredField, TextField } from "../fields";

/**
 * How a layout's source columns fill the internal fields. A mapping is plain config: the
 * rule kinds below are the only vocabulary, and map-row.ts is the only code that reads them.
 *
 * Header names are written exactly as they appear in the source file. They are matched after
 * trimming the ends and ignoring case; inner spacing must match ("Advertising  Expenses" has two).
 */

export const MAPPING_IDS = ["synthetic", "reference-solutions"] as const;
export type MappingId = (typeof MAPPING_IDS)[number];

/** One column's value. */
export type ColumnRule = { kind: "column"; header: string };

/** Several columns joined with a space, skipping blanks. Null when all are blank. */
export type JoinRule = { kind: "join"; headers: readonly string[] };

/** The first of these columns that isn't blank. */
export type FirstNonBlankRule = { kind: "firstNonBlank"; headers: readonly string[] };

/** The layout has no such column: the field is always unknown (null, or an empty list). */
export type NoneRule = { kind: "none" };

/** The source ID column, or a "ROW-0001" style ID from the row's position when it is blank or missing. */
export type GeneratedIdRule = { kind: "generatedId"; header: string };

/**
 * Numbered slots: "<header> 1" to "<header> <slots>". Each slot's name joins nameHeaders (like
 * JoinRule) and its title comes from titleHeader. A slot is skipped only when all are blank.
 */
export type RepeatedRule = {
  kind: "repeated";
  slots: number;
  nameHeaders: readonly string[];
  titleHeader: string;
};

export type TextRule = ColumnRule | JoinRule | FirstNonBlankRule | NoneRule;

/** One rule for every internal field. */
export type FieldRules = {
  recordId: GeneratedIdRule;
  otherExecutives: RepeatedRule | NoneRule;
} & Record<TextField, TextRule>;

export type LayoutMapping = {
  id: MappingId;
  /** Shown to the user, e.g. on the Preview step. */
  label: string;
  /**
   * Source headers that recognise this layout, and nothing else. Each must be a header the other
   * layouts don't have. The layout with the most of them in row 1 wins, if it has at least 2 (TR-09).
   */
  signatureHeaders: readonly string[];
  /**
   * Source headers a file in this layout can't be used without, in the order they are listed in
   * the "Missing required columns" message (TR-09). They feed `requiredFields`.
   */
  requiredHeaders: readonly string[];
  /** Internal fields a file must provide to be ranked. */
  requiredFields: readonly RequiredField[];
  fields: FieldRules;
};
