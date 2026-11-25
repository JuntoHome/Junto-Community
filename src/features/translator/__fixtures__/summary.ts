import type { FileSummary } from "../ai/summary";

/**
 * A small valid file summary (TR-40) for the route and interview tests. Every value is made up.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export const EXAMPLE_SUMMARY: FileSummary = {
  layout: "synthetic",
  uniqueRecords: 3,
  cities: [
    { value: "Phoenix", count: 2 },
    { value: "Tempe", count: 1 },
  ],
  states: [{ value: "AZ", count: 3 }],
  industries: [{ value: "Fabrication", count: 3 }],
  titles: [{ value: "Owner", count: 3 }],
  employees: { min: 10, max: 40, withValue: 2, blank: 1 },
  truncated: { cities: false, states: false, industries: false, titles: false },
};
