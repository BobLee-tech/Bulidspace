// Member accounts: the mascot a member picks, the refined skills, who they are
// looking for, and school-email detection. Values mirror the checks in
// supabase/migrations/20261017000000_member_accounts.sql.
import type { Bi } from "@/components/t";

export const SPARKS = ["vivi", "lumi", "geo", "momo", "kiko"] as const;
export type Spark = (typeof SPARKS)[number];

/** The five mascots ("The Five Sparks"); art lives in public/mascots/<id>.svg. */
export const SPARK_INFO: Record<
  Spark,
  { name: string; zh: string; role: Bi; color: string; say: string; blurb: Bi }
> = {
  vivi: {
    name: "Vivi",
    zh: "知微",
    role: { zh: "探索者", en: "Explorer" },
    color: "#ff8fb3",
    say: "What if…?",
    blurb: {
      zh: "见微知著，总能从细节里发现问题。",
      en: "Spots the problem hiding in the details.",
    },
  },
  lumi: {
    name: "Lumi",
    zh: "灵犀",
    role: { zh: "灵感家", en: "Dreamer" },
    color: "#ffd23f",
    say: "I've got an idea!",
    blurb: {
      zh: "点子很多，热情又乐观，擅长打开可能性。",
      en: "Full of ideas and always opening up new ones.",
    },
  },
  geo: {
    name: "Geo",
    zh: "格物",
    role: { zh: "研究者", en: "Thinker" },
    color: "#5b9bff",
    say: "Let's figure it out.",
    blurb: {
      zh: "冷静严谨，喜欢拆解问题、弄清原理。",
      en: "Calm and careful, takes problems apart to see how they work.",
    },
  },
  momo: {
    name: "Momo",
    zh: "青禾",
    role: { zh: "实践家", en: "Maker" },
    color: "#6fd36a",
    say: "Let's build it!",
    blurb: {
      zh: "动手能力强，喜欢把想法变成现实。",
      en: "Happiest turning an idea into something real.",
    },
  },
  kiko: {
    name: "Kiko",
    zh: "同舟",
    role: { zh: "协作者", en: "Connector" },
    color: "#a98bff",
    say: "Together, we can!",
    blurb: {
      zh: "善于沟通，能把大家连在一起。",
      en: "Brings people together and keeps them talking.",
    },
  },
};

export const MEMBER_SKILL_GROUPS = [
  {
    label: { zh: "开发", en: "Build" },
    skills: ["web", "backend", "mobile", "ai", "hw"],
  },
  { label: { zh: "设计", en: "Design" }, skills: ["uiux", "visual", "motion"] },
  {
    label: { zh: "产品与商业", en: "Product & business" },
    skills: ["product", "growth", "biz"],
  },
  { label: { zh: "其他", en: "Other" }, skills: ["content", "newbie"] },
] as const satisfies readonly { label: Bi; skills: readonly string[] }[];

export const MEMBER_SKILLS = MEMBER_SKILL_GROUPS.flatMap((g) => g.skills);
export type MemberSkill = (typeof MEMBER_SKILLS)[number];
export const MAX_SKILLS = 4;

export const MEMBER_SKILL_LABEL: Record<MemberSkill, Bi> = {
  web: { zh: "Web 前端", en: "Web front end" },
  backend: { zh: "后端", en: "Back end" },
  mobile: { zh: "移动端", en: "Mobile" },
  ai: { zh: "AI / 数据", en: "AI / data" },
  hw: { zh: "硬件 / IoT", en: "Hardware / IoT" },
  uiux: { zh: "UI / UX", en: "UI / UX" },
  visual: { zh: "视觉 / 品牌", en: "Visual / brand" },
  motion: { zh: "动效 / 3D", en: "Motion / 3D" },
  product: { zh: "产品", en: "Product" },
  growth: { zh: "运营增长", en: "Growth" },
  biz: { zh: "商业分析", en: "Business" },
  content: { zh: "内容 / 视频", en: "Content / video" },
  newbie: { zh: "零基础，想学", en: "New, keen to learn" },
};

export const LOOKING_FOR = [
  "design",
  "dev",
  "product",
  "team",
  "learn",
  "friends",
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];
export const MAX_LOOKING = 3;

export const LOOKING_LABEL: Record<LookingFor, Bi> = {
  design: { zh: "设计伙伴", en: "A designer" },
  dev: { zh: "开发伙伴", en: "A developer" },
  product: { zh: "产品伙伴", en: "A product person" },
  team: { zh: "找项目加入", en: "A project to join" },
  learn: { zh: "一起学习", en: "Study buddies" },
  friends: { zh: "交朋友", en: "New friends" },
};

/** Same rule as the database: .edu, .edu.xx or .ac.xx counts as a school. */
export function schoolDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return /(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/.test(domain) ? domain : null;
}

export const isUnsw = (domain: string | null) =>
  !!domain && /(^|\.)unsw\.edu\.au$/.test(domain);

/** "UNSW" on the seal for UNSW addresses, "STUDENT" for any other school. */
export const sealLabel = (domain: string | null) =>
  isUnsw(domain) ? "UNSW" : "STUDENT";

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/** Card number, zero-padded to four digits: BS-0071. */
export const memberCode = (n: number) => `BS-${String(n).padStart(4, "0")}`;

export type Member = {
  id: string;
  memberNo: number;
  handle: string;
  nickname: string;
  schoolDegree: string;
  major: string;
  skills: MemberSkill[];
  spark: Spark;
  building: string | null;
  lookingFor: LookingFor[];
  schoolDomain: string | null;
  verified: boolean;
  isPublic: boolean;
  email: string;
};

/** What the card prints. The join flow fills it in as you type. */
export type CardView = {
  nickname: string;
  schoolDegree: string;
  major: string;
  skills: MemberSkill[];
  spark: Spark;
  /** Null until the card is made: the number comes from the real join order. */
  memberNo: number | null;
  /** Set when the sign-in email is a school address; shows the seal. */
  seal: string | null;
  building: string | null;
  lookingFor: LookingFor[];
};

export const cardViewOf = (m: Member): CardView => ({
  nickname: m.nickname,
  schoolDegree: m.schoolDegree,
  major: m.major,
  skills: m.skills,
  spark: m.spark,
  memberNo: m.memberNo,
  seal: m.verified ? sealLabel(m.schoolDomain) : null,
  building: m.building,
  lookingFor: m.lookingFor,
});
