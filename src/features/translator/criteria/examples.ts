import type { SearchBrief } from "./schema";

/**
 * The two briefs from the spec walkthroughs, for tests and demos.
 * Expected results (docs/translator/README.md) with the synthetic workbook:
 * business owner gives 100 eligible, 40 out, SYN-0001 first at 100;
 * job seeker gives 100 eligible, 30 out, SYN-0002 first at 100.
 */

/** A business owner looking for customers: Phoenix fabrication owners at firms of 10 to 99 people. */
export const BUSINESS_OWNER_BRIEF: SearchBrief = {
  intent: "business_owner",
  mustHaves: [
    { field: "city", operator: "equals", value: "Phoenix" },
    { field: "state", operator: "equals", value: "AZ" },
  ],
  preferences: [
    { field: "industry", operator: "equals", value: "Fabrication" },
    { field: "title", operator: "equals", value: "Owner" },
    { field: "employees", operator: "range", value: { min: 10, max: 99 } },
  ],
  exclusions: [],
  listSize: 40,
  assumptions: [],
};

/** A job seeker looking for employers: Tempe logistics firms of 10 to 99 people, contact an Operations Manager. */
export const JOB_SEEKER_BRIEF: SearchBrief = {
  intent: "job_seeker",
  mustHaves: [
    { field: "city", operator: "equals", value: "Tempe" },
    { field: "state", operator: "equals", value: "AZ" },
  ],
  preferences: [
    { field: "industry", operator: "equals", value: "Logistics" },
    { field: "title", operator: "equals", value: "Operations Manager" },
    { field: "employees", operator: "range", value: { min: 10, max: 99 } },
  ],
  exclusions: [],
  listSize: 30,
  assumptions: [],
};
