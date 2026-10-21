"use server";

import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_FLAG_COOKIE,
  ADMIN_KEY_COOKIE,
} from "@/lib/admin";
import type { FormState } from "@/lib/forms";
import { getSupabase } from "@/lib/supabase/client";

export async function adminSignIn(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const key = String(form.get("key") ?? "").trim();
  if (!key) {
    return {
      status: "error",
      message: "请输入管理员口令|Enter the admin key",
      fieldErrors: { key: "必填|Required" },
    };
  }

  const db = getSupabase();
  if (!db) {
    return {
      status: "error",
      message: "没有连接数据库|The database isn't connected",
    };
  }
  const { data, error } = await db.rpc("check_comment_admin", {
    admin_key: key,
  });
  if (error) {
    console.error("[admin] key check failed", {
      code: error.code,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "暂时无法验证，请稍后再试|Couldn't check the key, try again later",
    };
  }
  // Only a wrong key is throttled; the right one always gets "ok".
  if (data === "throttled") {
    return {
      status: "error",
      message:
        "口令不对（最近输错很多次，正确的口令照样能用）|That key is wrong (many wrong tries lately; the right key still works)",
    };
  }
  if (data !== "ok") {
    return { status: "error", message: "口令不对|That key is wrong" };
  }

  const jar = await cookies();
  const options = {
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
  jar.set(ADMIN_KEY_COOKIE, key, { ...options, httpOnly: true });
  jar.set(ADMIN_FLAG_COOKIE, "1", options);
  return { status: "ok" };
}

export async function adminSignOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_KEY_COOKIE);
  jar.delete(ADMIN_FLAG_COOKIE);
}
