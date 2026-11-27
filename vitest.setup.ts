import { vi } from "vitest";

/**
 * Runs before every test file (registered in `vitest.config.ts`, TR-53). Tests must never call
 * OpenAI: any test that imports the real `openai` SDK, directly or through `ai/client.ts`, fails
 * at once with the message below. Use the fake AI (`src/features/translator/__fixtures__/fake-ai.ts`).
 * A test file that mocks `openai` itself (`ai/client.test.ts`) replaces this with its own stand-in.
 */
vi.mock("openai", () => {
  throw new Error("Tests must not import the OpenAI SDK. Use the fake AI.");
});
