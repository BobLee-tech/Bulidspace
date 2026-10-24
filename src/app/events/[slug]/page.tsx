import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  CalendarBlank,
  MapPin,
  Ticket,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { Suspense } from "react";
import { Arr } from "@/components/fx/arr";
import { SampleNotice } from "@/components/sample-notice";
import { T } from "@/components/t";
import { getEventDetail } from "@/lib/data";
import { eventCopy, getEventPage, type EventTool } from "@/lib/event-pages";
import { getEventResults } from "@/lib/event-results";
import {
  formatDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
} from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import {
  EVENT_KIND_LABEL,
  SEAT_GROUP_LABEL,
  type EventSignups,
  type SiteEvent,
} from "@/lib/types";
import { AddressBar } from "../address-bar";
import { TimeLeft } from "../countdown";
import { EVENT_ICONS as ICONS, eventIsFull, shownSeats } from "../event-parts";
import { EventResultsSection } from "./results";
import { SignupDock, SignupFocus } from "./signup-dock";
import { SignupForm } from "./signup-form";
import "../events.css";
import "./event.css";

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const detail = await getEventDetail((await params).slug);
  if (!detail) return {};
  const { event } = detail;
  return {
    title: event.title,
    description: event.summary ?? undefined,
  };
}

export default function EventPageRoute({
  params,
}: PageProps<"/events/[slug]">) {
  return (
    <Suspense
      fallback={
        <section className="sec first">
          <div className="wrap">
            <Crumb />
            <p className="mute" style={{ marginTop: 32 }}>
              <T zh="加载中…" en="Loading…" />
            </p>
          </div>
        </section>
      }
    >
      {params.then(({ slug }) => (
        <EventDetail slug={slug} />
      ))}
    </Suspense>
  );
}

function Crumb() {
  return (
    <Link href="/events" className="crumb mono">
      ← <T zh="活动" en="Events" />
    </Link>
  );
}

async function EventDetail({ slug }: { slug: string }) {
  const detail = await getEventDetail(slug);
  if (!detail) notFound();
  const { event, signups, phase } = detail;
  const page = getEventPage(event.slug);
  const { title, summary } = eventCopy(event);
  const full = eventIsFull(event, signups);
  const calendarUrl = `${siteUrl.replace(/^https?:/, "webcal:")}/events.ics`;
  const { capacity, left, groups } = shownSeats(event, signups);
  const open = phase === "open" && event.registrationClosesAt !== null;
  const results = phase === "past" ? getEventResults(event.slug) : null;

  return (
    <section className="sec first evp">
      <div className="wrap">
        <div className="evp-bar mono">
          <Crumb />
          <span className="evp-rule" aria-hidden />
          <span className="mute">
            {EVENT_KIND_LABEL[event.kind].en} ·{" "}
            {formatShortDate(event.startsAt)} · SYD
          </span>
        </div>

        {/* Wide screens: read on the left, sign up on the right, the form
            pinned beside the intro. Narrow: intro, form, then the rest.
            Once it's over, the results run full width under the intro. */}
        <div className={results ? "evp-grid has-results" : "evp-grid"}>
          <header className="evp-intro">
            <div className="need">
              <span className="tag fill">
                <T {...EVENT_KIND_LABEL[event.kind]} />
              </span>
              {page && (
                <span className="tag">
                  <T {...page.cost} />
                </span>
              )}
              {page?.highlights.map((h) => (
                <span key={h.en} className="tag">
                  <T {...h} />
                </span>
              ))}
            </div>
            {(["zh", "en"] as const).map((l) => (
              <h1
                key={l}
                data-l={l}
                lang={l === "en" ? "en" : undefined}
                className="evp-title"
                style={{ "--ems": titleEms(title[l]) } as React.CSSProperties}
              >
                {title[l]}
              </h1>
            ))}
            {page && (
              <p data-l="zh" className="evp-en mono mute">
                {page.display}
              </p>
            )}
            {summary && (
              <p className="evp-lede">
                <T {...summary} />
              </p>
            )}

            <dl className="evp-kv">
              <div>
                <CalendarBlank weight="light" size={18} aria-hidden />
                <dt className="mono mute">
                  <T zh="时间" en="When" />
                </dt>
                <dd>
                  {formatDate(event.startsAt)}
                  <small className="mute">
                    {formatTimeRange(event.startsAt, event.endsAt)}
                  </small>
                </dd>
              </div>
              <div>
                <MapPin weight="light" size={18} aria-hidden />
                <dt className="mono mute">
                  <T zh="地点" en="Where" />
                </dt>
                <dd>{event.location}</dd>
              </div>
              {page && (
                <div>
                  <Ticket weight="light" size={18} aria-hidden />
                  <dt className="mono mute">
                    <T zh="费用" en="Cost" />
                  </dt>
                  <dd>
                    <T {...page.cost} />
                    {page.costNote && (
                      <small className="mute">
                        <T {...page.costNote} />
                      </small>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <UsersThree weight="light" size={18} aria-hidden />
                <dt className="mono mute">
                  <T zh="名额" en="Seats" />
                </dt>
                <dd>
                  {capacity === null ? (
                    <T zh="不限" en="Open" />
                  ) : (
                    <T zh={`${capacity} 人`} en={`${capacity}`} />
                  )}
                  {groups.length > 0 && (
                    <small className="mute">
                      {groups.map(([g, n], i) => (
                        <span key={g}>
                          {i > 0 && " · "}
                          <T {...SEAT_GROUP_LABEL[g]} /> {n}
                        </span>
                      ))}
                    </small>
                  )}
                </dd>
              </div>
            </dl>
            {!results && page?.tools?.length ? (
              <Tools tools={page.tools} />
            ) : null}
          </header>

          <aside className="evp-side" id="signup">
            <div className="evp-panel surf">
              <div className="evp-panel-top">
                <h2 className="evp-h2">
                  {phase === "open"
                    ? full
                      ? "Waitlist open."
                      : "Save a seat."
                    : phase === "closed"
                      ? "Sign-up closed."
                      : phase === "past"
                        ? "That's a wrap."
                        : "See you there."}
                </h2>
                {phase !== "past" && <TimeLeft to={event.startsAt} chip />}
              </div>
              {open && (
                <>
                  <SeatStatus event={event} signups={signups} />
                  <SignupForm
                    slug={event.slug}
                    capacity={event.capacity}
                    seatQuotas={event.seatQuotas}
                    signups={signups}
                    asksGithub={page?.asksGithub ?? false}
                  />
                  <ol className="evp-next">
                    <li>
                      <span className="mono">01</span>
                      <T zh="30 秒填完" en="30 s to fill in" />
                    </li>
                    <li>
                      <span className="mono">02</span>
                      <T zh="截止后拉你进群" en="We add you to the group" />
                    </li>
                    <li>
                      <span className="mono">03</span>
                      <T zh="带电脑来签到" en="Bring a laptop, check in" />
                    </li>
                  </ol>
                  <SignupFocus />
                </>
              )}
              {phase === "closed" && (
                <p className="evp-msg mute">
                  <T
                    zh="报名的同学请留意微信群里的确认消息。没报上也没关系，下一场活动会在这里和群里第一时间公布。"
                    en="If you signed up, watch the group chat for your confirmation. Missed it? The next event is announced here and in the group first."
                  />
                </p>
              )}
              {phase === "past" &&
                (results ? (
                  <>
                    <p className="evp-msg mute">
                      <T
                        zh="这场已经结束。大家做出来的网站都在下面，点开就能看。"
                        en="It's over. The sites people made are below, one click away."
                      />
                    </p>
                    <a
                      href="#results"
                      className="btn solid primary"
                      style={{ alignSelf: "start" }}
                    >
                      <T zh="看活动成果" en="See the results" />{" "}
                      <ArrowDown weight="light" size="1.15em" aria-hidden />
                    </a>
                  </>
                ) : (
                  <p className="evp-msg mute">
                    <T
                      zh="活动成果整理好后会放在这一页，讲义和示例在资源页。"
                      en="Results go up on this page once they're ready; slides and examples are on Resources."
                    />{" "}
                    <Link href="/learn" className="text-link">
                      <T zh="去资源页" en="Resources" /> <Arr />
                    </Link>
                  </p>
                ))}
              {phase === "external" && event.signupUrl && (
                <a
                  href={event.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn solid primary"
                  style={{ alignSelf: "start" }}
                >
                  <T zh="去报名" en="Sign up" /> <Arr diag />
                </a>
              )}
            </div>
          </aside>

          {results && <EventResultsSection results={results} />}

          <div className="evp-more">
            {/* After the event the day's pages make way for the results. */}
            {results && page?.tools?.length ? (
              <Tools tools={page.tools} />
            ) : null}
            {page && (
              <>
                <div className="evp-sec">
                  <h2 className="evp-sec-h mono mute">
                    <T zh="离场时你会有" en="You leave with" />
                  </h2>
                  <AddressBar handles={page.handles} />
                  <ul className="evp-points">
                    {page.points.map((pt) => {
                      const Glyph = ICONS[pt.icon];
                      return (
                        <li key={pt.title.en}>
                          <Glyph weight="light" size={22} aria-hidden />
                          <b>
                            <T {...pt.title} />
                          </b>
                          <span className="mute">
                            <T {...pt.sub} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="evp-sec">
                  <h2 className="evp-sec-h mono mute">
                    <T zh="带上" en="Bring" />
                  </h2>
                  <ul className="evp-bring">
                    {page.bring.map((b) => {
                      const Glyph = ICONS[b.icon];
                      return (
                        <li key={b.label.en}>
                          <Glyph weight="light" size={18} aria-hidden />
                          <T {...b.label} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="mono mute evp-hosts">
                  <T {...page.hosts} />
                </p>
              </>
            )}
            {phase !== "past" && (
              <a
                href={calendarUrl}
                className="btn ghost"
                style={{ alignSelf: "start" }}
              >
                <T zh="加入日历" en="Add to calendar" /> <Arr />
              </a>
            )}
            <div>
              <SampleNotice />
            </div>
          </div>
        </div>
      </div>
      {open && (
        <SignupDock
          title={<T {...title} />}
          zh={`${formatDate(event.startsAt)}${left === null ? "" : ` · 剩 ${left} 个名额`}`}
          en={`${formatDate(event.startsAt)}${left === null ? "" : ` · ${left} seats left`}`}
          waitlist={full}
        />
      )}
    </section>
  );
}

/** Pages people open on the day, linked from the event page. */
function Tools({ tools }: { tools: EventTool[] }) {
  return (
    <div className="evp-sec evp-sec-tools">
      <h2 className="evp-sec-h mono mute">
        <T zh="当天用到" en="On the day" />
      </h2>
      <ul className="evp-tools">
        {tools.map((tool) => {
          const Glyph = ICONS[tool.icon];
          return (
            <li key={tool.href}>
              {/* A plain link: /prompt is a static file, not a route. */}
              <a
                href={tool.href}
                className="evp-tool"
                {...(tool.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                <Glyph weight="light" size={22} aria-hidden />
                <b>
                  <T {...tool.title} />
                </b>
                <span className="mute">
                  <T {...tool.sub} />
                </span>
                <span className="mono evp-tool-url">
                  {tool.short}
                  <ArrowRight weight="light" size={16} aria-hidden />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Rough width of a title in ems (CJK one each, the rest about half), so the
 * CSS can size it to fit its column on one line.
 */
function titleEms(title: string) {
  let ems = 0;
  for (const c of title)
    ems += /[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.58;
  return Math.max(ems, 4).toFixed(2);
}

/** Head-count, seats per group and the deadline, above the form. */
function SeatStatus({
  event,
  signups,
}: {
  event: SiteEvent;
  signups: EventSignups;
}) {
  const { capacity: cap, confirmed, left, groups } = shownSeats(event, signups);
  const closes = event.registrationClosesAt!;
  return (
    <div className="evp-status">
      <p className="evp-count">
        <span className="mono mute">
          <T zh="已报名" en="Signed up" />
        </span>
        <b>
          {confirmed}
          {cap !== null && <span className="mute"> / {cap}</span>}
        </b>
      </p>
      {cap !== null && (
        <div
          className="evp-meter"
          role="img"
          aria-label={`${confirmed} / ${cap}`}
        >
          <i style={{ width: `${Math.min(confirmed / cap, 1) * 100}%` }} />
        </div>
      )}
      <p className="evp-left mono mute">
        {groups.map(([g, n]) => (
          <span key={g}>
            <T {...SEAT_GROUP_LABEL[g]} />{" "}
            <b>
              {signups.byGroup[g] ?? 0}/{n}
            </b>
          </span>
        ))}
        {left !== null && (
          <span>
            {left > 0 ? (
              <T zh={`剩 ${left} 个`} en={`${left} left`} />
            ) : (
              <T zh="名额已满" en="Full" />
            )}
          </span>
        )}
        {signups.waitlist > 0 && (
          <span>
            <T
              zh={`候补 ${signups.waitlist} 人`}
              en={`${signups.waitlist} waitlisted`}
            />
          </span>
        )}
        <span>
          <T
            zh={`${formatDate(closes)} ${formatTime(closes)} 截止`}
            en={`Closes ${formatDate(closes)} ${formatTime(closes)}`}
          />
        </span>
      </p>
    </div>
  );
}
