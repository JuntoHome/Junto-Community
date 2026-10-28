import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

/** What the login form shows after a failed attempt. A successful login redirects instead. */
export type LoginState = { error?: string; email?: string };

export const forgotPasswordSchema = z.object({ email });

export type ForgotPasswordState = { sent?: boolean; error?: string; email?: string };

/** The kinds of email link that lead to the set-password page. */
export const PASSWORD_LINK_TYPES = ["invite", "recovery"] as const;
export type PasswordLinkType = (typeof PASSWORD_LINK_TYPES)[number];

export const setPasswordSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters.").max(72, "Use 72 characters or fewer."),
    confirm: z.string(),
    tokenHash: z.string().min(1).max(500).optional(),
    type: z.enum(PASSWORD_LINK_TYPES).optional(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords don't match." });

export type SetPasswordState = {
  error?: string;
  /** The email link has expired or was already used: offer a new one. */
  expired?: boolean;
  /** The link's one-time code was used but the password wasn't saved; retry with the session instead. */
  codeUsed?: boolean;
};
