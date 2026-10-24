"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useCelebration } from "@/components/fx/celebrate";
import { Msg, T, type Bi } from "@/components/t";
import {
  FRIENDS,
  INTENT_LABELS,
  INTENTS,
  liveConfig,
  RATING_EMOJI,
  shortUrl,
  type FeedbackAnswer,
  type Intent,
  type LinkCheck,
  type LiveConfig,
  type LiveMe,
  type LiveState,
  type LiveStep,
  type WallItem,
} from "@/lib/event-live";
import {
  forgetMe,
  handInLink,
  join,
  like,
  recheckLink,
  sendFeedback,
  sendIntent,
  vote,
  type LiveResult,
} from "./actions";
import {
  AiAvatar,
  PollResults,
  PollVoices,
  Showcase,
  WallGrid,
} from "../parts";
import { usePoll } from "../use-poll";

type Payload = { state: LiveState; me: LiveMe | null };

/**
 * The page a phone (or laptop) sees after scanning the event's QR code. With
 * `only="intent"` (builderspace.dev/intent) it skips the host's steps and
 * shows the "what next" form straight away.
 */
export function LiveApp({
  slug,
  title,
  only,
}: {
  slug: string;
  title: Bi;
  only?: "intent";
}) {
  const config = liveConfig(slug);
  const { data, status, refresh } = usePoll<Payload>(
    `/live/${slug}/api/state`,
    4000,
  );
  const state = data?.state;
  const me = data?.me ?? null;

  let body: ReactNode;
  if (!state) {
    body =
      status === "closed" || status === "missing" ? (
        <Waiting
          title={{ zh: "现场页暂时没开", en: "The live page isn't open" }}
          hint={{ zh: "稍后再扫一次码。", en: "Scan again a bit later." }}
        />
      ) : (
        <p className="mute">
          <T zh="加载中…" en="Loading…" />
        </p>
      );
  } else if (!state.step) {
    body = (
      <Waiting
        title={{ zh: "还没开始", en: "Not started yet" }}
        hint={{
          zh: "主持人开始后，这一页会自己换，不用刷新。",
          en: "This page switches on by itself when the host starts.",
        }}
      />
    );
  } else if (!me) {
    body = <WhoAreYou slug={slug} onDone={refresh} />;
  } else if (only === "intent") {
    body = (
      <>
        <IntentCard slug={slug} config={config} me={me} refresh={refresh} />
        <p className="live-fine mute">
          <Link href={`/live/${slug}`}>
            <T
              zh="今天的其他环节在现场页 →"
              en="Everything else today is on the live page →"
            />
          </Link>
        </p>
      </>
    );
  } else {
    body = (
      <Steps
        key={me.name}
        slug={slug}
        config={config}
        state={state}
        me={me}
        refresh={refresh}
      />
    );
  }

  return (
    <div className="live-phone">
      <header className="live-bar">
        <div>
          <span className="mono mute">
            <T zh="现场" en="Live" />
          </span>
          <strong>
            <T zh={title.zh} en={title.en} />
          </strong>
        </div>
        {me ? <MeBadge name={me.name} onForget={refresh} /> : null}
      </header>
      {status === "offline" && data ? (
        <p className="live-offline mono">
          <T zh="网络有点慢，正在重连…" en="Reconnecting…" />
        </p>
      ) : null}
      {body}
    </div>
  );
}

function MeBadge({ name, onForget }: { name: string; onForget: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="live-me">
      <span>{name}</span>
      <button
        type="button"
        className="live-link-btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await forgetMe();
            onForget();
          })
        }
      >
        <T zh="不是我 / 换人" en="Not me" />
      </button>
    </div>
  );
}

function Waiting({ title, hint }: { title: Bi; hint: Bi }) {
  return (
    <div className="live-wait">
      <span className="live-dot" aria-hidden />
      <h1>
        <T zh={title.zh} en={title.en} />
      </h1>
      <p className="mute">
        <T zh={hint.zh} en={hint.en} />
      </p>
    </div>
  );
}

function Message({ result }: { result: LiveResult | null }) {
  if (!result || result.status === "ok") return null;
  return (
    <p className={`live-msg ${result.status}`} role="alert">
      <Msg s={result.message} />
    </p>
  );
}

// ---------- who are you ----------

function WhoAreYou({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<LiveResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="live-card">
      <StepHead
        eyebrow={{ zh: "第一次扫码", en: "First scan" }}
        title={{ zh: "嗨，你叫什么？", en: "Hi! What's your name?" }}
      />
      <form
        className="live-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await join(slug, name);
            setResult(r);
            if (r.status === "ok") onDone();
          });
        }}
      >
        <Field label={{ zh: "名字", en: "Name" }}>
          <input
            value={name}
            maxLength={40}
            autoComplete="name"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Message result={result} />
        <button
          type="submit"
          className="btn solid live-cta"
          disabled={pending || !name.trim()}
        >
          <T
            zh={pending ? "稍等…" : "继续"}
            en={pending ? "One moment…" : "Continue"}
          />
        </button>
      </form>
      <p className="live-fine mute">
        <T
          zh="没报名也可以直接填。名字只用于今天的签到和成果墙。"
          en="Didn't sign up? Just type your name. It's only used for today's check-in and the wall."
        />
      </p>
    </section>
  );
}

// ---------- the steps ----------

function Steps({
  slug,
  config,
  state,
  me,
  refresh,
}: {
  slug: string;
  config: LiveConfig;
  state: LiveState;
  me: LiveMe;
  refresh: () => void;
}) {
  const current = state.step!;
  // Tapping an earlier answer opens it again until the host moves on.
  const [picked, setPicked] = useState<LiveStep | null>(null);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setPicked(null);
  }
  // A new step starts at the top, not wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [current]);
  const view = picked ?? current;
  const copy = config.copy[view];
  const answered = (["poll", "intent", "link", "feedback"] as const).filter(
    (s) => me.responses[s],
  );

  // ‹ › between the steps the host has opened so far, in the run-sheet
  // order, so someone who missed a form can go back to it. Never ahead of
  // the host.
  const order = config.steps;
  const [furthest, setFurthest] = useState(order.indexOf(current));
  if (order.indexOf(current) > furthest) setFurthest(order.indexOf(current));
  const reached = Math.max(
    furthest,
    order.indexOf(current),
    ...answered.map((s) => order.indexOf(s)),
  );
  const at = order.indexOf(view);
  const prev =
    at > 0 ? order[at - 1] : at === -1 && reached >= 0 ? order[reached] : null;
  const next = at >= 0 && at < reached ? order[at + 1] : null;
  const go = (s: LiveStep) => setPicked(s === current ? null : s);

  let card: ReactNode;
  switch (view) {
    case "wait":
      card = <Waiting title={copy.title} hint={copy.hint ?? copy.title} />;
      break;
    case "checkin":
      card = (
        <section className="live-card live-done">
          <span className="live-tick" aria-hidden>
            ✓
          </span>
          <h1>
            <T zh="签到成功" en="You're checked in" />
          </h1>
          <p className="mute">
            <T
              zh={`欢迎，${me.name}！今天的环节都在这一页。`}
              en={`Welcome, ${me.name}! Everything today happens on this page.`}
            />
          </p>
        </section>
      );
      break;
    case "poll":
      card = (
        <PollCard
          slug={slug}
          config={config}
          state={state}
          me={me}
          refresh={refresh}
        />
      );
      break;
    case "link":
      card = (
        <>
          <LinkCard
            slug={slug}
            config={config}
            state={state}
            me={me}
            refresh={refresh}
          />
          {me.responses.link ? null : (
            <section className="live-card live-wide">
              <WallGrid state={state} />
            </section>
          )}
        </>
      );
      break;
    case "show":
      card = (
        <div className="live-wide live-show-step">
          <Showcase state={state} />
          <section className="live-card">
            <StepHead title={copy.title} hint={copy.hint} />
            <Peers slug={slug} wall={state.wall} me={me} refresh={refresh} />
          </section>
        </div>
      );
      break;
    case "intent":
      card = (
        <IntentCard slug={slug} config={config} me={me} refresh={refresh} />
      );
      break;
    case "feedback":
      card = (
        <FeedbackCard slug={slug} config={config} me={me} refresh={refresh} />
      );
      break;
  }

  return (
    <>
      {prev || next ? (
        <nav className="live-stepnav" aria-label="环节 / Steps">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && go(prev)}
          >
            ‹{" "}
            {prev ? (
              <T
                zh={config.copy[prev].label.zh}
                en={config.copy[prev].label.en}
              />
            ) : null}
          </button>
          {picked && picked !== current ? (
            <button
              type="button"
              className="live-stepnav-now"
              onClick={() => setPicked(null)}
            >
              <T zh="回到当前环节" en="Back to now" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!next}
            onClick={() => next && go(next)}
          >
            {next ? (
              <T
                zh={config.copy[next].label.zh}
                en={config.copy[next].label.en}
              />
            ) : null}{" "}
            ›
          </button>
        </nav>
      ) : null}
      {card}
      {answered.length ? (
        <section className="live-history">
          <span className="mono mute">
            <T zh="今天你交过的" en="Handed in today" />
          </span>
          {answered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPicked(s === current ? null : s)}
              aria-current={s === view}
            >
              <span>
                <T zh={config.copy[s].label.zh} en={config.copy[s].label.en} />
              </span>
              <span className="mono">
                <T zh="✓ 已交" en="✓ done" />
              </span>
            </button>
          ))}
        </section>
      ) : null}
    </>
  );
}

function StepHead({
  eyebrow,
  title,
  hint,
}: {
  eyebrow?: Bi;
  title: Bi;
  hint?: Bi;
}) {
  return (
    <div className="live-head">
      {eyebrow ? (
        <span className="mono mute">
          <T zh={eyebrow.zh} en={eyebrow.en} />
        </span>
      ) : null}
      <h1>
        <T zh={title.zh} en={title.en} />
      </h1>
      {hint ? (
        <p className="mute">
          <T zh={hint.zh} en={hint.en} />
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: Bi; children: ReactNode }) {
  return (
    <label className="field">
      <span className="mono">
        <T zh={label.zh} en={label.en} />
      </span>
      {children}
    </label>
  );
}

function Choices<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: Bi;
  value: V | null;
  options: { value: V; label: ReactNode }[];
  onChange: (v: V) => void;
}) {
  return (
    <fieldset className="live-choices">
      <legend className="mono mute">
        <T zh={label.zh} en={label.en} />
      </legend>
      <div>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PollCard({
  slug,
  config,
  state,
  me,
  refresh,
}: {
  slug: string;
  config: LiveConfig;
  state: LiveState;
  me: LiveMe;
  refresh: () => void;
}) {
  const mine = me.responses.poll?.payload;
  const options = config.poll?.options ?? [];
  const [editing, setEditing] = useState(!mine);
  const [choice, setChoice] = useState(mine?.choice ?? null);
  const [like, setLike] = useState(mine?.like ?? "");
  const [pain, setPain] = useState(mine?.pain ?? "");
  const [result, setResult] = useState<LiveResult | null>(null);
  const [pending, start] = useTransition();
  const copy = config.copy.poll;

  let form: ReactNode;
  if (mine && !editing) {
    const picked = options.find((o) => o.key === mine.choice);
    form = (
      <section className="live-card">
        <div className="live-done">
          <AiAvatar option={picked} />
          <h1>
            <T
              zh={`投了 ${picked?.label ?? mine.choice}`}
              en={`You voted ${picked?.label ?? mine.choice}`}
            />
          </h1>
          <p className="mute">
            <T
              zh="看看大家都选了谁，跟同桌说说你为什么选它。"
              en="See what everyone picked, and tell your table why."
            />
          </p>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setEditing(true)}
          >
            <T zh="改票" en="Change vote" />
          </button>
        </div>
      </section>
    );
  } else {
    form = (
      <section className="live-card">
        <StepHead title={copy.title} hint={copy.hint} />
        <div className="live-options" role="radiogroup">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={choice === o.key}
              onClick={() => setChoice(o.key)}
            >
              <AiAvatar option={o} />
              <span className="live-option-name">
                <strong>{o.label}</strong>
                {o.maker ? <small>{o.maker}</small> : null}
              </span>
            </button>
          ))}
        </div>
        <Field
          label={{
            zh: "最喜欢它的一点（选填）",
            en: "What you love about it (optional)",
          }}
        >
          <input
            value={like}
            maxLength={30}
            onChange={(e) => setLike(e.target.value)}
          />
        </Field>
        <Field
          label={{
            zh: "最难受的一点（选填）",
            en: "What drives you mad (optional)",
          }}
        >
          <input
            value={pain}
            maxLength={30}
            onChange={(e) => setPain(e.target.value)}
          />
        </Field>
        <Message result={result} />
        <button
          type="button"
          className="btn solid live-cta"
          disabled={!choice || pending}
          onClick={() =>
            start(async () => {
              const r = await vote(slug, choice ?? "", like, pain);
              setResult(r);
              if (r.status === "ok") {
                setEditing(false);
                refresh();
              }
            })
          }
        >
          <T
            zh={pending ? "稍等…" : "投票"}
            en={pending ? "One moment…" : "Vote"}
          />
        </button>
      </section>
    );
  }

  return (
    <div className="live-wide live-split">
      <div className="live-area-form">{form}</div>
      <section className="live-card live-area-results">
        <PollResults config={config} state={state} mine={mine?.choice} />
      </section>
      {state.pollNotes.length ? (
        <section className="live-card live-area-voices">
          <PollVoices config={config} state={state} />
        </section>
      ) : null}
    </div>
  );
}

const CHECK_COPY: Record<LinkCheck, Bi> = {
  live: { zh: "● 已上线，墙上已经有你了", en: "● Live — you're on the wall" },
  pending: {
    zh: "◌ GitHub Pages 还在生效，最多 10 分钟，好了会自动变成已上线",
    en: "◌ GitHub Pages is still building (up to 10 minutes); this updates by itself",
  },
  down: {
    zh: "✕ 这个网址打不开（404），检查一下有没有拼错",
    en: "✕ That link gives a 404 — check the spelling",
  },
  unchecked: { zh: "◆ 收到了", en: "◆ Got it" },
};

function LinkCard({
  slug,
  config,
  state,
  me,
  refresh,
}: {
  slug: string;
  config: LiveConfig;
  state: LiveState;
  me: LiveMe;
  refresh: () => void;
}) {
  const mine = me.responses.link;
  const suggested = me.github
    ? `https://${me.github.toLowerCase()}.github.io`
    : "";
  const [editing, setEditing] = useState(!mine);
  const [url, setUrl] = useState(mine?.payload.url ?? suggested);
  const [onWall, setOnWall] = useState(mine?.onWall ?? false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [pending, start] = useTransition();
  const copy = config.copy.link;
  const check = mine?.payload.check;

  // GitHub Pages takes a few minutes: look again every 30 seconds.
  useEffect(() => {
    if (check !== "pending") return;
    const timer = setInterval(async () => {
      const r = await recheckLink(slug);
      if (r.status === "ok" && r.check !== "pending") refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [check, slug, refresh]);

  if (mine && !editing) {
    return (
      <section className="live-card">
        <div className="live-head">
          <span className="mono mute">
            <T zh="已交" en="Handed in" />
          </span>
          <a
            className="live-url"
            href={mine.payload.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {shortUrl(mine.payload.url)}
          </a>
          <p className="live-check" data-check={mine.payload.check}>
            <T
              zh={CHECK_COPY[mine.payload.check].zh}
              en={CHECK_COPY[mine.payload.check].en}
            />
          </p>
          {!mine.onWall ? (
            <p className="mute">
              <T
                zh="你选了不上墙：只有组织者能看到。"
                en="You chose not to show it: only the organisers see it."
              />
            </p>
          ) : mine.hidden ? (
            <p className="mute">
              <T
                zh="主持人暂时没放上墙。"
                en="The host has kept it off the screen for now."
              />
            </p>
          ) : null}
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setEditing(true)}
          >
            <T zh="修改" en="Edit" />
          </button>
        </div>
        {me.received.hearts ? (
          <div className="live-received">
            <strong>
              <T
                zh={`♥ 收到 ${me.received.hearts} 个赞`}
                en={`♥ ${me.received.hearts} likes`}
              />
            </strong>
            {me.received.notes.map((n, i) => (
              <p key={i}>“{n}”</p>
            ))}
          </div>
        ) : null}
        <Peers slug={slug} wall={state.wall} me={me} refresh={refresh} />
      </section>
    );
  }

  return (
    <section className="live-card">
      <StepHead title={copy.title} hint={copy.hint} />
      <form
        className="live-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await handInLink(slug, url, onWall, confirm);
            setResult(r);
            setConfirm(r.status === "confirm");
            if (r.status === "ok") {
              setEditing(false);
              refresh();
            }
          });
        }}
      >
        <Field
          label={
            suggested
              ? {
                  zh: "网址（按报名填的 GitHub 用户名预填好了）",
                  en: "Link (filled in from your GitHub username)",
                }
              : { zh: "网址", en: "Link" }
          }
        >
          <input
            value={url}
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://username.github.io"
            onChange={(e) => {
              setUrl(e.target.value);
              setConfirm(false);
            }}
          />
        </Field>
        <label className="consent">
          <input
            type="checkbox"
            checked={onWall}
            onChange={(e) => setOnWall(e.target.checked)}
          />
          <span>
            <T
              zh="可以把我的网站放上大屏和官网成果墙，也愿意被视频记录高光时刻"
              en="Show my site on the big screen and on the results wall on our website, and happy to be filmed for highlights"
            />
          </span>
        </label>
        <Message result={result} />
        <button
          type="submit"
          className="btn solid live-cta"
          disabled={pending || !url.trim()}
        >
          <T
            zh={
              pending
                ? "正在打开你的网站看看…"
                : confirm
                  ? "没错，交上去"
                  : "交上去"
            }
            en={
              pending
                ? "Opening your site…"
                : confirm
                  ? "Yes, hand it in"
                  : "Hand it in"
            }
          />
        </button>
        <p className="live-fine mute">
          <T
            zh="还没部署好？先用保底链接（Echoagent、Claude 发布的链接都行），之后再改。"
            en="Not deployed yet? Hand in a fallback link (Echoagent, a Claude share link) and change it later."
          />
        </p>
      </form>
    </section>
  );
}

/** Everyone else's sites: open one, like it, say what you liked. Each person
 * sees them in their own fixed order, so visits spread out and the list
 * doesn't jump while someone is typing. */
function Peers({
  slug,
  wall,
  me,
  refresh,
}: {
  slug: string;
  wall: WallItem[];
  me: LiveMe;
  refresh: () => void;
}) {
  const mineId = me.responses.link?.id;
  const others = wall
    .filter((w) => w.id !== mineId)
    .map((w) => ({ w, k: shuffleKey(me.name + w.id) }))
    .sort((a, b) => a.k - b.k)
    .map(({ w }) => w);
  return (
    <div className="live-peers">
      <span className="mono mute">
        <T
          zh="打开别人的网站，说一个喜欢的地方"
          en="Open someone's site and say what you like"
        />
      </span>
      {others.length ? (
        others.map((w) => (
          <Peer
            key={w.id}
            slug={slug}
            item={w}
            liked={me.hearted.includes(w.id)}
            refresh={refresh}
          />
        ))
      ) : (
        <p className="mute">
          <T
            zh="还没有别人交，等一下。"
            en="Nobody else yet — give it a minute."
          />
        </p>
      )}
    </div>
  );
}

function Peer({
  slug,
  item,
  liked,
  refresh,
}: {
  slug: string;
  item: WallItem;
  liked: boolean;
  refresh: () => void;
}) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const send = (on: boolean, text: string) =>
    start(async () => {
      const r = await like(slug, item.id, on, text);
      if (r.status === "ok") {
        if (text) setSent(true);
        refresh();
      }
    });

  return (
    <div className="live-peer">
      <div className="live-peer-top">
        <div>
          <strong>{item.name}</strong>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
          >
            {shortUrl(item.url)} ↗
          </a>
        </div>
        <button
          type="button"
          className="live-heart"
          aria-pressed={liked}
          disabled={pending}
          onClick={() => send(!liked, "")}
        >
          ♥ {item.hearts}
        </button>
      </div>
      {sent ? (
        <p className="mute live-fine">
          <T zh="已发送，只有 TA 能看到" en="Sent — only they can see it" />
        </p>
      ) : (
        <form
          className="live-note"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) send(true, note);
          }}
        >
          <input
            value={note}
            maxLength={80}
            placeholder="喜欢的地方 / What I like"
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="submit"
            className="btn ghost sm"
            disabled={pending || !note.trim()}
          >
            <T zh="发送" en="Send" />
          </button>
        </form>
      )}
    </div>
  );
}

/** A stable pseudo-random number for a string (FNV-1a). */
function shuffleKey(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function IntentCard({
  slug,
  config,
  me,
  refresh,
}: {
  slug: string;
  config: LiveConfig;
  me: LiveMe;
  refresh: () => void;
}) {
  const mine = me.responses.intent?.payload;
  const [editing, setEditing] = useState(!mine);
  const [wants, setWants] = useState<Intent[]>(mine?.wants ?? []);
  const [idea, setIdea] = useState(mine?.idea ?? "");
  const [contact, setContact] = useState(mine?.contact ?? "");
  const [result, setResult] = useState<LiveResult | null>(null);
  const [pending, start] = useTransition();
  const copy = config.copy.intent;

  if (mine && !editing) {
    return (
      <section className="live-card">
        <div className="live-done">
          <span className="live-tick" aria-hidden>
            ✓
          </span>
          <h1>
            <T zh="收到了" en="Got it" />
          </h1>
          <p className="mute">
            <T
              zh={`我们会通过 ${mine.contact} 联系你。`}
              en={`We'll reach you at ${mine.contact}.`}
            />
          </p>
          <div className="live-actions">
            {mine.wants.includes("join") ? (
              <a className="btn solid sm" href="/join">
                <T zh="现在就加入社团 →" en="Join the society now →" />
              </a>
            ) : null}
            {mine.wants.includes("core") ? (
              <a className="btn solid sm" href="/core-team">
                <T zh="申请核心成员 →" en="Apply for the core team →" />
              </a>
            ) : null}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setEditing(true)}
            >
              <T zh="改一下" en="Edit" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="live-card">
      <StepHead title={copy.title} hint={copy.hint} />
      <div className="live-form">
        <fieldset className="live-choices">
          <legend className="mono mute">
            <T zh="我想（可多选）" en="I'd like to (pick any)" />
          </legend>
          <div className="live-intents">
            {INTENTS.map((i) => (
              <button
                key={i}
                type="button"
                className="chip"
                aria-pressed={wants.includes(i)}
                onClick={() =>
                  setWants((w) =>
                    w.includes(i) ? w.filter((x) => x !== i) : [...w, i],
                  )
                }
              >
                <T zh={INTENT_LABELS[i].zh} en={INTENT_LABELS[i].en} />
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label={{
            zh: "想做的项目或想法（选填）",
            en: "A project or idea you have in mind (optional)",
          }}
        >
          <input
            value={idea}
            maxLength={120}
            onChange={(e) => setIdea(e.target.value)}
          />
        </Field>
        <Field label={{ zh: "微信号或邮箱", en: "WeChat ID or email" }}>
          <input
            value={contact}
            maxLength={80}
            autoComplete="email"
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
        <Message result={result} />
        <button
          type="button"
          className="btn solid live-cta"
          disabled={pending || !wants.length || !contact.trim()}
          onClick={() =>
            start(async () => {
              const r = await sendIntent(slug, { wants, idea, contact });
              setResult(r);
              if (r.status === "ok") {
                setEditing(false);
                refresh();
              }
            })
          }
        >
          <T
            zh={pending ? "稍等…" : "提交"}
            en={pending ? "One moment…" : "Send"}
          />
        </button>
      </div>
    </section>
  );
}

const FRIEND_LABELS: Record<(typeof FRIENDS)[number], string> = {
  "0": "0",
  "1-2": "1–2",
  "3-5": "3–5",
  "6+": "6+",
};

function FeedbackCard({
  slug,
  config,
  me,
  refresh,
}: {
  slug: string;
  config: LiveConfig;
  me: LiveMe;
  refresh: () => void;
}) {
  const mine = me.responses.feedback?.payload;
  const [rating, setRating] = useState(0);
  const [friends, setFriends] = useState<FeedbackAnswer["friends"] | null>(
    null,
  );
  const [good, setGood] = useState("");
  const [bad, setBad] = useState("");
  const [result, setResult] = useState<LiveResult | null>(null);
  // Confetti only right after sending, not when the page is reopened.
  const [justSent, setJustSent] = useState(false);
  const [pending, start] = useTransition();
  const panel = useCelebration("join", justSent);
  const copy = config.copy.feedback;

  if (mine || justSent) {
    return (
      <section className="live-card">
        <div className="live-done" ref={panel}>
          <span className="live-bye" aria-hidden>
            {RATING_EMOJI[(mine?.rating ?? rating) - 1] ?? "🥳"}
          </span>
          <h1>
            <T zh="下次见" en="See you next time" />
          </h1>
          <p className="mute">
            <T
              zh="回去记得打磨自己的个站哦～"
              en="Keep polishing your site at home~"
            />
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="live-card">
      <StepHead title={copy.title} hint={copy.hint} />
      <div className="live-form">
        <fieldset className="live-choices">
          <legend className="mono mute">
            <T zh="整体打几分" en="Overall score" />
          </legend>
          <div className="live-stars">
            {RATING_EMOJI.map((face, i) => (
              <button
                key={face}
                type="button"
                aria-pressed={i + 1 === rating}
                aria-label={`${i + 1}`}
                onClick={() => setRating(i + 1)}
              >
                <b>{i + 1}</b>
                <span aria-hidden>{face}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Choices
          label={{
            zh: "今天认识了几个新朋友",
            en: "New friends you made today",
          }}
          value={friends}
          options={FRIENDS.map((f) => ({ value: f, label: FRIEND_LABELS[f] }))}
          onChange={setFriends}
        />
        <Field
          label={{
            zh: "本次活动喜欢的地方（选填）",
            en: "What you liked today (optional)",
          }}
        >
          <input
            value={good}
            maxLength={120}
            onChange={(e) => setGood(e.target.value)}
          />
        </Field>
        <Field
          label={{
            zh: "给我们的建议（选填）",
            en: "Suggestions for us (optional)",
          }}
        >
          <input
            value={bad}
            maxLength={120}
            onChange={(e) => setBad(e.target.value)}
          />
        </Field>
        <Message result={result} />
        <button
          type="button"
          className="btn solid live-cta"
          disabled={pending || !rating || !friends}
          onClick={() =>
            start(async () => {
              const r = await sendFeedback(slug, {
                rating,
                friends: friends!,
                good,
                bad,
              });
              setResult(r);
              if (r.status === "ok") {
                setJustSent(true);
                refresh();
              }
            })
          }
        >
          <T
            zh={pending ? "稍等…" : "提交"}
            en={pending ? "One moment…" : "Send"}
          />
        </button>
      </div>
    </section>
  );
}
