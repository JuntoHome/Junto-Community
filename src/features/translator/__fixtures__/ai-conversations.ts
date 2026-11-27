/**
 * The user's side of the AI walkthrough conversations (TR-53): which script answers and what the
 * user types, in order. `ai/walkthroughs.test.ts` runs them for their results; the TR-54 privacy
 * and determinism tests replay them through the route. The AI's side is in
 * `walkthroughs/ai-<script>.json`; the scripted fake throws on a message its script doesn't
 * expect, so the two can't drift apart quietly.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export type AiConversation = {
  /** The script name, for `loadAiScript()`. */
  script: string;
  /** What the user types, one message per turn. */
  messages: readonly string[];
  /** The Results step's chat, from the confirmed business owner brief (TR-46), or the Criteria step's. */
  step: "criteria" | "results";
};

export const AI_CONVERSATIONS = {
  businessOwner: {
    script: "business-owner",
    messages: ["I sell welding supplies, looking for customers in Phoenix", "Owners, please", "10 to 99 employees, and 40 businesses"],
    step: "criteria",
  },
  roleChange: { script: "role-change", messages: ["prefer operations managers instead"], step: "results" },
  jobSeeker: {
    script: "job-seeker",
    messages: ["looking for logistics employers in Tempe", "operations managers, 10 to 99 employees, 30 of them"],
    step: "criteria",
  },
  ambiguous: { script: "ambiguous", messages: ["Phoenix area"], step: "criteria" },
  notInFile: { script: "not-in-file", messages: ["customers in Flagstaff"], step: "criteria" },
  inFile: { script: "not-in-file", messages: ["customers in Scottsdale"], step: "criteria" },
} as const satisfies Record<string, AiConversation>;
