import type { TranslatorRecord } from "../fields";
import type { SourceCell } from "../map-row";

/**
 * One invented row in the Reference Solutions layout, and the record mapRow should give for it.
 * Every value is made up. The headers are real export header names, in their export order, but
 * only a subset of the 396: the mapped ones plus a few that must be ignored.
 *
 * What it covers:
 * - IUSA Number is blank, so the ID is generated from the row position (7 gives ROW-0007).
 * - Executive Title is only spaces, so the title falls back to Professional Title.
 * - Executive slot 1 repeats the main contact and is kept (no dedupe against the main contact).
 * - Executive slot 2 has only a gender and a blank title, so it is skipped.
 * - Executive slot 3 has a name and no title.
 * - The employee count is a number cell; it comes out as the text "25", not parsed.
 * - Unmapped columns ("Mailing City", "Advertising  Expenses", the Executive Gender columns) and the
 *   unnamed last column are ignored, even when they have values.
 *
 * TR-29 turns this into a unit test.
 */
const COLUMNS: readonly (readonly [header: SourceCell, value: SourceCell])[] = [
  ["Company Name", "Synthetic Fixture Co 001"],
  ["Parent Company Name", null],
  ["Executive First Name", "Demo"],
  ["Executive Last Name", "Person 001"],
  ["Professional Title", "Owner"],
  ["Executive Title", "   "],
  ["Executive Gender", "F"],
  ["Address", "100 Example Way"],
  ["City", "Phoenix"],
  ["State", "AZ"],
  ["ZIP Code", "85001"],
  ["Phone Number Combined", "(602) 555-0101"],
  ["Website", "www.synthetic-fixture.example"],
  ["Primary SIC Description", "Fabrication"],
  ["Primary NAICS Description", "Structural Metal Fabrication"],
  ["Location Employee Size Range", "20 to 49"],
  ["Location Employee Size Actual", 25],
  ["IUSA Number", ""],
  ["Executive First Name 1", "Demo"],
  ["Executive Last Name 1", "Person 001"],
  ["Executive Title 1", "Owner"],
  ["Executive Gender 1", "F"],
  ["Executive First Name 2", null],
  ["Executive Last Name 2", ""],
  ["Executive Title 2", "  "],
  ["Executive Gender 2", "F"],
  ["Executive First Name 3", "Demo"],
  ["Executive Last Name 3", "Person 002"],
  ["Executive Title 3", null],
  ["Executive Gender 3", "M"],
  ["Advertising  Expenses", "Synthetic value"],
  ["Mailing City", "Tempe"],
  [null, "Synthetic value"],
];

export const RS_FIXTURE_HEADERS: readonly SourceCell[] = COLUMNS.map(([header]) => header);
export const RS_FIXTURE_ROW: readonly SourceCell[] = COLUMNS.map(([, value]) => value);
/** The row's 1-based position among the data rows. */
export const RS_FIXTURE_POSITION = 7;

export const RS_FIXTURE_EXPECTED: TranslatorRecord = {
  recordId: "ROW-0007",
  company: "Synthetic Fixture Co 001",
  city: "Phoenix",
  state: "AZ",
  industry: "Fabrication",
  employees: "25",
  title: "Owner",
  name: "Demo Person 001",
  email: null,
  phone: "(602) 555-0101",
  website: "www.synthetic-fixture.example",
  address: "100 Example Way",
  zip: "85001",
  naicsDescription: "Structural Metal Fabrication",
  employeeRange: "20 to 49",
  otherExecutives: [
    { name: "Demo Person 001", title: "Owner" },
    { name: "Demo Person 002", title: null },
  ],
};
