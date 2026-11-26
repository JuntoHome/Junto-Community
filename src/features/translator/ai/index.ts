/**
 * What the Translator's UI may use from `ai/` (PHASE2-CODE-GUIDE.md, section 2): types and pure
 * helpers only. Never export `client.ts` (server only) or the route's handler from here.
 */
export {
  buildChatRequest,
  canSend,
  changesAnnouncement,
  CHAT_TEXT,
  type ChatAction,
  type ChatItem,
  type ChatMode,
  type ChatOutcome,
  chatReducer,
  type ChatState,
  characterCount,
  COUNTER_FROM,
  currentBriefFor,
  GREETING,
  initialChatState,
  interpretAiResult,
  aiTurnedOff,
  fallbackBrief,
  isAddedNote,
  shouldSwitchToForm,
  latestAnnouncement,
  limitReached,
  PROPOSAL_TEXT,
  REVISE_TEXT,
  settleRevision,
} from "./chat-session";
export { type BriefChange, chipMarks, type ChipMark, DIFF_TEXT, diffBriefs } from "./diff-brief";
export { EXPLAIN_TEXT, explainChange, type ExplainInput } from "./explain-change";
export { INTRO_TEXT, type IntroFields, MAX_INTRO_NOTE_CHARS, pickIntroFields, type PickedIntro } from "./intro";
export {
  buildIntroRequest,
  type IntroAction,
  type IntroDraft,
  initialIntroState,
  INTRO_PANEL_TEXT,
  type IntroRequestInfo,
  type IntroSessionState,
  interpretIntroResult,
  introReducer,
  placeholderCount,
} from "./intro-session";
export { MAX_MESSAGES, MAX_USER_MESSAGE_CHARS } from "./request-schema";
export { buildFileSummary } from "./summary";
export type { AiRequest, AiResponse, ChatMessage, FileSummary } from "./types";
export { type FailureActions, failureActions, failureMessage, FALLBACK_TEXT, LOGIN_PATH } from "./fallback";
export { AI_ROUTE, type AiFailureKind, countsAsAiFailure, failingFetch, type FetchFn, postAi, type PostAiResult } from "./post-ai";
