import { cookies } from "next/headers";
import { ADMIN_KEY_COOKIE } from "@/lib/admin";
import { getLiveStore } from "@/lib/live-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// The host console's view: names and feedback text. The database checks the
// /admin key on every call and counts every wrong one (after ten in ten
// minutes wrong keys get "throttled"; the right key still works), so a phone
// that never signed in at /admin is turned away here without asking the
// database.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/live/[slug]/api/host">,
) {
  const { slug } = await ctx.params;
  const store = getLiveStore();
  if (!store) return Response.json({ closed: true }, { status: 503 });
  const key = (await cookies()).get(ADMIN_KEY_COOKIE)?.value ?? "";
  if (!key && isSupabaseConfigured()) {
    return Response.json({ denied: "denied" }, { status: 403 });
  }
  try {
    const host = await store.hostState(slug, key);
    if (!host) return Response.json({ missing: true }, { status: 404 });
    if (typeof host === "string") {
      return Response.json({ denied: host }, { status: 403 });
    }
    return Response.json(
      { host },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ failed: true }, { status: 502 });
  }
}
