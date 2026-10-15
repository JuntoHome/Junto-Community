import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Called once a day by the Vercel Cron Job in vercel.json. Supabase pauses a
// free project after 7 days without activity; one small real query keeps it awake.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[keep-alive] CRON_SECRET is not set");
    return Response.json({ ok: false, error: "Not configured" }, { status: 500 });
  }
  // Vercel sends `Authorization: Bearer <CRON_SECRET>` with every cron request.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await getSupabaseAdmin().from("subscribers").select("id").limit(1);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[keep-alive] Supabase query failed", error);
    return Response.json({ ok: false, error: "Database query failed" }, { status: 500 });
  }
}
