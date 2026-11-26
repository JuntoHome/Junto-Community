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
  interpretResponse,
  latestAnnouncement,
  limitReached,
  PROPOSAL_TEXT,
  REVISE_TEXT,
  settleRevision,
} from "./chat-session";
export { type BriefChange, chipMarks, type ChipMark, DIFF_TEXT, diffBriefs } from "./diff-brief";
export { MAX_MESSAGES, MAX_USER_MESSAGE_CHARS } from "./request-schema";
export { buildFileSummary } from "./summary";
export type { AiRequest, AiResponse, ChatMessage, FileSummary } from "./types";
