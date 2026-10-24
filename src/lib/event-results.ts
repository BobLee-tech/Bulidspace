// What came out of an event, keyed by event slug: shown on the event page
// once it's over. docs/event-results.md is the checklist for adding an event.
//
// Only people who agreed to have their work shown go here, under the name
// they agreed to. Screenshots live in public/events/<slug>/ (the Hub's form
// pictures aren't public, so they're copied in).

type Bi = { zh: string; en: string };

/** One person's work on the wall. */
export type EventWork = {
  /** As the person agreed to be credited; shown as is, not translated. */
  name: string;
  url: string;
  /** First screen of the site, 1280 × 800, under public/. */
  shot: string;
  /** Someone from the club showing what it looks like: last, and not counted. */
  organiser?: boolean;
};

export type EventResults = {
  /** A sentence on how it went. */
  recap?: Bi;
  /** Head-counts; the number of works on the wall is added after these. */
  stats?: { value: number; label: Bi }[];
  /** In hand-in order, organisers last. */
  works?: EventWork[];
};

const putYourselfOnline: EventResults = {
  recap: {
    zh: "10 月 22 日，3 小时。从一段提示词开始，到每个人自己的网址。",
    en: "Three hours on 22 October: from one prompt to a site with your name on it.",
  },
  stats: [
    { value: 43, label: { zh: "人报名", en: "signed up" } },
    { value: 39, label: { zh: "人到场", en: "came" } },
  ],
  works: [
    {
      name: "庞博仁",
      url: "https://pbr2002.github.io/",
      shot: "/events/put-yourself-online/pbr2002.jpg",
    },
    {
      name: "XIANG TIAN",
      url: "https://skyxiangtian13152.github.io/",
      shot: "/events/put-yourself-online/skyxiangtian13152.jpg",
    },
    {
      name: "蔡灏东",
      url: "https://chd44.github.io/",
      shot: "/events/put-yourself-online/chd44.jpg",
    },
    {
      name: "Evan",
      url: "https://evanlin.site/",
      shot: "/events/put-yourself-online/evanlin.jpg",
      organiser: true,
    },
  ],
};

const RESULTS: Record<string, EventResults> = {
  "put-yourself-online": putYourselfOnline,
};

export function getEventResults(slug: string): EventResults | null {
  return RESULTS[slug] ?? null;
}

/** Every event's results, for the checks in event-results.test.ts. */
export const allEventResults = () => Object.entries(RESULTS);

/** Works by participants, the number shown on the page: organisers left out. */
export const worksOnWall = (results: EventResults) =>
  (results.works ?? []).filter((w) => !w.organiser).length;
