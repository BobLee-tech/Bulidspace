import {
  NO_MEDIA,
  type Project,
  type SiteEvent,
  type Tutorial,
  type WeeklyPick,
} from "./types";

// Used only when Supabase is not configured (local dev, preview builds).
// No invented events or projects: the first workshop (the same row as
// 20261018000000_event_registrations.sql) and CourseMate, the club's own
// product, are the only entries. Everything else comes from Supabase.

export const sampleEvents: SiteEvent[] = [
  {
    slug: "put-yourself-online",
    title: "做一个自己的个人网站",
    kind: "workshop",
    startsAt: "2026-10-22T10:00:00+11:00",
    endsAt: "2026-10-22T13:00:00+11:00",
    location: "UNSW MCIC",
    summary: "带上电脑，用 AI 做一个个人网站，发布到 GitHub Pages。",
    signupUrl: null,
    capacity: 52,
    registrationClosesAt: "2026-10-21T23:59:59+11:00",
    seatQuotas: { unsw: 42, external: 10 },
  },
];

export const sampleProjects: Project[] = [
  {
    slug: "coursemate",
    name: "CourseMate",
    problem: "选课前想知道一门课的真实工作量，现在只能翻群聊记录。",
    targetUser: "授课型硕士新生",
    status: "building",
    neededRoles: ["tester", "backend"],
    nextStep: "邀请 20 位同学试用课程评价流程。",
    contact: "BuilderSpace 团队",
    ownerName: "BuilderSpace 团队",
    repoUrl: null,
    demoUrl: null,
    updatedAt: "2026-10-10T12:00:00+11:00",
    media: NO_MEDIA,
    commentCount: 0,
    en: {
      name: null,
      problem:
        "Before picking a course you want to know its real workload, and right now the only way is digging through group chats.",
      targetUser: "New coursework master's students",
      nextStep: "Invite 20 classmates to try the course review flow.",
    },
    translated: "en",
  },
];

export const sampleTutorials: Tutorial[] = [];
export const samplePicks: WeeklyPick[] = [];
