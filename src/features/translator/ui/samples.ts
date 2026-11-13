/** A bundled workbook of fictional records that reviewers can load with one click. */
export type SampleWorkbook = {
  id: string;
  /** Button text. */
  label: string;
  /** Where the file is served from (`public/`). */
  path: string;
  /** Name given to the loaded `File`, as if the user had uploaded it. */
  fileName: string;
};

/** MIME type given to a loaded sample, the same one a browser reports for an uploaded .xlsx. */
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * One button per entry on the Upload step. The files are fictional, so they are served
 * from `public/translator/` without a login; don't link them from any public page.
 * TR-35 adds the Reference Solutions layout sample here.
 */
export const SAMPLE_WORKBOOKS: readonly SampleWorkbook[] = [
  {
    id: "synthetic",
    label: "Load sample (500 fictional records)",
    // Byte-identical copy of docs/translator/JCA_Synthetic_Contacts.xlsx (same SHA-256; TR-07's file gate checks it).
    path: "/translator/JCA_Synthetic_Contacts.xlsx",
    fileName: "JCA_Synthetic_Contacts.xlsx",
  },
];
