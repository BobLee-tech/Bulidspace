"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { ADMIN_KEY_COOKIE } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  feedbackSchema,
  intentSchema,
  isLiveStep,
  LIVE_COOKIE,
  liveConfig,
  parseSiteLink,
  pollSchema,
  type FeedbackAnswer,
  type IntentAnswer,
  type LinkAnswer,
  type LinkCheck,
  type LiveStep,
} from "@/lib/event-live";
import {
  checkSite,
  getLiveStore,
  newLiveToken,
  type LiveStore,
} from "@/lib/live-store";

export type LiveResult =
  | { status: "ok"; check?: LinkCheck }
  | { status: "error"; message: string }
  /** Something looks off; sending again with `confirmed` goes through. */
  | { status: "confirm"; message: string };

const slugSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const idSchema = z.uuid().or(z.string().regex(/^[0-9a-f]{16}$/));

const CLOSED: LiveResult = {
  status: "error",
  message: "现场还没开始，或者已经结束了|The live page isn't on right now",
};
const FAILED = {
  status: "error" as const,
  message: "出了点问题，再试一次|Something went wrong, try again",
};
const WHO: LiveResult = {
  status: "error",
  message: "先认一下你是谁|Tell us who you are first",
};

/** Runs against the store, turning a database failure into a retry message. */
async function withStore(run: (store: LiveStore) => Promise<LiveResult>) {
  const store = getLiveStore();
  if (!store) return CLOSED;
  try {
    return await run(store);
  } catch {
    return FAILED;
  }
}

async function token() {
  return (await cookies()).get(LIVE_COOKIE)?.value ?? "";
}

async function remember(value: string) {
  (await cookies()).set(LIVE_COOKIE, value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 3,
  });
}

// ---------- who you are ----------

export async function join(slug: string, name: string): Promise<LiveResult> {
  const fullName = z.string().trim().min(1).max(40).safeParse(name);
  if (!slugSchema.safeParse(slug).success) return FAILED;
  if (!fullName.success) {
    return { status: "error", message: "填一下名字|Enter your name" };
  }
  return withStore(async (store) => {
    const t = newLiveToken();
    const r = await store.join(slug, fullName.data, t);
    if (r === "ok") {
      await remember(t);
      return { status: "ok" };
    }
    if (r === "busy") {
      return {
        status: "error",
        message:
          "同时进来的人有点多，等半分钟再点一次「继续」|Lots of people joining at once — tap Continue again in half a minute",
      };
    }
    return r === "closed" ? CLOSED : FAILED;
  });
}

/** "Not me": two people sharing a laptop, or a wrong match. */
export async function forgetMe(): Promise<void> {
  (await cookies()).delete(LIVE_COOKIE);
}

// ---------- handing things in ----------

export async function vote(
  slug: string,
  choice: string,
  like: string,
  pain: string,
): Promise<LiveResult> {
  const parsed = pollSchema.safeParse({ choice, like, pain });
  const options = liveConfig(slug).poll?.options ?? [];
  if (!slugSchema.safeParse(slug).success) return FAILED;
  if (!parsed.success || !options.some((o) => o.key === parsed.data.choice)) {
    return {
      status: "error",
      message: parsed.success
        ? "选一个|Pick one"
        : parsed.error.issues[0].message,
    };
  }
  return withStore(async (store) => {
    const r = await store.submit(
      slug,
      await token(),
      "poll",
      parsed.data,
      false,
    );
    return r === "ok" ? { status: "ok" } : r === "closed" ? CLOSED : WHO;
  });
}

export async function handInLink(
  slug: string,
  input: string,
  onWall: boolean,
  confirmed: boolean,
): Promise<LiveResult> {
  if (!slugSchema.safeParse(slug).success) return FAILED;
  const link = typeof input === "string" ? parseSiteLink(input) : null;
  if (!link) {
    return {
      status: "error",
      message:
        "看起来不像网址，例如 用户名.github.io|That doesn't look like a link, e.g. username.github.io",
    };
  }
  return withStore(async (store) => {
    const t = await token();
    const me = await store.me(slug, t);
    if (!me) return WHO;
    const signedUpAs = me.github?.toLowerCase();
    if (
      !confirmed &&
      link.githubUser &&
      signedUpAs &&
      link.githubUser !== signedUpAs
    ) {
      return {
        status: "confirm",
        message: `报名填的 GitHub 用户名是 ${signedUpAs}，网址里是 ${link.githubUser}。没错的话再点一次交上去|You signed up as ${signedUpAs}, but the link says ${link.githubUser}. If it's right, tap again`,
      };
    }
    const { check, title } = await checkSite(link);
    const answer: LinkAnswer = {
      url: link.url,
      host: link.host,
      kind: link.kind,
      check,
      title,
      checkedAt: new Date().toISOString(),
    };
    const r = await store.submit(slug, t, "link", answer, onWall === true);
    return r === "ok" ? { status: "ok", check } : r === "closed" ? CLOSED : WHO;
  });
}

/** Looks at a link that wasn't up yet (GitHub Pages takes a few minutes). */
export async function recheckLink(slug: string): Promise<LiveResult> {
  if (!slugSchema.safeParse(slug).success) return FAILED;
  return withStore(async (store) => {
    const t = await token();
    const me = await store.me(slug, t);
    const prev = me?.responses.link;
    if (!prev) return WHO;
    if (prev.payload.check === "live") return { status: "ok", check: "live" };
    const link = parseSiteLink(prev.payload.url);
    if (!link) return FAILED;
    const { check, title } = await checkSite(link);
    if (check === prev.payload.check) return { status: "ok", check };
    const answer: LinkAnswer = {
      ...prev.payload,
      check,
      title: title ?? prev.payload.title,
      checkedAt: new Date().toISOString(),
    };
    const r = await store.submit(slug, t, "link", answer, prev.onWall);
    return r === "ok" ? { status: "ok", check } : r === "closed" ? CLOSED : WHO;
  });
}

export async function sendFeedback(
  slug: string,
  input: FeedbackAnswer,
): Promise<LiveResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!slugSchema.safeParse(slug).success) return FAILED;
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  return withStore(async (store) => {
    const r = await store.submit(
      slug,
      await token(),
      "feedback",
      parsed.data,
      false,
    );
    return r === "ok" ? { status: "ok" } : r === "closed" ? CLOSED : WHO;
  });
}

/** After the guest's talk: what they'd like to do next, and how to reach them. */
export async function sendIntent(
  slug: string,
  input: IntentAnswer,
): Promise<LiveResult> {
  const parsed = intentSchema.safeParse(input);
  if (!slugSchema.safeParse(slug).success) return FAILED;
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  return withStore(async (store) => {
    const r = await store.submit(
      slug,
      await token(),
      "intent",
      parsed.data,
      false,
    );
    return r === "ok" ? { status: "ok" } : r === "closed" ? CLOSED : WHO;
  });
}

export async function like(
  slug: string,
  responseId: string,
  on: boolean,
  note: string,
): Promise<LiveResult> {
  const text = z
    .string()
    .trim()
    .max(80)
    .safeParse(note ?? "");
  if (
    !slugSchema.safeParse(slug).success ||
    !idSchema.safeParse(responseId).success
  ) {
    return FAILED;
  }
  if (!text.success) {
    return { status: "error", message: "最多 80 个字|At most 80 characters" };
  }
  return withStore(async (store) => {
    const r = await store.heart(
      slug,
      await token(),
      responseId,
      on === true,
      text.data || null,
    );
    return r === "ok" ? { status: "ok" } : WHO;
  });
}

// ---------- host ----------

async function adminKey() {
  return (await cookies()).get(ADMIN_KEY_COOKIE)?.value ?? "";
}

/** Runs a host action with the /admin key. Without one the database isn't
 * asked at all: every wrong key counts towards the shared throttle. */
async function asHost(run: (store: LiveStore, key: string) => Promise<string>) {
  const key = await adminKey();
  if (!key && isSupabaseConfigured()) return hostMessage("denied");
  return withStore(async (store) => hostMessage(await run(store, key)));
}

// "throttled" falls through to "denied": only a wrong key is throttled, and
// waiting doesn't fix a wrong key, signing in again does.
function hostMessage(r: string): LiveResult {
  if (r === "ok") return { status: "ok" };
  if (r === "missing")
    return { status: "error", message: "找不到这一条|Not found" };
  return {
    status: "error",
    message: "先在 /admin 输入管理员口令|Sign in at /admin first",
  };
}

export async function setLiveStep(
  slug: string,
  step: LiveStep | null,
): Promise<LiveResult> {
  if (
    !slugSchema.safeParse(slug).success ||
    (step !== null && !isLiveStep(step))
  ) {
    return FAILED;
  }
  return asHost((store, key) => store.hostStep(slug, key, step));
}

export async function setSpotlight(
  slug: string,
  responseId: string | null,
): Promise<LiveResult> {
  if (
    !slugSchema.safeParse(slug).success ||
    (responseId !== null && !idSchema.safeParse(responseId).success)
  ) {
    return FAILED;
  }
  return asHost((store, key) => store.hostSpotlight(slug, key, responseId));
}

export async function setHidden(
  slug: string,
  responseId: string,
  hidden: boolean,
): Promise<LiveResult> {
  if (
    !slugSchema.safeParse(slug).success ||
    !idSchema.safeParse(responseId).success
  ) {
    return FAILED;
  }
  return asHost((store, key) =>
    store.hostHide(slug, key, responseId, hidden === true),
  );
}
