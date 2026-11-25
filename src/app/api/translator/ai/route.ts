import { aiEnabled, createOpenAiCall } from "@/features/translator/ai/client";
import { AI_REQUESTS_PER_WINDOW, handleAiRequest } from "@/features/translator/ai/handle-request";
import { getAdmin } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

// The Translator's only server entry point for AI calls (Phase 2). Admins only: getAdmin(), not
// requireAdmin(), so a logged-out fetch gets a 401 JSON reply instead of the login page's HTML.
// All checks and the order they run in are in handleAiRequest (features/translator/ai/handle-request.ts).
// Keeps nothing between calls and logs only `translator_ai_<code>`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleAiRequest(request, {
    getAdmin,
    aiEnabled,
    callAi: createOpenAiCall(),
    rateLimit: (userId) => isRateLimited(`translator-ai:${userId}`, AI_REQUESTS_PER_WINDOW),
  });
}
