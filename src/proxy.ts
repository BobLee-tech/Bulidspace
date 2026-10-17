import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps a member's Supabase session fresh on the pages that read it. This is
 * not an access check: /me, /welcome and every Server Action look up the
 * member again themselves.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No Supabase, or a visitor who has never signed in: nothing to refresh.
  if (!url || !key) return response;
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/join/:path*", "/me/:path*", "/welcome"],
};
