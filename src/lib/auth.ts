import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import {
  DEFAULT_DESIGN,
  lockedParts,
  readDesign,
  type CardDesign,
} from "./card-design";
import type {
  CardSaveInput,
  MemberProfileInput,
  SurveyInput,
} from "./member-forms";
import {
  schoolDomain,
  type LookingFor,
  type Member,
  type MemberSkill,
  type Spark,
} from "./members";
import { isSupabaseConfigured } from "./supabase/client";
import { getSupabaseAuth } from "./supabase/server";

// Every member read and write goes through here. With Supabase configured the
// session lives in Supabase's cookies and the database functions in
// 20261017000000_member_accounts.sql do the writes. Without it, development
// runs on a single cookie (any 6-digit code works) so the flow can be tried
// locally; production without Supabase refuses to sign anyone in.

export type Result<T = undefined> =
  { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (message: string): Result<never> => ({ ok: false, message });
const CLOSED = "登录暂未开放，请稍后再试|Sign-in isn't open yet";

const devMode = () =>
  !isSupabaseConfigured() && process.env.NODE_ENV !== "production";

type ProfileRow = {
  id: string;
  member_no: number;
  handle: string;
  nickname: string;
  school_degree: string;
  major: string;
  skills: string[];
  spark: string;
  building: string | null;
  looking_for: string[];
  school_domain: string | null;
  school_verified_at: string | null;
  is_public: boolean;
};

function toMember(row: ProfileRow, email: string): Member {
  return {
    id: row.id,
    memberNo: row.member_no,
    handle: row.handle,
    nickname: row.nickname,
    schoolDegree: row.school_degree,
    major: row.major,
    skills: row.skills as MemberSkill[],
    spark: row.spark as Spark,
    building: row.building,
    lookingFor: row.looking_for as LookingFor[],
    schoolDomain: row.school_domain,
    verified: Boolean(row.school_verified_at),
    isPublic: row.is_public,
    email,
  };
}

/* ---------- development stand-in (no Supabase) ---------- */

const DEV_COOKIE = "bs_dev_member";
type DevSession = {
  email: string;
  member: Member | null;
  survey: boolean;
  card?: CardDesign;
};

async function readDev(): Promise<DevSession | null> {
  const raw = (await cookies()).get(DEV_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString()) as DevSession;
  } catch {
    return null;
  }
}

async function writeDev(session: DevSession | null) {
  const store = await cookies();
  if (!session) {
    store.delete(DEV_COOKIE);
    return;
  }
  store.set(
    DEV_COOKIE,
    Buffer.from(JSON.stringify(session)).toString("base64url"),
    { httpOnly: true, sameSite: "lax", path: "/" },
  );
}

/* ---------- sign in ---------- */

export async function sendCode(email: string): Promise<Result> {
  if (devMode()) return ok(undefined);
  const supabase = await getSupabaseAuth();
  if (!supabase) return fail(CLOSED);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (!error) return ok(undefined);
  if (error.status === 429) {
    return fail(
      "发送太频繁了，请一分钟后再试|Too many codes sent, try again in a minute",
    );
  }
  console.error("[auth] send code failed", {
    status: error.status,
    code: error.code,
  });
  return fail("验证码发送失败，请稍后再试|Couldn't send the code, try again");
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<Result<{ hasCard: boolean }>> {
  if (devMode()) {
    const prev = await readDev();
    // Same email: keep the card; a different one starts over.
    const kept = prev?.email === email ? prev : null;
    await writeDev({
      email,
      member: kept?.member ?? null,
      survey: kept?.survey ?? false,
      card: kept?.card,
    });
    return ok({ hasCard: Boolean(kept?.member) });
  }
  const supabase = await getSupabaseAuth();
  if (!supabase) return fail(CLOSED);
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    return fail(
      "验证码不对或已过期，重新发一个试试|That code is wrong or expired, send a new one",
    );
  }
  const session = await getSession();
  return ok({ hasCard: Boolean(session?.member) });
}

export async function signOut() {
  if (devMode()) return writeDev(null);
  const supabase = await getSupabaseAuth();
  await supabase?.auth.signOut();
}

/* ---------- the signed-in member ---------- */

/** The signed-in email and, once the card is made, the member. Memoised per request. */
export const getSession = cache(
  async (): Promise<{ email: string; member: Member | null } | null> => {
    // Always per request, even when Supabase isn't configured and no cookie
    // is read: a signed-in page must never be prerendered.
    await connection();
    if (devMode()) {
      const dev = await readDev();
      return dev ? { email: dev.email, member: dev.member } : null;
    }
    const supabase = await getSupabaseAuth();
    if (!supabase) return null;
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    const email = String(claims.email ?? "");
    const { data: row } = await supabase
      .from("profiles")
      .select(
        "id, member_no, handle, nickname, school_degree, major, skills, spark, building, looking_for, school_domain, school_verified_at, is_public",
      )
      .eq("id", claims.sub)
      .maybeSingle<ProfileRow>();
    return { email, member: row ? toMember(row, email) : null };
  },
);

export async function createMember(
  input: MemberProfileInput,
): Promise<Result<Member>> {
  const session = await getSession();
  if (!session) return fail("先用邮箱登录|Sign in with your email first");
  if (session.member) return ok(session.member);

  if (devMode()) {
    const domain = schoolDomain(session.email);
    const member: Member = {
      id: "dev",
      memberNo: 71,
      handle:
        input.nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "builder-71",
      nickname: input.nickname,
      schoolDegree: input.schoolDegree,
      major: input.major,
      skills: input.skills,
      spark: input.spark,
      building: input.building,
      lookingFor: input.lookingFor,
      schoolDomain: domain,
      verified: Boolean(domain),
      isPublic: false,
      email: session.email,
    };
    await writeDev({ email: session.email, member, survey: false });
    return ok(member);
  }

  const supabase = await getSupabaseAuth();
  if (!supabase) return fail(CLOSED);
  const { data, error } = await supabase
    .rpc("join_builderspace", {
      p_nickname: input.nickname,
      p_school_degree: input.schoolDegree,
      p_major: input.major,
      p_skills: input.skills,
      p_spark: input.spark,
      p_building: input.building,
      p_looking_for: input.lookingFor,
      p_channel: input.channel,
    })
    .single<ProfileRow>();
  if (error || !data) {
    if (error?.code === "PT429") {
      return fail(
        "加入的人有点多，请一分钟后再试|Lots of people joining right now, try again in a minute",
      );
    }
    console.error("[auth] create member failed", {
      code: error?.code,
      message: error?.message,
    });
    return fail("卡片生成失败，请稍后再试|Couldn't make your card, try again");
  }
  return ok(toMember(data, session.email));
}

/* ---------- optional survey ---------- */

export async function surveyDone(): Promise<boolean> {
  if (devMode()) return (await readDev())?.survey ?? false;
  const supabase = await getSupabaseAuth();
  if (!supabase) return false;
  const { data } = await supabase.rpc("my_join_survey_done");
  return Boolean(data);
}

export async function saveSurvey(input: SurveyInput): Promise<Result> {
  const session = await getSession();
  if (!session?.member) return fail("先生成你的卡片|Make your card first");
  if (devMode()) {
    // Never log the name or zID, even in development.
    console.info("[survey] dev, dropped:", {
      ...input,
      fullName: input.fullName && "[redacted]",
      zid: input.zid && "[redacted]",
    });
    const dev = await readDev();
    await writeDev({
      email: session.email,
      member: session.member,
      survey: true,
      card: dev?.card,
    });
    return ok(undefined);
  }
  const supabase = await getSupabaseAuth();
  if (!supabase) return fail(CLOSED);
  const { error } = await supabase.rpc("save_join_survey", {
    p_stalled_project:
      input.stalledProject === null ? null : input.stalledProject === "yes",
    p_blockers: input.blockers,
    p_referral_source: input.referralSource,
    p_next_event_interest: input.eventInterest,
    p_showcase_consent: input.showcaseConsent,
    p_affiliation_support: input.affiliationSupport,
    p_full_name: input.fullName,
    p_zid: input.zid,
    p_affiliation_consent: input.affiliationConsent,
  });
  if (error) {
    console.error("[auth] save survey failed", {
      code: error.code,
      message: error.message,
    });
    return fail("提交失败，请稍后再试|Couldn't submit, please try again");
  }
  return ok(undefined);
}

/* ---------- card studio ---------- */

type CardRow = {
  material: string;
  tint: string;
  pattern: string;
  tagline: string;
  stickers: unknown;
};

/** The signed-in member's saved card design, or the default. Memoised per request. */
export const getCardDesign = cache(async (): Promise<CardDesign> => {
  const session = await getSession();
  if (!session?.member) return DEFAULT_DESIGN;
  if (devMode()) {
    const card = (await readDev())?.card;
    return card ? readDesign(card) : DEFAULT_DESIGN;
  }
  const supabase = await getSupabaseAuth();
  if (!supabase) return DEFAULT_DESIGN;
  const { data } = await supabase
    .from("member_cards")
    .select("material, tint, pattern, tagline, stickers")
    .eq("user_id", session.member.id)
    .maybeSingle<CardRow>();
  return data ? readDesign(data) : DEFAULT_DESIGN;
});

const VERIFIED_ONLY =
  "五色全息、阳极钛和校园贴纸需要学校邮箱认证|Holo foil, titanium and campus stickers are for verified members";

/**
 * Saves the studio: the card's look in member_cards, and the builder-profile
 * back (mascot, what you're building, who you're looking for) in profiles.
 */
export async function saveCard(input: CardSaveInput): Promise<Result<Member>> {
  const session = await getSession();
  if (!session?.member) return fail("先生成你的卡片|Make your card first");
  const m = session.member;
  // The database trigger is the real check; this one just says it nicely.
  const locked = lockedParts(input.design);
  if (!m.verified && (locked.material || locked.stickers)) {
    return fail(VERIFIED_ONLY);
  }
  const member: Member = {
    ...m,
    spark: input.spark,
    building: input.building,
    lookingFor: input.lookingFor,
  };

  if (devMode()) {
    const dev = await readDev();
    await writeDev({
      email: session.email,
      member,
      survey: dev?.survey ?? false,
      card: input.design,
    });
    return ok(member);
  }

  const supabase = await getSupabaseAuth();
  if (!supabase) return fail(CLOSED);
  const { material, tint, pattern, tagline, stickers } = input.design;
  const row = { material, tint, pattern, tagline, stickers };
  const update = () =>
    supabase
      .from("member_cards")
      .update(row)
      .eq("user_id", m.id)
      .select("user_id");
  let { data: updated, error } = await update();
  if (!error && !updated?.length) {
    ({ error } = await supabase
      .from("member_cards")
      .insert({ user_id: m.id, ...row }));
    // Saved twice at once: the other request made the row, so update it.
    if (error?.code === "23505") ({ data: updated, error } = await update());
  }
  if (error) {
    if (error.code === "42501") return fail(VERIFIED_ONLY);
    console.error("[auth] save card failed", {
      code: error.code,
      message: error.message,
    });
    return fail("保存失败，请稍后再试|Couldn't save your card, try again");
  }
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      spark: input.spark,
      building: input.building,
      looking_for: input.lookingFor,
    })
    .eq("id", m.id);
  if (profileError) {
    console.error("[auth] save card back failed", {
      code: profileError.code,
      message: profileError.message,
    });
    return fail(
      "卡面已保存，背面没存上，请再点一次保存|The front saved but the back didn't, press save again",
    );
  }
  return ok(member);
}
