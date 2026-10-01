"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { notifyNewSubscriber } from "./notify";
import { isRateLimited } from "./rate-limit";
import { addSubscriber } from "./repository";
import { HONEYPOT_FIELD, type SubscribeField, type SubscribeState, subscribeSchema } from "./schema";

const SUCCESS = "Welcome to the Junto! We'll be in touch about upcoming workshops.";
const DUPLICATE = "You're already on the list. We'll be in touch about upcoming workshops.";

export async function subscribe(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    email: String(formData.get("email") ?? ""),
    zip: String(formData.get("zip") ?? ""),
  };

  // Bots fill every field. Pretend it worked so they learn nothing.
  if (String(formData.get(HONEYPOT_FIELD) ?? "") !== "") {
    return { status: "success", message: SUCCESS };
  }

  const parsed = subscribeSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SubscribeField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SubscribeField;
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors, values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (isRateLimited(ip)) {
    return { status: "error", message: "Too many attempts. Please try again in a few minutes.", values };
  }

  try {
    const result = await addSubscriber(parsed.data);

    // The signup is saved. Email the team after the response is sent, so the
    // visitor never waits on (or sees an error from) the notification.
    if (result === "created") {
      after(async () => {
        try {
          await notifyNewSubscriber(parsed.data);
        } catch (error) {
          console.error("[subscribe] notification email failed", error);
        }
      });
    }

    return { status: "success", message: result === "duplicate" ? DUPLICATE : SUCCESS };
  } catch (error) {
    console.error("[subscribe]", error);
    return {
      status: "error",
      message: "Something went wrong on our end. Please try again, or email us instead.",
      values,
    };
  }
}
