"use client";

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  frameLoop,
  hasFinePointer,
  prefersReducedMotion,
} from "@/components/fx/motion";
import { Scramble } from "@/components/fx/text-fx";
import { T } from "@/components/t";
import {
  DEFAULT_DESIGN,
  shownDesign,
  TINT_INFO,
  type CardDesign,
  type PlacedSticker,
} from "@/lib/card-design";
import { STICKER_ART, stickerMask, stickerSvg } from "@/lib/card-stickers";
import {
  LOOKING_LABEL,
  MEMBER_SKILL_LABEL,
  SPARK_INFO,
  memberCode,
  type CardView,
} from "@/lib/members";

export type { CardView } from "@/lib/members";

/** A design as the card draws it; studio stickers carry a `uid` for their key. */
export type CardLook = Omit<CardDesign, "stickers"> & {
  stickers: PlacedSticker[];
};

/** Where the virtual light sits when nothing is hovering: a slow loop. */
const idleLight = (t: number) => [
  0.5 + Math.cos(t / 2200) * 0.38,
  0.35 + Math.sin(t / 2200) * 0.3,
];

/**
 * Moves the card's light to (x, y), in 0–1 of the card, and tilts it by
 * `tilt` (0 = flat). Writes custom properties on the .mc-col element only.
 */
export function setCardLight(el: HTMLElement, x: number, y: number, tilt = 0) {
  const s = el.style;
  const dx = x - 0.5;
  const dy = y - 0.5;
  s.setProperty("--lx", `${(x * 100).toFixed(1)}%`);
  s.setProperty("--ly", `${(y * 100).toFixed(1)}%`);
  s.setProperty(
    "--la",
    `${((Math.atan2(dy, dx) * 180) / Math.PI + 90).toFixed(1)}deg`,
  );
  s.setProperty("--lk", Math.min(1, Math.hypot(dx, dy) * 1.6).toFixed(2));
  s.setProperty("--px", (dx * 2).toFixed(3));
  s.setProperty("--py", (dy * 2).toFixed(3));
  if (tilt) {
    s.setProperty("--ry", `${(dx * 20 * tilt).toFixed(2)}deg`);
    s.setProperty("--rx", `${(-dy * 14 * tilt).toFixed(2)}deg`);
  }
}

/** Puts the card back level and stops the tilt from easing (pointer left). */
export function levelCard(el: HTMLElement) {
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.querySelector(".mc-tilt")?.classList.remove("tracking");
}

/**
 * The member card, in the material, colour and pattern the member picked,
 * with their stickers. One virtual light drives every layer: the pointer moves
 * it (and tilts the card), and when idle it drifts on its own. The front says
 * who you are; the back is your builder profile: your mascot, what you are
 * building and who you are looking for.
 */
export function MemberCard({
  card,
  design = DEFAULT_DESIGN,
  flipped,
  caption,
  tilt = 1,
  still = false,
  editable = false,
  popUid,
  overlay,
  colRef,
  className,
}: {
  card: CardView;
  design?: CardLook;
  flipped: boolean;
  caption?: ReactNode;
  /** How far the pointer tilts the card; the studio keeps it small. */
  tilt?: number;
  /** No idle drift and no pointer of its own: the page drives the light. */
  still?: boolean;
  /** Stickers can be focused and picked up (the studio). */
  editable?: boolean;
  /** The sticker that was just added, to pop it in. */
  popUid?: number | null;
  /** Drawn above the card face, inside the tilt (the studio's handles). */
  overlay?: ReactNode;
  colRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const own = useRef<HTMLDivElement>(null);
  const col = colRef ?? own;
  const tiltEl = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const spark = SPARK_INFO[card.spark];
  const major = [card.major, card.schoolDegree].filter(Boolean).join(" · ");
  const no = card.memberNo ? memberCode(card.memberNo) : "BS-····";
  const d = shownDesign(design, Boolean(card.seal));
  const tint = TINT_INFO[d.tint];
  const ti = d.tint === "none" ? TINT_INFO.geo : tint;

  // Set on the column so the shadow under the card can follow the light too.
  const light = (x: number, y: number, tiltToo: boolean) => {
    if (col.current) setCardLight(col.current, x, y, tiltToo ? tilt : 0);
  };

  // Idle drift, only while the card is on screen.
  useEffect(() => {
    const el = tiltEl.current;
    if (!el || still || prefersReducedMotion()) return;
    let stop: (() => void) | null = null;
    const io = new IntersectionObserver(([e]) => {
      stop?.();
      stop = e.isIntersecting
        ? frameLoop.add((_, now) => {
            if (!hovering.current && col.current) {
              const [x, y] = idleLight(now);
              setCardLight(col.current, x, y);
            }
            return true;
          })
        : null;
    });
    io.observe(el);
    return () => {
      io.disconnect();
      stop?.();
    };
  }, [col, still]);

  const shown = card.skills.slice(0, 3);
  const more = card.skills.length - shown.length;
  const classes = ["mc-col", editable && "editable", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      ref={col}
      data-mat={d.material}
      data-pat={d.pattern}
      style={
        {
          "--spark": spark.color,
          "--tint-a": tint.a,
          "--tint-b": tint.b,
          "--tint-o": tint.o,
          "--ti-a": ti.a,
          "--ti-b": ti.b,
          "--glow": d.tint === "none" ? "rgba(170, 170, 180, 0.45)" : tint.a,
        } as CSSProperties
      }
    >
      <div
        className="mc-stage"
        onPointerMove={(e) => {
          if (still || !hasFinePointer() || prefersReducedMotion()) return;
          // A sticker being dragged owns the pointer; keep the card level.
          if (e.buttons) return;
          const r = e.currentTarget.getBoundingClientRect();
          hovering.current = true;
          tiltEl.current?.classList.add("tracking");
          light(
            (e.clientX - r.left) / r.width,
            (e.clientY - r.top) / r.height,
            true,
          );
        }}
        onPointerLeave={() => {
          if (still) return;
          hovering.current = false;
          if (col.current) levelCard(col.current);
        }}
      >
        <div className="mc-tilt" ref={tiltEl}>
          <div className={flipped ? "mcard flip" : "mcard"}>
            <i className="mc-edge" aria-hidden />
            <i className="mc-edge" aria-hidden />
            <i className="mc-edge" aria-hidden />
            <div className="mc-face mc-front" aria-hidden={flipped}>
              <Under front />
              <span className="mc-frame" aria-hidden />
              <div className="mc-top">
                <span className="logo">BuilderSpace</span>
                <span className="mono mute">Member · T3 2026</span>
              </div>
              <div className="mc-mid">
                <b className="mc-name">
                  {card.nickname ? (
                    <Scramble text={card.nickname} frames={14} />
                  ) : (
                    <T zh="你的昵称" en="Your name" />
                  )}
                </b>
                <span className="mc-major">
                  {major || <T zh="专业 · 学位" en="Major · degree" />}
                </span>
                {d.tagline && <span className="mc-tagline">“{d.tagline}”</span>}
                <div className="mc-skills">
                  {shown.map((s) => (
                    <span key={s} className="tag">
                      <T {...MEMBER_SKILL_LABEL[s]} />
                    </span>
                  ))}
                  {more > 0 && <span className="tag">+{more}</span>}
                </div>
              </div>
              <div className="mc-bot">
                <div>
                  <span className="mono mute">No.</span>
                  <b className="mono">{no}</b>
                </div>
                <div>
                  <span className="mono mute">Spark</span>
                  <b className="mono mc-spark">
                    <T {...spark.role} />
                  </b>
                </div>
                {card.seal && (
                  <i className="mc-seal" title="School email verified">
                    <b>✓</b>
                    <small>{card.seal}</small>
                  </i>
                )}
                <div className="mc-chip" aria-hidden />
              </div>
              <div className="mc-stks">
                {d.stickers.map((st, i) => (
                  <StickerEl
                    key={st.uid ?? i}
                    st={st}
                    prefix={`${uid}s${st.uid ?? i}`}
                    pop={st.uid != null && st.uid === popUid}
                    editable={editable && !flipped}
                  />
                ))}
              </div>
              <Over />
              <span className="mc-micro" aria-hidden>
                BUILDERSPACE · DIFFERENT PIECES · ONE BIG IDEA · SYDNEY · T3
                2026 · 五色各异 · 拼创无限 · BUILDERSPACE · DIFFERENT PIECES
              </span>
            </div>
            <div className="mc-face mc-back" aria-hidden={!flipped}>
              <Under />
              <span className="mc-frame" aria-hidden />
              <div className="mc-top">
                <span className="mono mute">Builder profile</span>
                <span className="mono mute">{no}</span>
              </div>
              <div className="mc-profile">
                <div className="mc-buddy">
                  <span className="mc-say">{spark.say}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art */}
                  <img src={`/mascots/${card.spark}.svg`} alt="" />
                  <span className="mono mc-buddy-name">
                    {spark.name} · <T {...spark.role} />
                  </span>
                </div>
                <div className="mc-wants">
                  <div>
                    <span className="mono mute">
                      <T zh="正在做" en="Building" />
                    </span>
                    <p className={card.building ? "" : "mute"}>
                      {card.building || (
                        <T
                          zh="还没想好？来 Build Night 找灵感"
                          en="Not sure yet? Find one at Build Night"
                        />
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="mono mute">
                      <T zh="在找" en="Looking for" />
                    </span>
                    <div className="mc-skills">
                      {card.lookingFor.length ? (
                        card.lookingFor.map((k) => (
                          <span key={k} className="tag">
                            <T {...LOOKING_LABEL[k]} />
                          </span>
                        ))
                      ) : (
                        <span className="tag mute">
                          <T zh="随缘" en="Open to anything" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Over />
            </div>
          </div>
          {overlay}
        </div>
      </div>
      <div className="mc-shadow" aria-hidden />
      {caption && <p className="mono mute mc-cap">{caption}</p>}
    </div>
  );
}

/** One sticker: its art, and a sheen in its own shape that follows the light. */
function StickerEl({
  st,
  prefix,
  pop,
  editable,
}: {
  st: PlacedSticker;
  prefix: string;
  pop: boolean;
  editable: boolean;
}) {
  const art = STICKER_ART[st.id];
  const markup = stickerSvg(st.id, prefix);
  return (
    <div
      className={`stk f-${st.f}${pop ? " pop" : ""}`}
      data-uid={st.uid}
      style={
        {
          "--x": `${st.x}%`,
          "--y": `${st.y}%`,
          "--r": `${st.r}deg`,
          "--s": st.s,
          "--ar": art.ar,
          "--m": stickerMask(st.id),
        } as CSSProperties
      }
      {...(editable && {
        tabIndex: 0,
        role: "button",
        "aria-label": `${art.label.zh} / ${art.label.en}`,
      })}
    >
      {markup ? (
        <span className="art" dangerouslySetInnerHTML={{ __html: markup }} />
      ) : (
        <span
          className="art img"
          style={{ backgroundImage: `url(${"img" in art ? art.img : ""})` }}
        />
      )}
      <i className="sheen" aria-hidden />
    </div>
  );
}

/** The light-dependent layers under a face's content; see .mc-* in motion.css. */
function Under({ front = false }: { front?: boolean }) {
  return (
    <>
      <i className="mc-pat" aria-hidden />
      <i className="mc-brush" aria-hidden />
      {front && <i className="mc-aniso" aria-hidden />}
      <i className="mc-holo" aria-hidden />
      <i className="mc-tint" aria-hidden />
      <i className="mc-spec" aria-hidden />
    </>
  );
}

/** The layers over a face's content and stickers. */
function Over() {
  return (
    <>
      <i className="mc-glare" aria-hidden />
      <i className="mc-grain" aria-hidden />
      <i className="mc-rim" aria-hidden />
    </>
  );
}
