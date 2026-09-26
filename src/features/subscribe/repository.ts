import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SubscribeInput } from "./schema";

export type AddSubscriberResult = "created" | "duplicate";

/** Unique-violation code from Postgres (`subscribers_email_key`). */
const UNIQUE_VIOLATION = "23505";

export async function addSubscriber(input: SubscribeInput, source = "website"): Promise<AddSubscriberResult> {
  const { error } = await getSupabaseAdmin().from("subscribers").insert({
    first_name: input.firstName,
    email: input.email,
    zip: input.zip,
    source,
  });

  if (!error) return "created";
  if (error.code === UNIQUE_VIOLATION) return "duplicate";
  throw new Error(`Failed to add subscriber: ${error.message}`);
}
