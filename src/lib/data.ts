import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COVER_BUCKET, VIDEO_BUCKET } from "./media";
import { getSupabase } from "./supabase/client";
import {
  samplePicks,
  sampleProjects,
  sampleEvents,
  sampleTutorials,
} from "./sample-data";
import {
  NO_MEDIA,
  NO_SIGNUPS,
  type EventSignups,
  type Lang,
  type Project,
  type ProjectComment,
  type ProjectUpdate,
  type SiteEvent,
  type Tutorial,
  type WeeklyPick,
} from "./types";

// Every read is cached for a few minutes; ops edits in Supabase show up on the
// next revalidation without a redeploy.

export async function getEvents(): Promise<SiteEvent[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");

  const db = getSupabase();
  if (!db) return sampleEvents;

  const { data, error } = await db
    .from("events")
    .select(
      "slug,title,kind,starts_at,ends_at,location,summary,signup_url,capacity,registration_closes_at,seat_quotas",
    )
    .eq("published", true)
    .order("starts_at");
  if (error) throw error;

  return data.map((e) => ({
    slug: e.slug,
    title: e.title,
    kind: e.kind,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    location: e.location,
    summary: e.summary,
    signupUrl: e.signup_url,
    capacity: e.capacity,
    registrationClosesAt: e.registration_closes_at,
    seatQuotas: e.seat_quotas,
  }));
}

export async function getEvent(slug: string): Promise<SiteEvent | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");

  return (await getEvents()).find((e) => e.slug === slug) ?? null;
}

/**
 * Head-counts for events people sign up for on the site, by slug. Numbers
 * only (event_signup_stats() in 20261018000000_event_registrations.sql); a
 * new sign-up refreshes the tag so the person sees themselves counted.
 */
export async function getEventSignups(): Promise<Record<string, EventSignups>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("event-signups");

  const db = getSupabase();
  if (!db) return {};

  const { data, error } = await db.rpc("event_signup_stats");
  if (error) throw error;

  return Object.fromEntries(
    (
      data as {
        slug: string;
        confirmed: number;
        waitlist: number;
        by_group: EventSignups["byGroup"];
      }[]
    ).map((s) => [
      s.slug,
      { confirmed: s.confirmed, waitlist: s.waitlist, byGroup: s.by_group },
    ]),
  );
}

/** Splits events around "now"; refreshed with the cache, so at most minutes stale. */
export async function getEventSchedule(): Promise<{
  upcoming: SiteEvent[];
  past: SiteEvent[];
}> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");

  const events = await getEvents();
  const now = Date.now();
  return {
    upcoming: events.filter((e) => Date.parse(e.endsAt) > now),
    past: events.filter((e) => Date.parse(e.endsAt) <= now).reverse(),
  };
}

/**
 * One event with its head-count and where sign-up stands. "now" is read in
 * the cache, so the page flips to closed within a minute of the deadline; the
 * database refuses late sign-ups on its own.
 */
export async function getEventDetail(slug: string): Promise<{
  event: SiteEvent;
  signups: EventSignups;
  phase: "open" | "closed" | "past" | "external";
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("events", "event-signups");

  const [event, signups] = await Promise.all([
    getEvent(slug),
    getEventSignups(),
  ]);
  if (!event) return null;
  const now = Date.now();
  const closes = event.registrationClosesAt
    ? Math.min(
        Date.parse(event.registrationClosesAt),
        Date.parse(event.startsAt),
      )
    : null;
  return {
    event,
    signups: signups[slug] ?? NO_SIGNUPS,
    phase:
      now >= Date.parse(event.endsAt)
        ? "past"
        : closes === null
          ? "external"
          : now < closes
            ? "open"
            : "closed",
  };
}

const PROJECT_COLUMNS =
  "slug,name,problem,target_user,status,needed_roles,next_step,contact,owner_name,repo_url,demo_url,updated_at," +
  "cover_path,cover_focus_x,cover_focus_y,video_path,video_poster_path,video_seconds," +
  "name_en,problem_en,target_user_en,next_step_en,original_lang";

/**
 * The side ops translated, which gets a small "Translated" mark: the other
 * language from the one the author wrote in, once the English side exists.
 */
function translatedSide(
  originalLang: Lang | null,
  hasEnglish: boolean,
): Lang | null {
  if (!originalLang || !hasEnglish) return null;
  return originalLang === "zh" ? "en" : "zh";
}

type ProjectRow = {
  slug: string;
  name: string;
  problem: string;
  target_user: string;
  status: Project["status"];
  needed_roles: Project["neededRoles"];
  next_step: string | null;
  contact: string;
  owner_name: string;
  repo_url: string | null;
  demo_url: string | null;
  updated_at: string;
  cover_path: string | null;
  cover_focus_x: number;
  cover_focus_y: number;
  video_path: string | null;
  video_poster_path: string | null;
  video_seconds: number | null;
  name_en: string | null;
  problem_en: string | null;
  target_user_en: string | null;
  next_step_en: string | null;
  original_lang: Lang | null;
  /** Only the plaza asks for it: `project_comments(count)`. */
  project_comments?: { count: number }[];
};

// Media buckets are private; storage RLS only signs files of approved
// projects. A day outlives every cached render that embeds the URLs.
const SIGNED_URL_SECONDS = 60 * 60 * 24;

async function signAll(
  db: SupabaseClient,
  bucket: string,
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return new Map();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(wanted, SIGNED_URL_SECONDS);
  // A missing file shouldn't take the plaza down; the card falls back to the
  // generated cover.
  if (error) {
    console.error(`[media] signing ${bucket} failed`, error.message);
    return new Map();
  }
  return new Map(
    data.flatMap((d) =>
      d.path && d.signedUrl && !d.error ? [[d.path, d.signedUrl]] : [],
    ),
  );
}

async function toProjects(
  db: SupabaseClient,
  rows: ProjectRow[],
): Promise<Project[]> {
  const [covers, videos] = await Promise.all([
    signAll(
      db,
      COVER_BUCKET,
      rows.flatMap((r) => [r.cover_path, r.video_poster_path]),
    ),
    signAll(
      db,
      VIDEO_BUCKET,
      rows.map((r) => r.video_path),
    ),
  ]);
  const url = (map: Map<string, string>, path: string | null) =>
    (path && map.get(path)) ?? null;
  return rows.map((r) => {
    const videoUrl = url(videos, r.video_path);
    return {
      ...toProject(r),
      media: {
        coverUrl: url(covers, r.cover_path),
        coverFocus: [r.cover_focus_x, r.cover_focus_y],
        videoUrl,
        videoPosterUrl: url(covers, r.video_poster_path),
        videoSeconds: videoUrl ? r.video_seconds : null,
      },
    };
  });
}

function toProject(p: ProjectRow): Project {
  const en = {
    name: p.name_en,
    problem: p.problem_en,
    targetUser: p.target_user_en,
    nextStep: p.next_step_en,
  };
  return {
    slug: p.slug,
    name: p.name,
    problem: p.problem,
    targetUser: p.target_user,
    status: p.status,
    neededRoles: p.needed_roles,
    nextStep: p.next_step,
    contact: p.contact,
    ownerName: p.owner_name,
    repoUrl: p.repo_url,
    demoUrl: p.demo_url,
    updatedAt: p.updated_at,
    media: NO_MEDIA,
    commentCount: p.project_comments?.[0]?.count ?? 0,
    en,
    translated: translatedSide(
      p.original_lang,
      Object.values(en).some((v) => v !== null),
    ),
  };
}

export async function getProjects(): Promise<Project[]> {
  "use cache";
  cacheLife("minutes");
  // A new comment only bumps the card's counter, so it refreshes this list in
  // the background rather than making the next visitor wait.
  cacheTag("projects", "comment-counts");

  const db = getSupabase();
  if (!db) return sampleProjects;

  const { data, error } = await db
    .from("projects")
    // RLS leaves deleted comments out of the count.
    .select(`${PROJECT_COLUMNS},project_comments(count)`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return toProjects(db, data as unknown as ProjectRow[]);
}

export async function getProject(slug: string): Promise<{
  project: Project;
  updates: ProjectUpdate[];
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("projects", `project:${slug}`);

  const db = getSupabase();
  if (!db) {
    const project = sampleProjects.find((p) => p.slug === slug);
    return project ? { project, updates: [] } : null;
  }

  const { data, error } = await db
    .from("projects")
    .select(
      `${PROJECT_COLUMNS},project_updates(kind,body,body_en,original_lang,url,occurred_at)`,
    )
    .eq("slug", slug)
    .order("occurred_at", {
      referencedTable: "project_updates",
      ascending: false,
    })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ProjectRow & {
    project_updates: {
      kind: ProjectUpdate["kind"];
      body: string;
      body_en: string | null;
      original_lang: Lang | null;
      url: string | null;
      occurred_at: string;
    }[];
  };
  const [project] = await toProjects(db, [row]);
  return {
    project,
    updates: row.project_updates.map((u) => ({
      kind: u.kind,
      body: u.body,
      bodyEn: u.body_en,
      translated: translatedSide(u.original_lang, u.body_en !== null),
      url: u.url,
      occurredAt: u.occurred_at,
    })),
  };
}

/**
 * Visible comments on an approved project, oldest first. A reply whose thread
 * was deleted still comes back; the page shows it under a placeholder.
 */
export async function getProjectComments(
  slug: string,
): Promise<ProjectComment[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`comments:${slug}`);

  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from("project_comments")
    .select(
      "id,parent_id,kind,nickname,body,body_en,original_lang,is_owner,created_at,projects!inner(slug)",
    )
    .eq("projects.slug", slug)
    .order("created_at")
    .limit(500);
  if (error) throw error;

  return data.map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    kind: c.kind,
    nickname: c.nickname,
    body: c.body,
    bodyEn: c.body_en,
    translated: translatedSide(c.original_lang, c.body_en !== null),
    isOwner: c.is_owner,
    createdAt: c.created_at,
  }));
}

export async function getTutorials(): Promise<Tutorial[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("tutorials");

  const db = getSupabase();
  if (!db) return sampleTutorials;

  const { data, error } = await db
    .from("tutorials")
    .select(
      "title,summary,slides_url,repo_url,recording_url,published_at,events(slug)",
    )
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) throw error;

  return data.map((t) => ({
    // Many-to-one embed; null when unlinked or the event is unpublished.
    eventSlug: (t.events as unknown as { slug: string } | null)?.slug ?? null,
    title: t.title,
    summary: t.summary,
    slidesUrl: t.slides_url,
    repoUrl: t.repo_url,
    recordingUrl: t.recording_url,
    publishedAt: t.published_at,
  }));
}

export async function getWeeklyPicks(): Promise<WeeklyPick[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("picks");

  const db = getSupabase();
  if (!db) return samplePicks;

  const { data, error } = await db
    .from("weekly_picks")
    .select("kind,title,summary,source_name,source_url,picked_on")
    .eq("published", true)
    .order("picked_on", { ascending: false })
    .limit(20);
  if (error) throw error;

  return data.map((p) => ({
    kind: p.kind,
    title: p.title,
    summary: p.summary,
    sourceName: p.source_name,
    sourceUrl: p.source_url,
    pickedOn: p.picked_on,
  }));
}
