import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Called every hour by the Vercel Cron Job in vercel.json. Supabase pauses a
// free project without "a few user requests to the database each day", so each
// run writes one row to `keep_alive` (a real write, and a dated record of every run).
export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;

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

  const source = request.headers.get("user-agent")?.startsWith("vercel-cron") ? "vercel-cron" : "manual";

  try {
    const db = getSupabaseAdmin();

    const { data: previous } = await db
      .from("keep_alive")
      .select("pinged_at, source")
      .order("pinged_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await db.from("keep_alive").insert({ source });
    if (error) {
      // Table not created yet: fall back to a plain read so the ping still reaches the database.
      console.error("[keep-alive] heartbeat write failed, falling back to a read", error.message);
      const { error: readError } = await db.from("subscribers").select("id").limit(1);
      if (readError) throw new Error(readError.message);
      console.log(`[keep-alive] ok (read, ${source})`);
      return Response.json({ ok: true, mode: "read", checkedAt: new Date().toISOString() });
    }

    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.from("keep_alive").delete().lt("pinged_at", cutoff);
    console.log(`[keep-alive] ok (write, ${source})`);

    return Response.json({
      ok: true,
      mode: "write",
      source,
      checkedAt: new Date().toISOString(),
      previousPing: previous ?? null,
    });
  } catch (error) {
    console.error("[keep-alive] Supabase query failed", error);
    return Response.json({ ok: false, error: "Database query failed" }, { status: 500 });
  }
}
