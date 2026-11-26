import { describe, expect, it } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { briefChips } from "../criteria/chips";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import {
  buildChatRequest,
  canSend,
  CHAT_TEXT,
  type ChatAction,
  chatReducer,
  type ChatState,
  characterCount,
  currentBriefFor,
  GREETING,
  initialChatState,
  interpretResponse,
  latestAnnouncement,
  limitReached,
  PROPOSAL_TEXT,
} from "./chat-session";
import { MAX_MESSAGES } from "./request-schema";

/** Applies the actions in order, starting from a new chat. */
function run(...actions: ChatAction[]): ChatState {
  return actions.reduce(chatReducer, initialChatState());
}

const send = (text: string): ChatAction => ({ type: "send", text });
const received = (requestId: number, changes: Partial<Extract<ChatAction, { type: "received" }>> = {}): ChatAction => ({
  type: "received",
  requestId,
  reply: "Which industries matter most?",
  note: null,
  proposal: null,
  ...changes,
});

/** A chat with `exchanges` sent and answered. */
function chatWith(exchanges: number): ChatState {
  let state = initialChatState();
  for (let i = 1; i <= exchanges; i += 1) {
    state = chatReducer(state, send(`Message ${i}`));
    state = chatReducer(state, received(state.requestId, { reply: `Reply ${i}` }));
  }
  return state;
}

describe("initialChatState", () => {
  it("starts with one assistant item, the exact greeting", () => {
    const state = initialChatState();
    expect(state.items).toEqual([{ id: "greeting", role: "assistant", content: GREETING }]);
    expect(GREETING).toBe("What would make this list useful to you? For example, finding customers in Phoenix.");
    expect(state).toMatchObject({ status: "idle", error: null, proposal: null, lastValidBrief: null, draft: "" });
  });
});

describe("chatReducer", () => {
  it("send adds the user item, waits, starts a new request and empties the box", () => {
    const state = run({ type: "edit", text: "  I want owners in Phoenix  " }, send("  I want owners in Phoenix  "));
    expect(state.items.at(-1)).toEqual({ id: "user-1", role: "user", content: "I want owners in Phoenix" });
    expect(state).toMatchObject({ status: "waiting", requestId: 1, draft: "" });
  });

  it("received with no proposal adds the AI reply and goes back to idle", () => {
    const state = run(send("I want owners in Phoenix"), received(1));
    expect(state.items.map((item) => item.role)).toEqual(["assistant", "user", "assistant"]);
    expect(state.items.at(-1)?.content).toBe("Which industries matter most?");
    expect(state).toMatchObject({ status: "idle", error: null, proposal: null, lastValidBrief: null });
  });

  it("received with a proposal sets proposal and lastValidBrief", () => {
    const state = run(send("Owners in Phoenix"), received(1, { proposal: BUSINESS_OWNER_BRIEF }));
    expect(state.proposal).toEqual(BUSINESS_OWNER_BRIEF);
    expect(state.lastValidBrief).toEqual(BUSINESS_OWNER_BRIEF);
  });

  it("a later reply with no proposal keeps the last one", () => {
    const state = run(
      send("Owners in Phoenix"),
      received(1, { proposal: BUSINESS_OWNER_BRIEF }),
      send("Why Fabrication?"),
      received(2),
    );
    expect(state.proposal).toEqual(BUSINESS_OWNER_BRIEF);
    expect(state.lastValidBrief).toEqual(BUSINESS_OWNER_BRIEF);
  });

  it("received with a note adds a note item, which the request leaves out", () => {
    const note = "I couldn't use Mesa: it isn't in this file. Your last criteria are kept.";
    const state = run(send("Owners in Mesa"), received(1, { note }));
    expect(state.items.at(-1)).toEqual({ id: "note-1", role: "note", content: note });

    const request = buildChatRequest(state, EXAMPLE_SUMMARY, undefined);
    expect(request.messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "Owners in Mesa" },
      { role: "assistant", content: "Which industries matter most?" },
    ]);
    expect(JSON.stringify(request)).not.toContain(note);
  });

  it("failed removes the user item, keeps the server's text and puts the message back in the box", () => {
    const failure = interpretResponse(
      504,
      JSON.stringify({ ok: false, error: "The AI took too long to answer. Try again, or use the form." }),
    );
    const state = run(send("Owners in Phoenix"), { ...failure, requestId: 1 } as ChatAction);
    expect(state.items).toEqual(initialChatState().items);
    expect(state).toMatchObject({
      status: "error",
      error: "The AI took too long to answer. Try again, or use the form.",
      draft: "Owners in Phoenix",
    });
    // Send retries it.
    expect(canSend(state, state.draft)).toBe(true);
  });

  it("failed keeps anything typed while waiting, after the failed message", () => {
    const state = run(send("Owners in Phoenix"), { type: "edit", text: "and Tempe" }, {
      type: "failed",
      requestId: 1,
      error: CHAT_TEXT.cantReach,
    });
    expect(state.draft).toBe("Owners in Phoenix\nand Tempe");
  });

  it("send clears the last error", () => {
    const state = run(send("Hi"), { type: "failed", requestId: 1, error: "Nope" }, send("Hi"));
    expect(state).toMatchObject({ status: "waiting", error: null });
  });

  it("ignores a stale received after reset (old requestId)", () => {
    const afterReset = run(send("Owners in Phoenix"), { type: "reset" });
    const late = chatReducer(afterReset, received(1, { proposal: BUSINESS_OWNER_BRIEF }));
    expect(late).toBe(afterReset);
  });

  it("ignores a stale failed after reset", () => {
    const afterReset = run(send("Owners in Phoenix"), { type: "reset" });
    expect(chatReducer(afterReset, { type: "failed", requestId: 1, error: "Late" })).toBe(afterReset);
  });

  it("ignores a second reply to the same request", () => {
    const once = run(send("Owners"), received(1));
    expect(chatReducer(once, received(1, { reply: "Again" }))).toBe(once);
  });

  it("ignores send when canSend is false", () => {
    const waiting = run(send("Owners"));
    expect(chatReducer(waiting, send("Another"))).toBe(waiting);
  });

  it("reset goes back to the initial state, clears lastValidBrief and starts a new request number", () => {
    const before = run(
      { type: "edit", text: "typing" },
      send("Owners in Phoenix"),
      received(1, { proposal: BUSINESS_OWNER_BRIEF, note: "A note." }),
      { type: "edit", text: "half typed" },
    );
    const state = chatReducer(before, { type: "reset" });
    expect({ ...state, requestId: 0 }).toEqual(initialChatState());
    expect(state.lastValidBrief).toBeNull();
    expect(state.requestId).toBe(before.requestId + 1);
  });
});

describe("buildChatRequest", () => {
  it("has exactly kind, summary, messages and currentBrief; messages are only { role, content }", () => {
    const state = run(send("Owners in Phoenix"));
    const request = buildChatRequest(state, EXAMPLE_SUMMARY, BUSINESS_OWNER_BRIEF);
    expect(Object.keys(request).sort()).toEqual(["currentBrief", "kind", "messages", "summary"]);
    expect(request.kind).toBe("interview");
    expect(request.summary).toBe(EXAMPLE_SUMMARY);
    expect(request.currentBrief).toBe(BUSINESS_OWNER_BRIEF);
    for (const message of request.messages) expect(Object.keys(message).sort()).toEqual(["content", "role"]);
    expect(request.messages).toEqual([
      { role: "assistant", content: GREETING },
      { role: "user", content: "Owners in Phoenix" },
    ]);
  });

  it("leaves currentBrief out when there is none (the route refuses null)", () => {
    const request = buildChatRequest(run(send("Hi")), EXAMPLE_SUMMARY, undefined);
    expect(Object.keys(request).sort()).toEqual(["kind", "messages", "summary"]);
    expect(JSON.parse(JSON.stringify(request))).not.toHaveProperty("currentBrief");
  });
});

describe("remove-chip (TR-45)", () => {
  const withProposal = () => run(send("Owners in Phoenix"), received(1, { proposal: BUSINESS_OWNER_BRIEF }));
  const chipId = (label: string) =>
    briefChips(BUSINESS_OWNER_BRIEF)
      .flatMap((group) => group.chips)
      .find((chip) => chip.label === label)?.id ?? "";

  it("changes the proposal and the last valid brief together, so the next request sends the edited brief", () => {
    const state = chatReducer(withProposal(), { type: "remove-chip", chipId: chipId("City: Phoenix") });
    const edited = { ...BUSINESS_OWNER_BRIEF, mustHaves: [{ field: "state", operator: "equals", value: "AZ" }] };
    expect(state.proposal).toEqual(edited);
    expect(state.lastValidBrief).toBe(state.proposal);
    const next = chatReducer(state, send("also Tempe"));
    expect(buildChatRequest(next, EXAMPLE_SUMMARY, currentBriefFor(next, null)).currentBrief).toEqual(edited);
  });

  it("keeps the chat, the status and the request number", () => {
    const before = withProposal();
    const state = chatReducer(before, { type: "remove-chip", chipId: chipId("Title: Owner") });
    expect(state.items).toBe(before.items);
    expect(state).toMatchObject({ status: before.status, requestId: before.requestId, draft: before.draft });
  });

  it("does nothing without a proposal, or for a chip that can't be removed", () => {
    const empty = initialChatState();
    expect(chatReducer(empty, { type: "remove-chip", chipId: "mustHaves.0.0" })).toBe(empty);
    const state = withProposal();
    expect(chatReducer(state, { type: "remove-chip", chipId: "goal" })).toBe(state);
  });
});

describe("currentBriefFor", () => {
  const pending = { ...BUSINESS_OWNER_BRIEF, listSize: 30 };

  it("uses the AI's last valid brief first", () => {
    const state = run(send("Owners"), received(1, { proposal: BUSINESS_OWNER_BRIEF }));
    expect(currentBriefFor(state, pending)).toBe(BUSINESS_OWNER_BRIEF);
  });

  it("falls back to the wizard's pending brief, then to none", () => {
    expect(currentBriefFor(initialChatState(), pending)).toBe(pending);
    expect(currentBriefFor(initialChatState(), null)).toBeUndefined();
  });
});

describe("canSend", () => {
  const idle = initialChatState();

  it("is true for a normal message", () => {
    expect(canSend(idle, "Owners in Phoenix")).toBe(true);
    expect(canSend(idle, "a".repeat(1000))).toBe(true);
  });

  it("is false while waiting", () => {
    expect(canSend(run(send("Owners")), "Another")).toBe(false);
  });

  it("is false when empty or only spaces", () => {
    expect(canSend(idle, "")).toBe(false);
    expect(canSend(idle, "   \n\t ")).toBe(false);
  });

  it("is false over 1,000 characters", () => {
    expect(canSend(idle, "a".repeat(1001))).toBe(false);
  });

  it("is false at the message limit, so no request ever goes past MAX_MESSAGES", () => {
    // The greeting plus two items per exchange. The last allowed request carries exactly MAX_MESSAGES.
    const lastAllowed = (MAX_MESSAGES - 2) / 2;
    const beforeLimit = chatWith(lastAllowed);
    expect(limitReached(beforeLimit)).toBe(false);
    expect(canSend(beforeLimit, "One more")).toBe(true);
    const sent = chatReducer(beforeLimit, send("One more"));
    expect(buildChatRequest(sent, EXAMPLE_SUMMARY, undefined).messages).toHaveLength(MAX_MESSAGES);

    const atLimit = chatReducer(sent, received(sent.requestId));
    expect(limitReached(atLimit)).toBe(true);
    expect(canSend(atLimit, "Too many")).toBe(false);
    expect(chatReducer(atLimit, send("Too many"))).toBe(atLimit);
  });

  it("doesn't count notes toward the limit", () => {
    let state = chatWith((MAX_MESSAGES - 2) / 2);
    state = chatReducer(state, send("Mesa"));
    state = chatReducer(state, received(state.requestId, { note: "A note." }));
    const withoutNote = chatWith((MAX_MESSAGES - 2) / 2 + 1);
    expect(state.items.length).toBe(withoutNote.items.length + 1);
    expect(limitReached(state)).toBe(limitReached(withoutNote));
  });
});

describe("interpretResponse", () => {
  it("turns a reply into received", () => {
    const body = JSON.stringify({
      ok: true,
      kind: "interview",
      reply: "Here is what I'd use.",
      proposal: BUSINESS_OWNER_BRIEF,
      note: null,
    });
    expect(interpretResponse(200, body)).toEqual({
      type: "received",
      reply: "Here is what I'd use.",
      proposal: BUSINESS_OWNER_BRIEF,
      note: null,
    });
  });

  it("passes the route's note through", () => {
    const body = JSON.stringify({ ok: true, kind: "interview", reply: "OK.", proposal: null, note: "A note." });
    expect(interpretResponse(200, body)).toMatchObject({ type: "received", note: "A note.", proposal: null });
  });

  it("shows the route's error text as it is", () => {
    const body = JSON.stringify({ ok: false, error: "Please log in as a JCA admin to use the AI assistant." });
    expect(interpretResponse(401, body)).toEqual({
      type: "failed",
      error: "Please log in as a JCA admin to use the AI assistant.",
    });
  });

  it("gives the 'Couldn't reach the AI' text for a body that isn't JSON", () => {
    expect(interpretResponse(502, "<html>Bad gateway</html>")).toEqual({ type: "failed", error: CHAT_TEXT.cantReach });
    expect(interpretResponse(200, "")).toEqual({ type: "failed", error: CHAT_TEXT.cantReach });
  });

  it("gives the same text for a network error (no response)", () => {
    expect(interpretResponse(0, null)).toEqual({ type: "failed", error: CHAT_TEXT.cantReach });
    expect(CHAT_TEXT.cantReach).toBe("Couldn't reach the AI. Check your connection and try again.");
  });

  it("gives the same text for JSON with no reply and no error", () => {
    expect(interpretResponse(500, JSON.stringify({ ok: false }))).toEqual({ type: "failed", error: CHAT_TEXT.cantReach });
    expect(interpretResponse(200, JSON.stringify({ hello: "world" }))).toEqual({
      type: "failed",
      error: CHAT_TEXT.cantReach,
    });
  });

  it("doesn't take a reply-shaped body with an error status as a reply", () => {
    const body = JSON.stringify({ ok: true, kind: "interview", reply: "OK.", proposal: null, note: null });
    expect(interpretResponse(500, body)).toEqual({ type: "failed", error: CHAT_TEXT.cantReach });
  });
});

describe("latestAnnouncement", () => {
  it("is empty for a new chat, so the greeting isn't read out again", () => {
    expect(latestAnnouncement(initialChatState())).toBe("");
    expect(latestAnnouncement(run(send("Owners")))).toBe("");
  });

  it("says only the newest reply and its note", () => {
    const state = run(send("Owners"), received(1, { reply: "First." }), send("Mesa"), received(2, {
      reply: "Second.",
      note: "A note.",
    }));
    expect(latestAnnouncement(state)).toBe("AI: Second. A note.");
  });
});

describe("characterCount", () => {
  it("shows from 800 characters, with a thousands separator", () => {
    expect(characterCount("a".repeat(799))).toBeNull();
    expect(characterCount("a".repeat(800))).toBe("800 / 1,000");
    expect(characterCount("a".repeat(820))).toBe("820 / 1,000");
    expect(characterCount("a".repeat(1000))).toBe("1,000 / 1,000");
  });
});

describe("CHAT_TEXT", () => {
  it("has the limit text and no em-dashes", () => {
    expect(CHAT_TEXT.limitReached).toBe("This chat is getting long. Start over chat to keep going, or use the form.");
    for (const text of Object.values(CHAT_TEXT)) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("PROPOSAL_TEXT", () => {
  it("has the card's wording and no em-dashes", () => {
    expect(PROPOSAL_TEXT.heading).toBe("Here's what I understood");
    expect(PROPOSAL_TEXT.assumptionsHelp).toBe("These are guesses. Remove any that are wrong.");
    expect(PROPOSAL_TEXT.needsCriterion).toBe("Add at least one must-have or preference, or use the form.");
    expect(PROPOSAL_TEXT.remove("City: Phoenix")).toBe("Remove City: Phoenix");
    expect(PROPOSAL_TEXT.removed("City: Phoenix")).toBe("Removed City: Phoenix.");
    const texts = Object.values(PROPOSAL_TEXT).map((text) => (typeof text === "function" ? text("x") : text));
    for (const text of texts) expect(text).not.toMatch(/[–—]/);
  });
});
