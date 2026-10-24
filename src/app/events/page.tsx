import type { Metadata } from "next";
import Link from "next/link";
import { Arr } from "@/components/fx/arr";
import { PageHead } from "@/components/page-head";
import { SampleNotice } from "@/components/sample-notice";
import { getEventSchedule, getEventSignups, getTutorials } from "@/lib/data";
import { eventCopy, getEventPage } from "@/lib/event-pages";
import { getEventResults, worksOnWall } from "@/lib/event-results";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { roadmapWeek } from "@/lib/roadmap";
import {
  EVENT_KIND_LABEL,
  NO_SIGNUPS,
  type EventSignups,
  type SiteEvent,
} from "@/lib/types";
import { siteUrl } from "@/lib/site-url";
import { T } from "@/components/t";
import { CopyButton, EventList, Roadmap } from "./events-fx";
import { shownSeats } from "./event-parts";
import { NextUp } from "./next-up";
import "./events.css";

export const metadata: Metadata = { title: "活动" };

export default async function EventsPage() {
  const [{ upcoming, past }, tutorials, signups] = await Promise.all([
    getEventSchedule(),
    getTutorials(),
    getEventSignups(),
  ]);
  const withMaterials = new Set(tutorials.map((t) => t.eventSlug));
  const calendarUrl = `${siteUrl.replace(/^https?:/, "webcal:")}/events.ics`;
  const [next, ...later] = upcoming;
  // The next event has its own ticket up top; the list holds the rest.
  const kinds = [...new Set([...later, ...past].map((e) => e.kind))];
  const onStrip = [...upcoming, ...past].flatMap((e) => {
    const week = roadmapWeek(e.startsAt);
    return week < 0
      ? []
      : [
          {
            slug: e.slug,
            title: eventCopy(e).title,
            kind: e.kind,
            date: formatShortDate(e.startsAt),
            week,
          },
        ];
  });

  return (
    <section className="sec first">
      <div className="wrap">
        <PageHead
          path="events"
          eyebrow={{ zh: "活动 / Events · T3 2026", en: "Events · T3 2026" }}
        />
        {/* The next event stands in for the header readouts. */}
        {next && <NextUp slug={next.slug} />}
        <div style={{ marginTop: 16 }}>
          <SampleNotice />
        </div>

        <Roadmap events={onStrip} />

        <div className="cal-row">
          <div>
            <b style={{ fontSize: 14 }}>
              <T zh="订阅活动日历" en="Subscribe to the calendar" />
            </b>
            <span className="mute" style={{ fontSize: 13 }}>
              <T
                zh="导入 Google 或 Apple 日历，新活动自动出现。"
                en="Add it to Google or Apple Calendar; new events show up automatically."
              />
            </span>
          </div>
          <div>
            <code className="code">{calendarUrl}</code>
            <CopyButton text={calendarUrl} />
            <a
              href={calendarUrl}
              className="btn ghost"
              style={{ "--h": "38px" } as React.CSSProperties}
            >
              <T zh="订阅" en="Subscribe" /> <Arr />
            </a>
          </div>
        </div>

        {!next && (
          <p className="empty">
            <T
              zh="下一场活动筹备中，进群第一时间收到通知。"
              en="The next event is being planned — join the group to hear first."
            />
          </p>
        )}
        {later.length + past.length > 0 && (
          <EventList kinds={kinds}>
            {later.map((event, i) => (
              <EventRow
                key={event.slug}
                event={event}
                n={i + 1}
                signups={signups[event.slug]}
              />
            ))}
            {past.map((event, i) => (
              <EventRow
                key={event.slug}
                event={event}
                n={later.length + i + 1}
                past
                materials={withMaterials.has(event.slug)}
              />
            ))}
          </EventList>
        )}

        <div className="empty" style={{ marginTop: 56 }}>
          <span className="mono mute">
            <T zh="往期资料" en="Past materials" />
          </span>
          <p style={{ margin: "8px 0 16px", color: "var(--paper)" }}>
            <T
              zh="每场工作坊结束后 48 小时内，讲义、示例仓库和录屏会出现在资源页。"
              en="Within 48 hours of each workshop, slides, example repos and recordings go up on Resources."
            />
          </p>
          <Link
            href="/learn"
            className="btn ghost"
            style={{ "--h": "38px" } as React.CSSProperties}
          >
            <T zh="去资源页" en="Browse resources" /> <Arr />
          </Link>
        </div>
      </div>
    </section>
  );
}

function EventRow({
  event,
  n,
  past,
  materials,
  signups,
}: {
  event: SiteEvent;
  n: number;
  past?: boolean;
  materials?: boolean;
  /** Head-count when people sign up on the site. */
  signups?: EventSignups;
}) {
  const cost = getEventPage(event.slug)?.cost;
  const copy = eventCopy(event);
  const seats = shownSeats(event, signups ?? NO_SIGNUPS);
  // A past event with results opens its page, where the wall is.
  const results = past ? getEventResults(event.slug) : null;
  const works = results ? worksOnWall(results) : 0;
  const body = (
    <>
      <span className="ev-i">{String(n).padStart(2, "0")}</span>
      <div className="ev-date">
        {formatShortDate(event.startsAt)}
        <small className="mute">
          {formatTimeRange(event.startsAt, event.endsAt)}
        </small>
      </div>
      <div className="ev-main">
        <div className="need">
          <span className="tag">
            <T {...EVENT_KIND_LABEL[event.kind]} />
          </span>
          {past && (
            <span className="tag dash">
              <T zh="已结束" en="Past" />
            </span>
          )}
          {works > 0 && (
            <span className="tag">
              <T zh={`${works} 个作品`} en={`${works} works`} />
            </span>
          )}
          {!past && event.registrationClosesAt && (
            <span className="tag dash">
              {seats.confirmed}
              {seats.capacity !== null && ` / ${seats.capacity}`}{" "}
              <T zh="已报名" en="signed up" />
            </span>
          )}
        </div>
        <h3>
          <T {...copy.title} />
        </h3>
        {/* One line on what you'll do, so the list reads at a glance. */}
        {copy.summary && (
          <p className="ev-what mute">
            <T {...copy.summary} />
          </p>
        )}
        {materials && (
          <span className="mono mute">
            <T zh="讲义 · 示例仓库 · 录屏" en="Slides · repo · recording" />
          </span>
        )}
      </div>
      <p className="ev-where mute">
        {event.location}
        {cost && (
          <>
            {" · "}
            <T {...cost} />
          </>
        )}
      </p>
      <span className="ev-go" aria-hidden>
        {results || materials || !past ? "→" : "·"}
      </span>
    </>
  );

  const props = {
    id: event.slug,
    className: `ev ${past && !results && !materials ? "past" : ""}`,
    "data-kind": event.kind,
    "data-date": formatShortDate(event.startsAt),
  };
  if (results) {
    return (
      <Link {...props} href={`/events/${event.slug}`}>
        {body}
      </Link>
    );
  }
  if (materials) {
    return (
      <Link {...props} href={`/learn#${event.slug}`}>
        {body}
      </Link>
    );
  }
  // Upcoming events open their detail page (sign-up, or the outside link).
  return !past ? (
    <Link {...props} href={`/events/${event.slug}`}>
      {body}
    </Link>
  ) : (
    <div {...props}>{body}</div>
  );
}
