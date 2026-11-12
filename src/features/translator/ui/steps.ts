/** The Translator's five steps, in order. */
export const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "criteria", label: "Criteria" },
  { id: "results", label: "Results" },
  { id: "export", label: "Export" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** A step can be opened once every step before it is done. Upload is always open. */
export function isStepAvailable(id: StepId, done: ReadonlySet<StepId>): boolean {
  const index = STEPS.findIndex((step) => step.id === id);
  return STEPS.slice(0, index).every((step) => done.has(step.id));
}
