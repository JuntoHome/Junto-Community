import { describe, expect, it } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { briefChips } from "../criteria/chips";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import {
  buildChatRequest,
  canSend,
  changesAnnouncement,
  CHAT_TEXT,
  type ChatAction,
  chatReducer,
  type ChatState,
  characterCount,
  currentBriefFor,
  GREETING,
  initialChatState,
  firstUserMessage,
  interpretAiResult,
  isAddedNote,
  latestAnnouncement,
  limitReached,
  PROPOSAL_TEXT,
  REVISE_TEXT,
  settleRevision,
} from "./chat-session";
import { diffBriefs } from "./diff-brief";
import { FALLBACK_TEXT } from "./fallback";
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
    const failure = interpretAiResult({ kind: "rate-limited", error: "You've sent a lot of requests. Wait a few minutes and try again." });
    const state = run(send("Owners in Phoenix"), { ...failure, requestId: 1 } as ChatAction);
    expect(state.items).toEqual(initialChatState().items);
    expect(state).toMatchObject({
      status: "error",
      error: "You've sent a lot of requests. Wait a few minutes and try again.",
      failureKind: "rate-limited",
      draft: "Owners in Phoenix",
    });
    // Send retries it.
    expect(canSend(state, state.draft)).toBe(true);
  });

  it("failed keeps anything typed while waiting, after the failed message", () => {
    const state = run(send("Owners in Phoenix"), { type: "edit", text: "and Tempe" }, {
      type: "failed",
      requestId: 1,
      error: FALLBACK_TEXT.aiFailure,
      kind: "network",
    });
    expect(state.draft).toBe("Owners in Phoenix\nand Tempe");
  });

  it("send clears the last error", () => {
    const state = run(send("Hi"), { type: "failed", requestId: 1, error: "Nope", kind: "ai-failure" }, send("Hi"));
    expect(state).toMatchObject({ status: "waiting", error: null });
  });

  it("ignores a stale received after reset (old requestId)", () => {
    const afterReset = run(send("Owners in Phoenix"), { type: "reset" });
    const late = chatReducer(afterReset, received(1, { proposal: BUSINESS_OWNER_BRIEF }));
    expect(late).toBe(afterReset);
  });

  it("ignores a stale failed after reset", () => {
    const afterReset = run(send("Owners in Phoenix"), { type: "reset" });
    expect(chatReducer(afterReset, { type: "failed", requestId: 1, error: "Late", kind: "network" })).toBe(afterReset);
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
    // A checked copy (fix B): every value is in the summary, so nothing is taken out.
    expect(request.currentBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
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

describe("the Results step's chat (TR-46)", () => {
  const confirmed = BUSINESS_OWNER_BRIEF;
  const opsManager = {
    ...confirmed,
    preferences: confirmed.preferences.map((c) =>
      c.field === "title" ? { field: "title" as const, operator: "equals" as const, value: "Operations Manager" } : c,
    ),
  };

  it("starts with its own opening line, which is sent, and keeps it on reset", () => {
    const state = initialChatState(REVISE_TEXT.opening);
    expect(state.items).toEqual([{ id: "greeting", role: "assistant", content: "Want to change something? Tell me." }]);
    const sent = chatReducer(state, send("favor operations managers instead"));
    expect(buildChatRequest(sent, EXAMPLE_SUMMARY, confirmed).messages[0]).toEqual({ role: "assistant", content: REVISE_TEXT.opening });
    const reset = chatReducer(sent, { type: "reset" });
    expect(reset.items[0].content).toBe(REVISE_TEXT.opening);
    expect(chatReducer(initialChatState(), { type: "reset" }).items[0].content).toBe(GREETING);
  });

  it("always sends the confirmed brief as currentBrief, even after a proposal", () => {
    let state = chatReducer(initialChatState(REVISE_TEXT.opening), send("favor operations managers instead"));
    state = chatReducer(state, received(state.requestId, { proposal: opsManager }));
    expect(currentBriefFor(state, confirmed, "revise")).toBe(confirmed);
    // The Criteria step's chat follows the proposal instead.
    expect(currentBriefFor(state, confirmed)).toBe(opsManager);
    expect(currentBriefFor(state, null, "revise")).toBeUndefined();
  });

  it("dismiss-proposal closes the card and keeps the chat", () => {
    let state = chatReducer(initialChatState(REVISE_TEXT.opening), send("favor operations managers instead"));
    state = chatReducer(state, received(state.requestId, { proposal: opsManager }));
    const dismissed = chatReducer(state, { type: "dismiss-proposal" });
    expect(dismissed.proposal).toBeNull();
    expect(dismissed.items).toBe(state.items);
    expect(chatReducer(dismissed, { type: "dismiss-proposal" })).toBe(dismissed);
  });

  it("settleRevision turns a proposal that changes nothing into the note, with no proposal", () => {
    const same = { type: "received", reply: "Here it is.", note: null, proposal: structuredClone(confirmed) } as const;
    expect(settleRevision(same, confirmed)).toEqual({ ...same, proposal: null, note: "Your criteria are the same, so nothing to update." });
    const changed = { ...same, proposal: opsManager };
    expect(settleRevision(changed, confirmed)).toBe(changed);
    expect(settleRevision(same, undefined)).toBe(same);
    const failed = { type: "failed", error: "No.", kind: "ai-failure" } as const;
    expect(settleRevision(failed, confirmed)).toBe(failed);
  });

  it("changesAnnouncement reads the list, and the warning for more than one change", () => {
    expect(changesAnnouncement(diffBriefs(confirmed, opsManager))).toBe("Changed: Title preference: Owner to Operations Manager.");
    expect(changesAnnouncement(diffBriefs(confirmed, { ...opsManager, listSize: 30 }))).toBe(
      "Changed: Title preference: Owner to Operations Manager; List size: 40 to 30. The AI changed more than one thing. Check each one before you confirm.",
    );
    expect(changesAnnouncement([])).toBe("");
  });

  it("no longer has TR-46's Updated line: TR-47's explanation replaces it", () => {
    expect(Object.keys(REVISE_TEXT)).not.toContain("updated");
    expect(Object.keys(REVISE_TEXT)).not.toContain("updatedEmpty");
  });
});

describe("add-note (TR-47)", () => {
  const explanation = "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred).";
  const revised = () =>
    [send("favor operations managers instead"), received(1, { reply: "Done." }), { type: "dismiss-proposal" } as ChatAction].reduce(
      chatReducer,
      initialChatState(REVISE_TEXT.opening),
    );

  it("adds the explanation as a note at the end of the chat", () => {
    const state = chatReducer(revised(), { type: "add-note", content: explanation });
    const last = state.items.at(-1);
    expect(last).toMatchObject({ role: "note", content: explanation });
    expect(last && isAddedNote(last)).toBe(true);
    expect(state.items.slice(0, -1)).toEqual(revised().items);
  });

  it("never sends the note to the AI", () => {
    const state = chatReducer(revised(), { type: "add-note", content: explanation });
    const request = buildChatRequest(chatReducer(state, send("Now Tempe")), EXAMPLE_SUMMARY, BUSINESS_OWNER_BRIEF);
    expect(JSON.stringify(request)).not.toContain("SYN-0006");
    expect(request.messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant", "user"]);
  });

  it("is read on its own by the live region, without the reply again", () => {
    const state = chatReducer(revised(), { type: "add-note", content: explanation });
    expect(latestAnnouncement(revised())).toBe("AI: Done.");
    expect(latestAnnouncement(state)).toBe(explanation);
    // The next reply is read as usual.
    const next = chatReducer(chatReducer(state, send("Now Tempe")), received(2, { reply: "Sure." }));
    expect(latestAnnouncement(next)).toBe("AI: Sure.");
  });

  it("gives each added note its own id and ignores an empty one", () => {
    let state = chatReducer(revised(), { type: "add-note", content: "First." });
    state = chatReducer(state, { type: "add-note", content: "Second." });
    const ids = state.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(chatReducer(state, { type: "add-note", content: "  " })).toBe(state);
    // A note the AI route sent is not an added note.
    const routeNote = run(send("Owners"), received(1, { note: "A note." })).items.at(-1);
    expect(routeNote && isAddedNote(routeNote)).toBe(false);
  });
});

describe("firstUserMessage (TR-52)", () => {
  const sendAndReply = (state: ChatState, text: string): ChatState => {
    const sent = chatReducer(state, { type: "send", text });
    return chatReducer(sent, { type: "received", requestId: sent.requestId, reply: "OK", note: null, proposal: null });
  };

  it("is null before anything is sent", () => {
    expect(firstUserMessage(initialChatState())).toBeNull();
  });

  it("is the first message typed, trimmed, not a later one or the greeting", () => {
    const state = sendAndReply(sendAndReply(initialChatState(), "  owners in Phoenix \n"), "only Owners");
    expect(firstUserMessage(state)).toBe("owners in Phoenix");
  });

  it("starts again after Start over chat", () => {
    const reset = chatReducer(sendAndReply(initialChatState(), "owners in Phoenix"), { type: "reset" });
    expect(firstUserMessage(reset)).toBeNull();
    expect(firstUserMessage(sendAndReply(reset, "Tempe logistics"))).toBe("Tempe logistics");
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

describe("interpretAiResult", () => {
  it("turns a reply into received", () => {
    const json = { ok: true, kind: "interview", reply: "Here is what I'd use.", proposal: BUSINESS_OWNER_BRIEF, note: null };
    expect(interpretAiResult({ kind: "ok", json })).toEqual({
      type: "received",
      reply: "Here is what I'd use.",
      proposal: BUSINESS_OWNER_BRIEF,
      note: null,
    });
  });

  it("passes the route's note through", () => {
    const json = { ok: true, kind: "interview", reply: "OK.", proposal: null, note: "A note." };
    expect(interpretAiResult({ kind: "ok", json })).toMatchObject({ type: "received", note: "A note.", proposal: null });
  });

  it("counts a 200 that isn't an interview reply as the AI failing", () => {
    expect(interpretAiResult({ kind: "ok", json: { ok: true, hello: "world" } })).toEqual({
      type: "failed",
      kind: "ai-failure",
      error: FALLBACK_TEXT.aiFailure,
    });
  });

  it("gives each kind its message: the AI text, the login text, or the route's own text", () => {
    expect(interpretAiResult({ kind: "ai-failure", error: "The AI took too long to answer." })).toEqual({ type: "failed", kind: "ai-failure", error: FALLBACK_TEXT.aiFailure });
    expect(interpretAiResult({ kind: "network", error: null })).toEqual({ type: "failed", kind: "network", error: FALLBACK_TEXT.aiFailure });
    expect(interpretAiResult({ kind: "session-expired", error: "Please log in." })).toMatchObject({ error: FALLBACK_TEXT.sessionExpired });
    expect(interpretAiResult({ kind: "unavailable", error: null })).toMatchObject({ error: FALLBACK_TEXT.unavailable });
    expect(interpretAiResult({ kind: "too-long", error: "This conversation is too long. Start a new chat to keep going." })).toMatchObject({
      error: "This conversation is too long. Start a new chat to keep going.",
    });
    expect(interpretAiResult({ kind: "bad-request", error: null })).toMatchObject({ error: FALLBACK_TEXT.somethingWrong });
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
    const texts = Object.values(CHAT_TEXT).map((text) => (typeof text === "function" ? text(["Zuni", "Mesa"]) : text));
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
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
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("REVISE_TEXT", () => {
  it("has the wording and no em-dashes", () => {
    expect(REVISE_TEXT.several).toBe("The AI changed more than one thing. Check each one before you confirm.");
    const texts = [
      REVISE_TEXT.opening,
      REVISE_TEXT.changed,
      REVISE_TEXT.several,
      REVISE_TEXT.noChange,
      REVISE_TEXT.cancel,
      REVISE_TEXT.marks.new,
      REVISE_TEXT.marks.changed,
    ];
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
