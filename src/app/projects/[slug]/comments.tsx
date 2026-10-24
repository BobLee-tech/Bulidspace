"use client";

import {
  ArrowBendUpLeft,
  ChatCircle,
  Lightbulb,
  Question,
  Trash,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Flip } from "gsap/Flip";
import Link from "next/link";
import { Arr, Hud } from "@/components/fx/arr";
import { SpamGuard } from "@/components/spam-guard";
import { Msg, T, TranslatedMark } from "@/components/t";
import { hasAdminFlag } from "@/lib/admin";
import { countKind, threadsOf } from "@/lib/comments";
import { formatShortDate, formatTime } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { revealElement } from "@/lib/smooth-scroll";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import {
  COMMENT_KINDS,
  COMMENT_KIND_LABEL,
  type CommentKind,
  type ProjectComment,
} from "@/lib/types";
import { deleteProjectComment, submitProjectComment } from "./actions";

/** Fired by the "I want to join" buttons elsewhere on the page. */
const COMPOSE_EVENT = "bs:compose";
const NICKNAME_KEY = "bs-nickname";
const BODY_MAX = 500;
/** Threads shown before "show more". */
const PAGE = 20;

const KIND_ICON: Record<CommentKind, Icon> = {
  join: UserPlus,
  idea: Lightbulb,
  ask: Question,
};

type Filter = "all" | CommentKind;

/** Opens the comment box with "wants to join" picked and scrolls to it. */
export function AskToJoin({
  className = "btn solid primary",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        dispatchEvent(
          new CustomEvent(COMPOSE_EVENT, { detail: { kind: "join" } }),
        )
      }
    >
      {children}
    </button>
  );
}

const hash = (s: string) =>
  [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const initials = (s: string) => [...s.trim()].slice(0, 2).join("");

function Avatar({ name, owner }: { name: string; owner: boolean }) {
  return (
    <span
      className={owner ? "cm-av owner" : "cm-av"}
      data-v={hash(name) % 6}
      aria-hidden
    >
      <span>{initials(name)}</span>
    </span>
  );
}

/** A reply's leading "@nickname", set apart from the rest. */
function Mention({ text }: { text: string }) {
  const m = text.match(/^(@\S+)\s+([\s\S]*)$/);
  if (!m) return text;
  return (
    <>
      <span className="cm-at">{m[1]}</span> {m[2]}
    </>
  );
}

function Body({ c }: { c: ProjectComment }) {
  return (
    <p className="cm-text">
      <T
        zh={<Mention text={c.body} />}
        en={<Mention text={c.bodyEn ?? c.body} />}
      />
    </p>
  );
}

/** Admin only: delete with an inline confirmation (no browser dialogs). */
function DeleteControl({
  slug,
  id,
  hasReplies,
}: {
  slug: string;
  id: string;
  hasReplies: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button
        type="button"
        className="ibtn danger"
        onClick={() => setAsking(true)}
      >
        <Trash weight="light" size={14} aria-hidden />
        <T zh="删除" en="Delete" />
      </button>
    );
  }
  return (
    <div className="cm-confirm" role="group">
      <span>
        {hasReplies ? (
          <T
            zh="删除后这里显示「已被管理员删除」，回复保留。"
            en="It will show as removed; the replies stay."
          />
        ) : (
          <T
            zh="删除后访客就看不到这条评论了。"
            en="Visitors won't see this comment any more."
          />
        )}
      </span>
      <button
        type="button"
        className="btn sm del"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await deleteProjectComment(slug, id);
            if (!result.ok) setError(result.message);
          })
        }
      >
        {pending ? (
          <T zh="删除中…" en="Deleting…" />
        ) : (
          <T zh="确认删除" en="Delete" />
        )}
      </button>
      <button
        type="button"
        className="ibtn"
        disabled={pending}
        onClick={() => {
          setAsking(false);
          setError(null);
        }}
      >
        <T zh="取消" en="Cancel" />
      </button>
      {error && (
        <span className="err" role="alert">
          <Msg s={error} />
        </span>
      )}
    </div>
  );
}

function Comment({
  c,
  fresh,
  onReply,
  admin,
}: {
  c: ProjectComment;
  fresh: boolean;
  /** Missing under a deleted comment, which takes no more replies. */
  onReply?: () => void;
  /** Set for a signed-in admin. */
  admin?: { slug: string; hasReplies: boolean };
}) {
  const KindIcon = c.kind ? KIND_ICON[c.kind] : null;
  return (
    <article
      className={`ccard${c.isOwner ? " owner" : ""}${fresh ? " is-new" : ""}`}
      data-id={c.id}
    >
      <Avatar name={c.nickname} owner={c.isOwner} />
      <div className="cm-main">
        <header className="cm-meta">
          <b>{c.nickname}</b>
          {c.isOwner && (
            <span className="tag fill">
              <T zh="发起人" en="Owner" />
            </span>
          )}
          {c.kind && KindIcon && (
            <span className="tag">
              <KindIcon weight="light" size={12} aria-hidden />
              <T {...COMMENT_KIND_LABEL[c.kind]} />
            </span>
          )}
          <time className="mono mute" dateTime={c.createdAt}>
            {formatShortDate(c.createdAt)} {formatTime(c.createdAt)}
          </time>
        </header>
        <Body c={c} />
        {(onReply || admin || c.translated) && (
          <div className="cm-foot">
            {onReply && (
              <button type="button" className="ibtn" onClick={onReply}>
                <ArrowBendUpLeft weight="light" size={14} aria-hidden />
                <T zh="回复" en="Reply" />
              </button>
            )}
            {admin && (
              <DeleteControl
                slug={admin.slug}
                id={c.id}
                hasReplies={admin.hasReplies}
              />
            )}
            <TranslatedMark lang={c.translated} className="cm-tr" />
          </div>
        )}
      </div>
    </article>
  );
}

export function Comments({
  slug,
  comments,
}: {
  slug: string;
  comments: ProjectComment[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitProjectComment,
    { status: "idle" },
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CommentKind>("join");
  const [replyTo, setReplyTo] = useState<{
    thread: string;
    name: string;
  } | null>(null);
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [freshId, setFreshId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  // Positions before a filter / sort change, for the FLIP move afterwards.
  const flip = useRef<{
    getState: () => Flip.FlipState;
    play: (s: Flip.FlipState) => void;
  } | null>(null);
  const before = useRef<Flip.FlipState | null>(null);
  const rearranged = useRef(false);

  const threads = useMemo(() => threadsOf(comments), [comments]);
  const total = comments.length;
  const byKind = (k: CommentKind) => countKind(comments, k);
  const visible = useMemo(() => {
    const picked = threads.filter(
      (t) => filter === "all" || t.root?.kind === filter,
    );
    return picked.sort((a, b) =>
      sort === "new"
        ? b.at.localeCompare(a.at)
        : (a.root?.createdAt ?? a.at).localeCompare(b.root?.createdAt ?? b.at),
    );
  }, [threads, filter, sort]);
  const shown = visible.slice(0, limit);

  // Delete buttons for a browser signed in at /admin; the server checks the key.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a cookie once mounted
    setAdmin(hasAdminFlag());
  }, []);

  // The nickname is remembered on this device only, for the next comment.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NICKNAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      if (saved) setNickname(saved);
    } catch {}
  }, []);

  // GSAP Flip is loaded once, only to animate filter and sort changes.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    void Promise.all([import("gsap"), import("gsap/Flip")]).then(
      ([{ gsap }, { Flip }]) => {
        if (!alive) return;
        gsap.registerPlugin(Flip);
        flip.current = {
          getState: () =>
            Flip.getState(list.current?.querySelectorAll(":scope > li") ?? []),
          play: (s) =>
            Flip.from(s, {
              duration: 0.45,
              ease: "power3.out",
              onEnter: (els) =>
                gsap.fromTo(
                  els,
                  { opacity: 0, y: 10 },
                  { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
                ),
            }),
        };
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!rearranged.current) return;
    rearranged.current = false;
    // A shorter list can leave the page scrolled past it; keep the bar in view.
    const el = bar.current;
    if (el && el.getBoundingClientRect().top < 80) revealElement(el, -96);
    if (before.current && flip.current) flip.current.play(before.current);
    before.current = null;
  }, [filter, sort]);

  const rearrange = (fn: () => void) => {
    rearranged.current = true;
    before.current = flip.current?.getState() ?? null;
    fn();
  };

  // A successful post: clear the text, close the reply, and mark the new
  // comment, which arrives with the same response.
  useEffect(() => {
    if (state.status !== "ok") return;
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to the action result */
    setBody("");
    setReplyTo(null);
    if (state.id) setFreshId(state.id);
    /* eslint-enable react-hooks/set-state-in-effect */
    try {
      if (nickname.trim())
        localStorage.setItem(NICKNAME_KEY, nickname.trim().slice(0, 40));
    } catch {}
    // Only the result matters here, not later typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Show the new comment even when a filter would hide it or it sorts last.
  useEffect(() => {
    if (!freshId) return;
    const el = list.current?.querySelector<HTMLElement>(
      `[data-id="${freshId}"]`,
    );
    if (!el) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-off reveal */
      if (filter !== "all") setFilter("all");
      else setLimit(threads.length);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.top < 96 || r.bottom > innerHeight) revealElement(el, -160);
    // Drop the mark once it has played, so a later re-mount doesn't replay it.
    const t = setTimeout(() => setFreshId(null), 2000);
    return () => clearTimeout(t);
  }, [freshId, comments, filter, threads.length]);

  // "I want to join" buttons elsewhere on the page.
  useEffect(() => {
    const onCompose = (e: Event) => {
      const want = (e as CustomEvent<{ kind?: CommentKind }>).detail?.kind;
      setReplyTo(null);
      if (want) setKind(want);
      setOpen(true);
      if (box.current) revealElement(box.current, -120);
      requestAnimationFrame(() =>
        (nickname ? textarea : nameInput).current?.focus({
          preventScroll: true,
        }),
      );
    };
    addEventListener(COMPOSE_EVENT, onCompose);
    return () => removeEventListener(COMPOSE_EVENT, onCompose);
  }, [nickname]);

  const reply = (thread: string, name: string) => {
    setReplyTo({ thread, name });
    setOpen(true);
    setBody((b) => `@${name} ${b.replace(/^@\S+\s*/, "")}`);
    if (box.current) revealElement(box.current, -120);
    requestAnimationFrame(() => {
      const t = textarea.current;
      if (!t) return;
      t.focus({ preventScroll: true });
      t.setSelectionRange(t.value.length, t.value.length);
    });
  };

  const cancelReply = () => {
    setReplyTo(null);
    setBody((b) => b.replace(/^@\S+\s*/, ""));
  };

  const err = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const left = BODY_MAX - body.length;
  const filters: [Filter, React.ReactNode, number][] = [
    ["all", <T key="all" zh="全部" en="All" />, total],
    ...COMMENT_KINDS.map(
      (k) =>
        [k, <T key={k} {...COMMENT_KIND_LABEL[k]} />, byKind(k)] as [
          Filter,
          React.ReactNode,
          number,
        ],
    ),
  ];

  return (
    <>
      {total > 0 && (
        <div ref={bar} className="cx-bar">
          <div className="filters" role="group" aria-label="筛选 / Filter">
            {filters.map(([f, label, n]) => {
              const KindIcon = f === "all" ? null : KIND_ICON[f];
              return (
                <button
                  key={f}
                  type="button"
                  className="chip"
                  aria-pressed={filter === f}
                  onClick={() =>
                    rearrange(() => {
                      setFilter(f);
                      setLimit(PAGE);
                    })
                  }
                >
                  {KindIcon && (
                    <KindIcon weight="light" size={14} aria-hidden />
                  )}
                  {label}
                  <span className="n">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="cx-bar-r">
            {admin && (
              <Link href="/admin" className="tag cx-admin">
                <T zh="管理员模式" en="Admin mode" />
              </Link>
            )}
            <div className="seg" role="group" aria-label="排序 / Sort">
              {(
                [
                  ["new", "最新", "Newest"],
                  ["old", "最早", "Oldest"],
                ] as const
              ).map(([s, zh, en]) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sort === s}
                  onClick={() => rearrange(() => setSort(s))}
                >
                  <T zh={zh} en={en} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={box} className="form hud composer">
        <Hud />
        <form
          onSubmit={submitWithoutReset((data) => {
            if (replyTo) data.set("parentId", replyTo.thread);
            action(data);
          })}
          noValidate
        >
          <input type="hidden" name="slug" value={slug} />
          <SpamGuard />
          {!open && (
            <button
              type="button"
              className="cz-open"
              onClick={() => {
                setOpen(true);
                requestAnimationFrame(() =>
                  (nickname ? textarea : nameInput).current?.focus(),
                );
              }}
            >
              <span className="cm-av empty" aria-hidden>
                <ChatCircle weight="light" size={16} />
              </span>
              <span className="cz-ph">
                <T
                  zh="写点什么… 想加入、给建议、提问都可以"
                  en="Say something: want to join, a suggestion, a question"
                />
              </span>
            </button>
          )}
          <div className="cz-body" hidden={!open}>
            <div className="cz-term mono" aria-hidden>
              <span>
                $ <b>comment</b> --project {slug}
                <i className="cursor" />
              </span>
            </div>
            {replyTo ? (
              <div className="cz-replying">
                <span>
                  <T zh="回复" en="Replying to" /> <b>{replyTo.name}</b>
                </span>
                <button type="button" className="ibtn" onClick={cancelReply}>
                  <T zh="取消回复" en="Cancel reply" />
                </button>
              </div>
            ) : (
              <fieldset className="cz-kinds">
                <legend className="mono mute">
                  <T zh="类型" en="Type" />
                </legend>
                <div className="filters">
                  {COMMENT_KINDS.map((k) => {
                    const KindIcon = KIND_ICON[k];
                    return (
                      <label key={k} className="chip">
                        <input
                          type="radio"
                          name="kind"
                          value={k}
                          checked={kind === k}
                          onChange={() => setKind(k)}
                        />
                        <KindIcon weight="light" size={14} aria-hidden />
                        <T {...COMMENT_KIND_LABEL[k]} />
                      </label>
                    );
                  })}
                </div>
                {err.kind && (
                  <span className="err">
                    <Msg s={err.kind} />
                  </span>
                )}
              </fieldset>
            )}
            <div className="cz-row">
              <label className="field">
                <span className="mono">
                  <T zh="你的昵称" en="Your nickname" />
                </span>
                <input
                  ref={nameInput}
                  type="text"
                  name="nickname"
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="微信昵称 / WeChat name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  aria-invalid={Boolean(err.nickname)}
                />
                {err.nickname && (
                  <span className="err">
                    <Msg s={err.nickname} />
                  </span>
                )}
              </label>
              <label className="field cz-text">
                <span className="mono">
                  <T zh="评论" en="Comment" />
                  <span className={left < 50 ? "cz-left warn" : "cz-left"}>
                    {left}
                  </span>
                </span>
                <span className="cz-area">
                  <textarea
                    ref={textarea}
                    name="body"
                    maxLength={BODY_MAX}
                    placeholder="我会 React，想一起做前端… / I know React and could help with the frontend…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    aria-invalid={Boolean(err.body)}
                  />
                  <svg className="cz-ring" viewBox="0 0 22 22" aria-hidden>
                    <circle cx="11" cy="11" r="9" />
                    <circle
                      cx="11"
                      cy="11"
                      r="9"
                      className={left < 50 ? "fg warn" : "fg"}
                      style={{
                        strokeDashoffset: 56.55 * (1 - body.length / BODY_MAX),
                      }}
                    />
                  </svg>
                </span>
                {err.body && (
                  <span className="err">
                    <Msg s={err.body} />
                  </span>
                )}
              </label>
            </div>
            <div className="cz-foot">
              <p className="mute">
                <T
                  zh="评论会直接公开。不要留手机号、邮箱这类隐私信息。"
                  en="Comments go public right away. Leave out phone numbers, emails and other private details."
                />
              </p>
              <div className="cz-actions">
                <button
                  type="button"
                  className="ibtn"
                  onClick={() => {
                    setOpen(false);
                    cancelReply();
                  }}
                >
                  <T zh="收起" en="Close" />
                </button>
                <button
                  type="submit"
                  className="btn solid sm"
                  disabled={pending}
                  aria-busy={pending}
                >
                  {pending ? (
                    <T zh="发送中…" en="Posting…" />
                  ) : (
                    <T zh="发表评论" en="Post" />
                  )}{" "}
                  <Arr />
                </button>
              </div>
            </div>
            {state.status === "error" && (
              <p className="form-status err" role="alert">
                <Msg s={state.message} />
              </p>
            )}
          </div>
        </form>
      </div>

      {total === 0 ? (
        <p className="empty">
          <T
            zh="还没有评论。想加入、给建议或者提问，都可以写在这里。"
            en="No comments yet. Want to join, have a suggestion or a question? Write it here."
          />
        </p>
      ) : (
        <>
          <ol ref={list} className="cx-thread">
            {shown.map((t) => (
              <li key={t.id}>
                {t.root ? (
                  <Comment
                    c={t.root}
                    fresh={t.root.id === freshId}
                    onReply={() => reply(t.id, t.root!.nickname)}
                    admin={
                      admin
                        ? { slug, hasReplies: t.replies.length > 0 }
                        : undefined
                    }
                  />
                ) : (
                  <p className="ccard gone mono mute">
                    <T
                      zh="这条评论已被管理员删除"
                      en="This comment was removed by an admin"
                    />
                  </p>
                )}
                {t.replies.length > 0 && (
                  <ol className="cx-replies">
                    {t.replies.map((r) => (
                      <li key={r.id}>
                        <Comment
                          c={r}
                          fresh={r.id === freshId}
                          onReply={
                            t.root ? () => reply(t.id, r.nickname) : undefined
                          }
                          admin={
                            admin ? { slug, hasReplies: false } : undefined
                          }
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
          {visible.length === 0 && (
            <p className="empty">
              <T zh="这一类还没有评论。" en="Nothing in this category yet." />
            </p>
          )}
          {visible.length > limit && (
            <button
              type="button"
              className="btn ghost sm cx-more"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              <T
                zh={`再看 ${Math.min(PAGE, visible.length - limit)} 条`}
                en={`Show ${Math.min(PAGE, visible.length - limit)} more`}
              />
            </button>
          )}
        </>
      )}
      <p className="sr-only" role="status">
        {state.status === "ok" && <T zh="评论已发布" en="Comment posted" />}
      </p>
    </>
  );
}
