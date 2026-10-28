import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(200),
});

/** What the login form shows after a failed attempt. A successful login redirects instead. */
export type LoginState = { error?: string; email?: string };
