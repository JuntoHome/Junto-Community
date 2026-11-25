import { describe, expect, it } from "vitest";
import { initialCriteriaMode, MODE_ANNOUNCEMENT } from "./criteria-mode";

describe("initialCriteriaMode", () => {
  it("starts on the chooser when the AI is on", () => {
    expect(initialCriteriaMode(true)).toBe("choose");
  });

  it("starts on the form when the AI is off, exactly like Phase 1", () => {
    expect(initialCriteriaMode(false)).toBe("form");
  });
});

describe("MODE_ANNOUNCEMENT", () => {
  it("says which panel opened", () => {
    expect(MODE_ANNOUNCEMENT).toEqual({ chat: "Showing the chat.", form: "Showing the form." });
  });
});
