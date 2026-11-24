# Phase 2 code guide

How to write the Translator's Phase 2 code (Chat with AI). Every Phase 2 ticket follows this guide.

- **Status:** nothing in this guide is built yet. TR-38 set the rules, this guide, the environment variables and the `openai` dependency. The files below are created by later tickets.
- **Rules:** the hard rules are in [../../CLAUDE.md](../../CLAUDE.md). What Phase 2 is, its flow and what is sent to the AI: [README.md](README.md#phase-2).
- **Source:** the code guide in issue #81 (TR-38), with the corrections listed in [Changes from the issue's guide](#changes-from-the-issues-guide).

## 1. Folder layout

```
src/
  app/
    admin/(protected)/translator/
      page.tsx            # Phase 1 page. Phase 2: reads aiEnabled() and passes a boolean prop to the UI.
    api/translator/ai/
      route.ts            # ONLY server entry point. Thin: admin check, limits, call handler, return JSON.
  features/translator/
    ai/                   # NEW. Pure logic, no React. One file per capability.
      types.ts            # Shared types: ChatMessage, AiRequest, AiResponse, FileSummary, IntroFields
      client.ts           # Server only. First line: import "server-only". The ONLY file that imports
                          # "openai" and reads process.env. Exports aiEnabled(), aiModel(), createOpenAiCall().
      summary.ts          # Capability: build the file summary (what the AI may see)
      instructions.ts     # Capability: interview + intro instructions (system prompts)
      schema.ts           # Capability: AI request and response shapes (reuses searchBriefSchema)
      validate.ts         # Capability: check AI output, "value must exist in the file"
      interview.ts        # Capability: run one interview turn (instructions + call + validate)
      intro.ts            # Capability: pick intro fields + run the intro draft
      diff-brief.ts       # Capability: what changed between two briefs
      explain-change.ts   # Capability: plain sentence on why the list moved (no AI)
      guardrails.ts       # Capability: limits, sanitising values, stripping invented contacts
      index.ts            # Public exports for the UI (types + pure helpers only, never client.ts)
    ui/chat/              # NEW. React only. No business rules here.
      chat-panel.tsx
      proposal-card.tsx
      intro-panel.tsx
      use-chat-session.ts # The only stateful hook: messages, lastValidBrief, drafts, limits
    __fixtures__/
      fake-ai.ts          # Scripted fake for tests
      walkthroughs/ai-*.json
```

## 2. Layers and who may call whom

| Layer | Files | May import | Must NOT import |
|---|---|---|---|
| UI | `ui/chat/*` | `ai/index.ts`, `criteria/*`, `ranking/*` (as Phase 1 does) | `ai/client.ts`, `openai` |
| Admin page (Server Component) | `app/admin/(protected)/translator/page.tsx` | `lib/auth.ts`, the UI, and `aiEnabled` from `ai/client.ts` | `openai`, `process.env` |
| Route | `app/api/translator/ai/route.ts` | `ai/interview.ts`, `ai/intro.ts`, `ai/types.ts`, `ai/schema.ts`, `ai/client.ts`, `lib/auth.ts` | React, UI files, `openai`, `process.env` |
| Capabilities | `ai/*.ts` (except `client.ts`) | `criteria/*`, `normalize/*`, `ranking/*`, zod | React, `next/*`, `openai`, `process.env` |
| OpenAI client | `ai/client.ts` | `server-only`, `openai`, `process.env` | Anything UI |

Rules:

- **One capability = one file = one main exported function.** Easy to find, test and change.
- Capability files are **pure**: same input, same output, no network, no env, no React. The only exception is `client.ts`.
- `interview.ts` and `intro.ts` take the AI call as a **parameter** (dependency injection), so tests pass `fake-ai.ts` and the route passes the real client.
- The route stays thin (under about 100 lines). If logic grows, move it into a capability file.
- Reuse Phase 1: `searchBriefSchema`, `fieldOptions()`, `matchKey()`, `describe.ts`, ranking `reasons.ts`, export `cells.ts`. Never copy them.

### The OpenAI client (`ai/client.ts`)

- Its first line is `import "server-only";` (the repo rule for any module that uses secrets, see [CODING-STANDARDS.md](../guides/CODING-STANDARDS.md#server-and-client-code)). The build then fails if UI code ever imports it. A comment is not enough.
- It is the only file that reads `process.env` for the Translator and the only file that imports `openai`. It exports:
  - `aiEnabled()`: true when `OPENAI_API_KEY` is set and `TRANSLATOR_AI` is not `"off"`.
  - `aiModel()`: the value of `OPENAI_MODEL`, or `gpt-4o-mini` when it is empty.
  - `createOpenAiCall()`: the real `AiCall` the route passes to the capabilities.
- The variables are described in [ENVIRONMENT-CONFIGURATION.md](../guides/ENVIRONMENT-CONFIGURATION.md#environment-variables).
- **Showing the button.** The UI can't call `aiEnabled()`, because it can't import `client.ts`. The admin page is a Server Component, so it may import `aiEnabled` from `client.ts`, call it, and pass the result to the UI as a boolean prop. The key itself never goes in a prop.
- **Errors.** `client.ts` catches every OpenAI error and returns `{ ok: false }` to the capability. It logs only `[translator-ai] <code>`, where the code is the HTTP status or the error type (for example `[translator-ai] 429` or `[translator-ai] timeout`). Never the error message, the request or the response: an error message can quote what was sent. This is the same idea as `logTranslatorError()` in Phase 1 ([README.md](README.md#session-and-start-over)).

## 3. Shape of a capability file (follow this pattern)

```ts
// src/features/translator/ai/interview.ts
/**
 * Capability: run one interview turn.
 * Input: the file summary, the chat so far, the current brief (if any).
 * Output: the message to show + a validated SearchBrief proposal or null.
 * Privacy: receives only FileSummary and chat text. Never rows.
 */
import { buildInterviewInstructions } from "./instructions";
import { parseInterviewReply } from "./validate";
import type { AiCall, ChatMessage, FileSummary, InterviewResult } from "./types";
import type { SearchBrief } from "../criteria/schema";

const INTERVIEW_TEXT = {
  noResponse: "The AI didn't answer. Try again, or use the form.",
  unusableAnswer: "The AI gave an answer I couldn't use. Try again, or use the form.",
} as const;

export async function runInterviewTurn(
  input: { summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief },
  callAi: AiCall,                       // real client in the route, fake in tests
): Promise<InterviewResult> {
  const instructions = buildInterviewInstructions(input.summary, input.currentBrief);
  const raw = await callAi({ instructions, messages: input.messages, format: "interview_reply" });
  if (!raw.ok) return { ok: false, error: INTERVIEW_TEXT.noResponse };
  const parsed = parseInterviewReply(raw.value, input.summary);
  return parsed.ok
    ? { ok: true, reply: parsed.reply.message, proposal: parsed.reply.proposal }
    : { ok: false, error: INTERVIEW_TEXT.unusableAnswer };
}
```

The message wording above is an example. The ticket that builds each file sets its final text.

Every capability file has:

1. A header comment: what it does, input, output, privacy note.
2. One main exported function with typed input and output.
3. Results as `{ ok: true, ... } | { ok: false, error }`. Never throw to the UI.
4. User-facing text in its own `const ..._TEXT = { ... }` object at the top of the file (same as Phase 1 `CRITERIA_TEXT`): `INTERVIEW_TEXT` in `interview.ts`, `INTRO_TEXT` in `intro.ts`, and so on. Plain language that says what went wrong and how to fix it. There is no shared `AI_TEXT`.
5. A matching test file next to it: `interview.test.ts`.

## 4. The route (pattern)

```ts
// src/app/api/translator/ai/route.ts
import { getAdmin } from "@/lib/auth";
import { aiEnabled, createOpenAiCall } from "@/features/translator/ai/client";
import { runInterviewTurn } from "@/features/translator/ai/interview";
import { runIntroDraft } from "@/features/translator/ai/intro";
import { aiRequestSchema } from "@/features/translator/ai/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_TEXT = {
  signedOut: "Your session ended. Log in again.",
  unavailable: "Chat with AI is switched off. Use the form instead.",
  badRequest: "That request couldn't be read. Reload the page and try again.",
} as const;

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return json({ ok: false, error: ROUTE_TEXT.signedOut }, 401);
  if (!aiEnabled()) return json({ ok: false, error: ROUTE_TEXT.unavailable }, 503);
  const body = aiRequestSchema.safeParse(await readJsonWithLimit(request));
  if (!body.success) return json({ ok: false, error: ROUTE_TEXT.badRequest }, 400);
  const callAi = createOpenAiCall();               // from ai/client.ts
  const result = body.data.kind === "interview"
    ? await runInterviewTurn(body.data, callAi)
    : await runIntroDraft(body.data, callAi);
  return json(result, 200);
}
```

Notes on the pattern:

- **Admin check: `getAdmin()`, not `requireAdmin()`.** `requireAdmin()` redirects to `/admin/login`, so a `fetch` would get the login page's HTML back instead of JSON. In the route, call `getAdmin()` (`src/lib/auth.ts`) first. When it returns null, respond `401` with `{ ok: false, error: ROUTE_TEXT.signedOut }`. The UI shows "Your session ended. Log in again." Pages and Server Actions keep using `requireAdmin()`.
- **Add the route to the `proxy.ts` matcher.** `src/proxy.ts` refreshes the admin session only on `/admin` and `/preview`. A call to `/api/translator/ai` with an expired access token would fail even though the admin is still logged in. The ticket that builds the route must add `/api/translator/ai` to the `matcher` and to the session refresh check in `proxy()` (repo checklist in [WAY-OF-WORKING.md](../WAY-OF-WORKING.md#checklist-for-a-change): "New gated or redirected URL: add it to the `proxy.ts` matcher").
- **`json()` and `readJsonWithLimit()`** are small helpers that live in the route file. Move them to `src/lib/` only if another route needs them. `json(body, status)` returns the JSON response. `readJsonWithLimit(request)` refuses a body over the size limit before parsing it, and returns something the schema rejects when the body isn't JSON.
- **Body size limit:** a fixed number of bytes, for example 32 KB (32,768 bytes). The route ticket decides the number and writes it as a named constant.
- **The route has its own `ROUTE_TEXT`**, like every other file (section 3, point 4).
- **Never log** the request body, the result or an error message. See "Errors" in section 2.

## 5. UI pattern

- Components only render and forward events. No validation, no prompt text, no fetch logic inside components.
- `use-chat-session.ts` owns state and the `fetch("/api/translator/ai")` call.
- State lives in React only. No localStorage, sessionStorage, cookies, URL params with content.
- The UI learns whether the AI is on from a boolean prop passed down from the admin page (section 2). It never reads an environment variable.
- A `401` from the route means the session ended: show "Your session ended. Log in again."

## 6. When the AI is off or fails

- **AI off** (`aiEnabled()` is false): the Chat with AI button is not shown, and the Phase 1 form works exactly as before.
- **Any AI error** (no answer, an unusable answer, a timeout, a `401`, `503` or a network failure): the Phase 1 form stays available and works exactly as before. Nothing the user already has (file, criteria, results) is lost.
- The AI is an extra way to fill the `SearchBrief`. Nothing in Phase 1 may depend on it.

## 7. Naming

- Files: kebab-case (`explain-change.ts`). Functions: verbs (`buildFileSummary`, `runInterviewTurn`, `pickIntroFields`).
- Types: nouns (`FileSummary`, `IntroFields`, `InterviewResult`).
- Branches: `tr-<number>-<short-name>`, off `translator`, PR back into `translator`, `Closes #<issue>` in the PR.

## 8. Never do

- Never import `openai` or read `process.env` outside `ai/client.ts`.
- Never put the OpenAI key in client code or in a variable that starts with `NEXT_PUBLIC_`.
- Never send full rows, IDs, phones, emails or websites to the route. What may be sent is in the [README's table](README.md#what-is-sent-to-the-ai).
- Never `console.log` request bodies, chat text, summaries, intro fields or AI replies. Never log an error's message, request or response: only `[translator-ai] <code>`.
- Never store any of it: no Supabase, localStorage, sessionStorage or cookies.
- Never let the AI rank, score, filter or sort. Ranking is Phase 1 code.
- Never create a second criteria shape. Always `SearchBrief`.
- Never lift the file gate or use real exports. Synthetic files only, as in Phase 1.

## Changes from the issue's guide

Where this guide differs from the code guide in issue #81, and why.

| # | Problem in the issue's guide | Correction here |
|---|---|---|
| 1 | The route pattern called `await requireAdmin()`. That redirects to `/admin/login`, so a `fetch` gets the login HTML back, not JSON | The route calls `getAdmin()` and returns `401` JSON with "Your session ended. Log in again." (section 4) |
| 2 | `src/proxy.ts` refreshes the session only on `/admin` and `/preview`, so a call to the route with an expired access token would fail | The route ticket must add `/api/translator/ai` to the `proxy.ts` matcher (section 4) |
| 3 | `aiEnabled()` was used in the route, and the page needs it to show the button, but only `client.ts` may read `process.env` | `client.ts` exports `aiEnabled()` and `aiModel()`. The admin page may import `aiEnabled` and pass a boolean prop. The page is in the layer table, and the route's row lists `ai/client.ts` and `ai/schema.ts` (section 2) |
| 4 | `client.ts` was "server-only" in a comment only | Its first line is `import "server-only";` (section 2) |
| 5 | The sample used `AI_TEXT` without defining it, while each file is meant to have its own `_TEXT` object | `INTERVIEW_TEXT` is defined at the top of `interview.ts`; the route uses its own `ROUTE_TEXT` (sections 3 and 4) |
| 6 | `json()` and `readJsonWithLimit()` weren't defined anywhere | They live in the route file, with a body size limit (for example 32 KB) decided in the route ticket (section 4) |
| 7 | "Never log" didn't cover errors | OpenAI errors are caught and logged only as `[translator-ai] <code>` (section 2) |
| 8 | Nothing said what happens when the AI is off or fails | The Phase 1 form stays available and works exactly as before (section 6) |
