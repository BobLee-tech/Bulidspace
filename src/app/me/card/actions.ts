"use server";

import { revalidatePath } from "next/cache";
import { saveCard } from "@/lib/auth";
import { cardSaveSchema } from "@/lib/member-forms";

export type SaveCardState =
  { status: "ok" } | { status: "error"; message: string };

/**
 * Saves the card studio. The payload is untrusted: zod checks every value,
 * auth.ts checks the member, and RLS plus the verified-only trigger in
 * 20261017010000_member_cards.sql have the final say.
 */
export async function saveCardDesign(payload: unknown): Promise<SaveCardState> {
  const parsed = cardSaveSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message.includes("|")
        ? parsed.error.issues[0].message
        : "卡片设置有误，刷新后再试|Something about the card didn't check out, reload and try again",
    };
  }
  const saved = await saveCard(parsed.data);
  if (!saved.ok) return { status: "error", message: saved.message };
  // /me and /welcome read the design on every request; this refreshes any
  // copy the router is holding.
  revalidatePath("/me", "layout");
  revalidatePath("/welcome");
  return { status: "ok" };
}
