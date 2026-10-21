"use server";

import { revalidateTag, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_FLAG_COOKIE, ADMIN_KEY_COOKIE } from "@/lib/admin";
import {
  parseProjectCommentForm,
  parseProjectUpdateForm,
  type FormState,
} from "@/lib/forms";
import { invalidForm, submitFailed, withoutDatabase } from "@/lib/form-actions";
import { looksAutomated } from "@/lib/spam";
import { getSupabase } from "@/lib/supabase/client";

/** SQLSTATE when RLS refuses a row: here, a reply under a deleted comment. */
const RLS_REFUSED = "42501";

export async function submitProjectUpdate(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  if (looksAutomated(form)) return { status: "ok" };

  const parsed = parseProjectUpdateForm(form);
  if (!parsed.success) return invalidForm(parsed.error);

  const db = getSupabase();
  if (!db) {
    return withoutDatabase(
      "update",
      "暂时无法提交，请稍后再试|Can't submit right now",
      parsed.data,
      { status: "ok" },
    );
  }

  const v = parsed.data;
  // RLS only exposes approved projects, so this also rejects unknown slugs.
  const { data: project, error: lookupError } = await db
    .from("projects")
    .select("id")
    .eq("slug", v.slug)
    .maybeSingle();
  if (lookupError) return submitFailed("update", lookupError);
  if (!project)
    return { status: "error", message: "找不到这个项目|Project not found" };

  // Inserted as pending; it joins the timeline and the north-star count once
  // ops approve it.
  const { error } = await db.from("project_updates").insert({
    project_id: project.id,
    kind: v.kind,
    body: v.body,
    url: v.url,
    submitted_by: v.submittedBy,
    review_status: "pending",
  });
  if (error) return submitFailed("update", error);
  return { status: "ok" };
}

// Comments go live without review; ops delete them in the Hub afterwards.
export async function submitProjectComment(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  if (looksAutomated(form)) return { status: "ok" };

  const parsed = parseProjectCommentForm(form);
  if (!parsed.success) return invalidForm(parsed.error);

  const db = getSupabase();
  if (!db) {
    return withoutDatabase(
      "comment",
      "评论暂未开放，请稍后再试|Comments aren't open yet",
      parsed.data,
      { status: "ok" },
    );
  }

  const v = parsed.data;
  const { data: project, error: lookupError } = await db
    .from("projects")
    .select("id")
    .eq("slug", v.slug)
    .maybeSingle();
  if (lookupError) return submitFailed("comment", lookupError);
  if (!project)
    return { status: "error", message: "找不到这个项目|Project not found" };

  const { data, error } = await db
    .from("project_comments")
    .insert({
      project_id: project.id,
      parent_id: v.parentId,
      kind: v.kind,
      nickname: v.nickname,
      body: v.body,
    })
    .select("id")
    .single();
  if (error?.code === RLS_REFUSED && v.parentId) {
    return {
      status: "error",
      message:
        "这条评论已被删除，不能再回复|That comment was removed and can't take replies",
    };
  }
  if (error) return submitFailed("comment", error);

  // The writer sees their comment in this same response; the plaza's
  // counters catch up in the background.
  updateTag(`comments:${v.slug}`);
  revalidateTag("comment-counts", "max");
  return { status: "ok", id: data.id };
}

const deleteInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  id: z.uuid(),
});

/**
 * Deletes (hides) a comment for a signed-in admin. The database checks the key
 * from the /admin cookie; the page only decides whether to show the button.
 */
export async function deleteProjectComment(
  slug: string,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const input = deleteInput.safeParse({ slug, id });
  if (!input.success) return { ok: false, message: "参数无效|Invalid request" };

  const jar = await cookies();
  const key = jar.get(ADMIN_KEY_COOKIE)?.value;
  if (!key) {
    jar.delete(ADMIN_FLAG_COOKIE);
    return {
      ok: false,
      message: "请先在 /admin 登录|Sign in at /admin first",
    };
  }
  const db = getSupabase();
  if (!db)
    return {
      ok: false,
      message: "没有连接数据库|The database isn't connected",
    };

  const { data, error } = await db.rpc("delete_project_comment", {
    comment_id: input.data.id,
    admin_key: key,
  });
  if (error) {
    console.error("[comment] delete failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      message: "删除失败，请稍后再试|Couldn't delete, try again",
    };
  }
  // The key was changed in Vault: this browser has to sign in again. Only a
  // wrong key is ever throttled, so "throttled" means the same here.
  if (data === "denied" || data === "throttled") {
    jar.delete(ADMIN_KEY_COOKIE);
    jar.delete(ADMIN_FLAG_COOKIE);
    return {
      ok: false,
      message:
        "口令已失效，请在 /admin 重新登录|Your admin key changed, sign in again at /admin",
    };
  }

  // "missing" means someone already deleted it; either way it's gone.
  updateTag(`comments:${input.data.slug}`);
  revalidateTag("comment-counts", "max");
  return { ok: true };
}
