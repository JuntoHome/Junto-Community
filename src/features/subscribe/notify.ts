import "server-only";

import { getSiteSettings } from "@/lib/content";
import type { SubscribeInput } from "./schema";

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Junto Community Alliance <notifications@juntocommunity.org>";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Emails the team that someone joined. Sent through Resend.
 *
 * - `RESEND_API_KEY`: required; without it nothing is sent.
 * - `SUBSCRIBE_NOTIFY_EMAIL`: recipients, comma-separated. Defaults to the site contact email.
 * - `RESEND_FROM_EMAIL`: sender on a domain verified in Resend. Defaults to notifications@juntocommunity.org.
 *
 * Throws on failure; the caller decides what to do (the signup itself is already saved).
 */
export async function notifyNewSubscriber(subscriber: SubscribeInput, source = "website") {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[subscribe] RESEND_API_KEY is not set; skipping notification email");
    return;
  }

  const site = await getSiteSettings();
  const to = (process.env.SUBSCRIBE_NOTIFY_EMAIL || site.contactEmail)
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Phoenix",
  }).format(new Date());

  const rows: Array<[string, string]> = [
    ["First name", subscriber.firstName],
    ["Email", subscriber.email],
    ["ZIP code", subscriber.zip],
    ["Signed up", `${when} (Arizona time)`],
    ["Source", source],
  ];

  const text = [
    `${subscriber.firstName} just joined the Junto on ${site.url.replace(/^https?:\/\//, "")}.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Reply to this email to write to them directly.",
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#14233A">
  <p style="margin:0 0 16px"><strong>${escapeHtml(subscriber.firstName)}</strong> just joined the Junto.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 16px 6px 0;color:#4B5563">${escapeHtml(label)}</td><td style="padding:6px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
      )
      .join("\n    ")}
  </table>
  <p style="margin:16px 0 0;color:#4B5563;font-size:14px">Reply to this email to write to them directly.</p>
</div>`.trim();

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      reply_to: subscriber.email,
      subject: `New Junto subscriber: ${subscriber.firstName} (${subscriber.zip})`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}
