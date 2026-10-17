"use server";

import { redirect } from "next/navigation";
import { saveSurvey, signOut } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/forms";
import { parseSurvey } from "@/lib/member-forms";

export async function submitSurvey(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = parseSurvey(form);
  if (!parsed.success) {
    return {
      status: "error",
      message: "有几项还没填好|A few fields need attention",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const saved = await saveSurvey(parsed.data);
  return saved.ok
    ? { status: "ok" }
    : { status: "error", message: saved.message };
}

export async function logOut() {
  await signOut();
  redirect("/join");
}
