import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-aware client for signed-in members: RLS sees them as `authenticated`.
 * Public content keeps using the anon client in ./client (cacheable); this one
 * reads cookies, so only call it inside <Suspense> or from a Server Action.
 */
export async function getSupabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Rendering a Server Component: cookies are read-only there, and
          // src/proxy.ts has already refreshed the session for this request.
        }
      },
    },
  });
}
