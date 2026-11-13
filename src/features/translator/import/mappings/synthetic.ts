import { REQUIRED_FIELDS } from "../fields";
import type { LayoutMapping } from "./types";

/** The 9-column synthetic workbook used for the spec walkthroughs (docs/translator/JCA_Synthetic_Contacts.xlsx). */
export const SYNTHETIC_MAPPING: LayoutMapping = {
  id: "synthetic",
  label: "Synthetic",
  detectHeaders: ["Record ID", "Company"],
  requiredFields: REQUIRED_FIELDS,
  fields: {
    recordId: { kind: "generatedId", header: "Record ID" },
    company: { kind: "column", header: "Company" },
    city: { kind: "column", header: "City" },
    state: { kind: "column", header: "State" },
    industry: { kind: "column", header: "Industry" },
    employees: { kind: "column", header: "Employees" },
    title: { kind: "column", header: "Title" },
    name: { kind: "column", header: "Name" },
    email: { kind: "column", header: "Email" },
    phone: { kind: "none" },
    website: { kind: "none" },
    address: { kind: "none" },
    zip: { kind: "none" },
    naicsDescription: { kind: "none" },
    employeeRange: { kind: "none" },
    otherExecutives: { kind: "none" },
  },
};
