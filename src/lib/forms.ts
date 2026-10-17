import { z } from "zod";
import { MEDIA_PATH, VIDEO_MAX_SECONDS } from "./media";
import {
  COMMENT_KINDS,
  ROLES,
  UPDATE_KINDS,
  VOLUNTEER_POSITIONS,
  WEEKLY_HOURS,
} from "./types";

const text = (max: number) =>
  z.string().trim().min(1, "必填|Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
// Matches the longest URL column in the database (volunteer portfolio_url).
const URL_MAX = 300;
// `github.com/me` and `www.x.dev` are links too: anything without a scheme
// gets https://. A `host:port` start (digits after the colon) is not a scheme,
// while `javascript:` / `mailto:` keep theirs and are then rejected.
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
export function withScheme(link: string) {
  if (!link) return link;
  // The database checks for a lower-case `http(s)://`, slashes included.
  if (SCHEME.test(link))
    return link.replace(
      /^(https?):\/*/i,
      (_, p: string) => `${p.toLowerCase()}://`,
    );
  return `https://${link.replace(/^\/+/, "")}`;
}
const optionalUrl = z
  .string()
  .trim()
  .transform(withScheme)
  .pipe(z.string().max(URL_MAX, "链接太长了|That link is too long"))
  .transform((v) => v || null)
  .pipe(
    z
      .url({
        protocol: /^https?$/,
        // A real host has a dot in it (rules out `https://hello`).
        hostname: /^[^.]+(\.[^.]+)+$/,
        error: "请填写有效的链接|Enter a valid link",
      })
      .nullable(),
  );

/**
 * Channel tag from the join link (PRD §6.5 归因): `?ref=xhs-w1` or
 * `utm_source=…`. Anything malformed is dropped rather than blocking signup.
 */
export function normalizeChannel(value: string | null | undefined) {
  const v = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9_-]{1,40}$/.test(v) ? v : null;
}

export function channelFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeChannel(params.get("ref") ?? params.get("utm_source"));
}

// Core-team volunteers can be reached, so unlike the join form this one asks
// for contact details, and nothing is stored unless the applicant consents.
// Still no student card and no zID.
//
// Only the WeChat name, the email and the positions are required: the email is
// what an account on the internal tool is opened with. Everything else is
// optional for now; to make a field required again, swap it back to `text`.
export const volunteerSchema = z.object({
  nickname: text(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "必填|Required")
    .max(254)
    .pipe(z.email({ error: "请填写有效的邮箱|Enter a valid email" })),
  schoolDegree: optionalText(80),
  positions: z
    .array(z.enum(VOLUNTEER_POSITIONS))
    .min(1, "至少选一个职位|Pick at least one position")
    .max(VOLUNTEER_POSITIONS.length),
  weeklyHours: z
    .enum(WEEKLY_HOURS, {
      error: "请选择每周可投入时间|Pick your weekly hours",
    })
    .nullable(),
  about: optionalText(500),
  portfolioUrl: optionalUrl,
  channel: z.string().transform(normalizeChannel),
  dataConsent: z.literal(true, {
    error: "勾选同意后才能提交|Tick the box to submit",
  }),
});
export type VolunteerInput = z.infer<typeof volunteerSchema>;

// Paths of files the browser already uploaded; empty means none.
const mediaPath = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(
      z.string().regex(pattern, "上传的文件无效|Invalid upload").nullable(),
    );
const focus = z.coerce.number().int().min(0).max(100).catch(50);

const projectMediaSchema = z
  .object({
    coverPath: mediaPath(MEDIA_PATH.cover),
    coverFocusX: focus,
    coverFocusY: focus,
    videoPath: mediaPath(MEDIA_PATH.video),
    videoPosterPath: mediaPath(MEDIA_PATH.poster),
    videoSeconds: z.coerce
      .number()
      .catch(0)
      .transform((v) => (v > 0 ? Math.round(v * 100) / 100 : null))
      .pipe(
        z
          .number()
          .max(
            VIDEO_MAX_SECONDS,
            "视频请剪到 3 分钟以内|Keep the video under 3 minutes",
          )
          .nullable(),
      ),
  })
  .transform((m) =>
    // A video row needs its length; drop the leftovers of a removed video.
    m.videoPath && m.videoSeconds
      ? m
      : { ...m, videoPath: null, videoPosterPath: null, videoSeconds: null },
  );

export const projectSubmissionSchema = z.object({
  name: text(60),
  problem: text(280),
  targetUser: text(80),
  neededRoles: z.array(z.enum(ROLES)).max(ROLES.length),
  nextStep: optionalText(280),
  ownerName: text(40),
  contact: text(120),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  media: projectMediaSchema,
});
export type ProjectSubmission = z.infer<typeof projectSubmissionSchema>;

export const projectUpdateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(UPDATE_KINDS, { error: "请选择进展类型|Pick an update type" }),
  body: text(500),
  url: optionalUrl,
  submittedBy: text(40),
});
export type ProjectUpdateSubmission = z.infer<typeof projectUpdateSchema>;

// A top-level comment picks a kind; a reply names its thread and has none, so
// a kind sent along with a reply is dropped.
export const projectCommentSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    parentId: z
      .string()
      .trim()
      .transform((v) => v || null)
      .pipe(z.uuid().nullable()),
    kind: z
      .enum(COMMENT_KINDS, { error: "请选择评论类型|Pick a comment type" })
      .nullable(),
    nickname: text(40),
    body: text(500),
  })
  .superRefine((c, ctx) => {
    if (!c.parentId && !c.kind)
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "请选择评论类型|Pick a comment type",
      });
  })
  .transform((c) => (c.parentId ? { ...c, kind: null } : c));
export type ProjectCommentSubmission = z.infer<typeof projectCommentSchema>;

export function parseVolunteerForm(form: FormData) {
  return volunteerSchema.safeParse({
    nickname: form.get("nickname") ?? "",
    email: form.get("email") ?? "",
    schoolDegree: form.get("schoolDegree") ?? "",
    positions: form.getAll("positions"),
    weeklyHours: form.get("weeklyHours") ?? null,
    about: form.get("about") ?? "",
    portfolioUrl: form.get("portfolioUrl") ?? "",
    channel: form.get("channel") ?? "",
    dataConsent: form.get("dataConsent") === "on",
  });
}

export function parseProjectForm(form: FormData) {
  return projectSubmissionSchema.safeParse({
    name: form.get("name") ?? "",
    problem: form.get("problem") ?? "",
    targetUser: form.get("targetUser") ?? "",
    neededRoles: form.getAll("neededRoles"),
    nextStep: form.get("nextStep") ?? "",
    ownerName: form.get("ownerName") ?? "",
    contact: form.get("contact") ?? "",
    repoUrl: form.get("repoUrl") ?? "",
    demoUrl: form.get("demoUrl") ?? "",
    media: {
      coverPath: form.get("coverPath") ?? "",
      coverFocusX: form.get("coverFocusX") ?? 50,
      coverFocusY: form.get("coverFocusY") ?? 50,
      videoPath: form.get("videoPath") ?? "",
      videoPosterPath: form.get("videoPosterPath") ?? "",
      videoSeconds: form.get("videoSeconds") ?? "",
    },
  });
}

export function parseProjectUpdateForm(form: FormData) {
  return projectUpdateSchema.safeParse({
    slug: form.get("slug") ?? "",
    kind: form.get("kind") ?? undefined,
    body: form.get("body") ?? "",
    url: form.get("url") ?? "",
    submittedBy: form.get("submittedBy") ?? "",
  });
}

export function parseProjectCommentForm(form: FormData) {
  return projectCommentSchema.safeParse({
    slug: form.get("slug") ?? "",
    parentId: form.get("parentId") ?? "",
    kind: form.get("kind") || null,
    nickname: form.get("nickname") ?? "",
    body: form.get("body") ?? "",
  });
}

/** Slug for a submitted project; ops can rename it during review. */
export function projectSlug(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `${base}-${suffix}` : `project-${suffix}`;
}

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok"; nickname?: string; id?: string };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
