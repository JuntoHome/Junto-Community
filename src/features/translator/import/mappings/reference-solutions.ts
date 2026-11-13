import { REQUIRED_FIELDS } from "../fields";
import type { LayoutMapping } from "./types";

/**
 * The Data Axle Reference Solutions detailed business export: 396 columns, one row per business
 * (headers in docs/translator/JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx). Every column not
 * named here is ignored, including the unnamed last column and the Executive Gender columns.
 *
 * Exports vary, so detection needs only the headers a file can't be ranked without, not all 396.
 */
export const REFERENCE_SOLUTIONS_MAPPING: LayoutMapping = {
  id: "reference-solutions",
  label: "Reference Solutions",
  detectHeaders: ["Company Name", "City", "State", "Primary SIC Description"],
  requiredFields: REQUIRED_FIELDS,
  fields: {
    recordId: { kind: "generatedId", header: "IUSA Number" },
    company: { kind: "column", header: "Company Name" },
    city: { kind: "column", header: "City" },
    state: { kind: "column", header: "State" },
    industry: { kind: "column", header: "Primary SIC Description" },
    employees: { kind: "column", header: "Location Employee Size Actual" },
    title: { kind: "firstNonBlank", headers: ["Executive Title", "Professional Title"] },
    name: { kind: "join", headers: ["Executive First Name", "Executive Last Name"] },
    // Real exports have no email column; phone and website are the contact fallbacks.
    email: { kind: "none" },
    phone: { kind: "column", header: "Phone Number Combined" },
    website: { kind: "column", header: "Website" },
    address: { kind: "column", header: "Address" },
    zip: { kind: "column", header: "ZIP Code" },
    naicsDescription: { kind: "column", header: "Primary NAICS Description" },
    employeeRange: { kind: "column", header: "Location Employee Size Range" },
    // The main contact (unnumbered columns above) is kept separate, even when slot 1 repeats it.
    otherExecutives: {
      kind: "repeated",
      slots: 50,
      nameHeaders: ["Executive First Name", "Executive Last Name"],
      titleHeader: "Executive Title",
    },
  },
};
