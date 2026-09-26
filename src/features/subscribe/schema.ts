import { z } from "zod";

/** Name of the hidden honeypot field. Real visitors never fill it in. */
export const HONEYPOT_FIELD = "company";

export const subscribeSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Please enter your first name.")
    .max(100, "Please use 100 characters or fewer."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .pipe(z.email("Please enter a valid email address.")),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Please enter a 5-digit ZIP code."),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type SubscribeField = keyof SubscribeInput;

export type SubscribeState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<SubscribeField, string>>;
      values?: Partial<Record<SubscribeField, string>>;
    };
