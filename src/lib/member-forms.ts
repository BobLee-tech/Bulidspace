import { z } from "zod";
import { cardDesignSchema } from "./card-design";
import { normalizeChannel } from "./forms";
import {
  LOOKING_FOR,
  MAX_LOOKING,
  MAX_SKILLS,
  MEMBER_SKILLS,
  SPARKS,
} from "./members";
import { BLOCKERS, EVENT_INTEREST, REFERRAL_SOURCES } from "./types";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "先填邮箱，验证码会发到这里|Enter your email first")
  .max(254)
  .pipe(
    z.email({
      error:
        "邮箱格式不对，检查一下 @ 后面的部分|That email doesn't look right",
    }),
  );

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "验证码是 6 位数字|The code is 6 digits");

const text = (max: number) =>
  z.string().trim().min(1, "必填|Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const memberProfileSchema = z.object({
  nickname: text(20),
  schoolDegree: z.string().trim().max(80),
  major: z.string().trim().max(80),
  skills: z
    .array(z.enum(MEMBER_SKILLS))
    .max(
      MAX_SKILLS,
      `技能最多选 ${MAX_SKILLS} 个|Pick up to ${MAX_SKILLS} skills`,
    ),
  spark: z.enum(SPARKS, { error: "选一块拼图|Pick your piece" }),
  building: optionalText(40),
  lookingFor: z
    .array(z.enum(LOOKING_FOR))
    .max(MAX_LOOKING, `最多选 ${MAX_LOOKING} 个|Pick up to ${MAX_LOOKING}`),
  channel: z.string().transform(normalizeChannel),
});
export type MemberProfileInput = z.infer<typeof memberProfileSchema>;

export function parseMemberProfile(form: FormData) {
  return memberProfileSchema.safeParse({
    nickname: form.get("nickname") ?? "",
    schoolDegree: form.get("schoolDegree") ?? "",
    major: form.get("major") ?? "",
    skills: [...new Set(form.getAll("skills"))],
    spark: form.get("spark") ?? undefined,
    building: form.get("building") ?? "",
    lookingFor: [...new Set(form.getAll("lookingFor"))],
    channel: form.get("channel") ?? "",
  });
}

const ZID = /^z?\d{7}$/i;
const dropped = <T>(value: T) => z.unknown().transform(() => value);

// The second half of the old join form, now optional after the card is made.
// Name and zID only when the member backs the club application and consents.
const surveyFields = {
  stalledProject: z.enum(["yes", "no"]).nullable(),
  blockers: z.array(z.enum(BLOCKERS)).max(BLOCKERS.length),
  referralSource: z.enum(REFERRAL_SOURCES).nullable(),
  eventInterest: z.enum(EVENT_INTEREST).nullable(),
  showcaseConsent: z.boolean(),
};

export const surveySchema = z.discriminatedUnion("affiliationSupport", [
  z.object({
    ...surveyFields,
    affiliationSupport: z.literal(false),
    fullName: dropped(null),
    zid: dropped(null),
    affiliationConsent: dropped(false),
  }),
  z.object({
    ...surveyFields,
    affiliationSupport: z.literal(true),
    fullName: text(80),
    zid: z
      .string()
      .trim()
      .regex(ZID, "zID 是 z 加 7 位数字|A zID is z followed by 7 digits")
      .transform((v) => `z${v.replace(/^z/i, "")}`),
    affiliationConsent: z.literal(true, {
      error: "勾选同意后才能登记|Tick the box to register your support",
    }),
  }),
]);
export type SurveyInput = z.infer<typeof surveySchema>;

export function parseSurvey(form: FormData) {
  return surveySchema.safeParse({
    stalledProject: form.get("stalledProject") || null,
    blockers: form.getAll("blockers"),
    referralSource: form.get("referralSource") || null,
    eventInterest: form.get("eventInterest") || null,
    showcaseConsent: form.get("showcaseConsent") === "on",
    affiliationSupport: form.get("affiliationSupport") === "on",
    fullName: form.get("fullName") ?? "",
    zid: form.get("zid") ?? "",
    affiliationConsent: form.get("affiliationConsent") === "on",
  });
}

// The card studio's save: the design, plus the builder-profile back.
export const cardSaveSchema = z.object({
  design: cardDesignSchema,
  spark: memberProfileSchema.shape.spark,
  building: memberProfileSchema.shape.building,
  lookingFor: memberProfileSchema.shape.lookingFor,
});
export type CardSaveInput = z.infer<typeof cardSaveSchema>;
