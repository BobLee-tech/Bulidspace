"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { prefersReducedMotion, hasFinePointer } from "@/components/fx/motion";
import { T } from "@/components/t";
import { themeColor, type CardDesign } from "@/lib/card-design";
import {
  memberCode,
  ordinal,
  SPARK_INFO,
  SPARKS,
  type CardView,
  type Spark,
} from "@/lib/members";
import { levelCard, MemberCard, setCardLight } from "../join/member-card";
import { createWelcomeFx, type WelcomeFx } from "./welcome-fx";

type Gsap = typeof import("gsap").gsap;

// The far pair stands higher and smaller (further back), the near pair lower;
// your mascot stands front and centre under your card.
const SLOTS = [
  { x: 11, y: 84, s: 0.82, z: 0.25, zi: 1, cls: "l" },
  { x: 89, y: 84, s: 0.82, z: 0.25, zi: 1, cls: "r" },
  { x: 27, y: 95, s: 1, z: 0.6, zi: 3, cls: "l" },
  { x: 73, y: 95, s: 1, z: 0.6, zi: 3, cls: "r" },
];
const YOU = { x: 50, y: 100, s: 1.15, z: 1, zi: 4, cls: "you" };
const ROLL = "01234567890123456789".split("");
/** An odometer strip's resting place: digit d in the second run of 0–9. */
const rest = (d: number) => -(10 + d) * 5;

const chars = (text: string) =>
  [...text].map((ch, i) => (
    <span key={i} className="ch">
      {ch}
    </span>
  ));

function Odometer({ digits }: { digits: string }) {
  return [...digits].map((d, i) => (
    <span key={i} className="wl-dg" data-d={d}>
      <span
        className="wl-strip"
        style={{ transform: `translateY(${rest(+d)}%)` }}
      >
        {ROLL.map((n, j) => (
          <span key={j}>{n}</span>
        ))}
      </span>
    </span>
  ));
}

/** The underline: a hairline with one puzzle knob, ending in a piece that snaps in. */
function Sign({ w }: { w: number }) {
  if (!w) return <svg className="wl-sign" aria-hidden />;
  const c = w / 2;
  const end = w - 30;
  return (
    <svg
      className="wl-sign"
      viewBox={`0 0 ${w} 36`}
      style={{ width: w }}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="wl-sign-grad"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={w}
          y2="0"
        >
          <stop offset="0" stopColor="#ff8fb3" stopOpacity="0" />
          <stop offset=".16" stopColor="#ff8fb3" />
          <stop offset=".36" stopColor="#ffd23f" />
          <stop offset=".56" stopColor="#6fd36a" />
          <stop offset=".78" stopColor="#5b9bff" />
          <stop offset="1" stopColor="#a98bff" />
        </linearGradient>
      </defs>
      <path
        className="wl-sign-path"
        d={`M0 22H${c - 9}C${c - 5} 22 ${c - 5} 17 ${c - 8} 14A10 10 0 1 1 ${c + 8} 14C${c + 5} 17 ${c + 5} 22 ${c + 9} 22H${end}`}
        fill="none"
        stroke="url(#wl-sign-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
      />
      <g transform={`translate(${w - 14} 22)`}>
        <g className="wl-sign-piece">
          <g transform="scale(.22) translate(-50 -50)" fill="currentColor">
            <rect x="22" y="22" width="56" height="56" rx="9" />
            <circle cx="50" cy="15" r="12" />
            <circle cx="85" cy="50" r="12" />
            <circle cx="50" cy="85" r="12" />
            <circle cx="15" cy="50" r="12" />
          </g>
        </g>
      </g>
    </svg>
  );
}

type TimelineOpts = {
  theme: string;
  you: Spark;
  /** The welcome card's .mc-col. */
  col: HTMLElement | null;
  /** The key words have lit up: the slot reads "Filled". */
  onFilled: () => void;
  /** The mascots have landed: measure where they stand. */
  onSettled: () => void;
  later: (fn: () => void, ms: number) => void;
};

/** The whole welcome as one GSAP timeline over the scene in `el`. */
function playTimeline(g: Gsap, el: HTMLElement, f: WelcomeFx, o: TimelineOpts) {
  const $ = (s: string) => el.querySelector<HTMLElement>(s)!;
  const $$ = (s: string) => [...el.querySelectorAll<HTMLElement>(s)];
  const key = $(".wl-key");
  const glowEl = $(".wl-key-glow");
  const { col, theme, you } = o;
  f.start(theme);

  const crowd = $$(".wl-m:not(.you)");
  const me = $(".wl-m.you");
  const bubO = crowd.map((m) => m.querySelector<HTMLElement>(".wl-bubble")!);
  const bubY = me.querySelector<HTMLElement>(".wl-bubble")!;
  g.set([key, glowEl], { opacity: 0 });
  g.set(".wl-sign-path", { strokeDashoffset: 1 });
  g.set(".wl-sign-piece", { scale: 0, transformOrigin: "50% 50%" });
  g.set([...bubO, bubY], { autoAlpha: 0, y: 6, scale: 0.9 });
  $(".wl-next").classList.add("anim");
  col?.classList.add("no-tr");
  col?.classList.remove("shine");

  const formAt = 0.8;
  const formLen = f.formText(key, formAt) || 1.4;
  const revealAt = formAt + formLen + 0.35;
  const odo = $$(".wl-odo .wl-strip");
  const count = $$(".wl-count .wl-strip");
  // The strips rest on their digit through an inline translateY(%); GSAP
  // reads that back as a px offset, so zero `y` as well as `yPercent`.
  g.set([...odo, ...count], { y: 0, yPercent: 0 });

  const tl = g.timeline({ defaults: { ease: "expo.out" } });
  tl.from(".wl-kicker", { opacity: 0, y: 12, duration: 1 }, 0)
    .add(() => {
      odo.forEach((s, i) =>
        g.to(s, {
          yPercent: rest(Number(s.parentElement!.dataset.d)),
          duration: 1.6 + i * 0.2,
          ease: "expo.out",
        }),
      );
    }, 0.15)
    // The sentence rises through a mask, character by character.
    .fromTo(
      ".wl-row1 .ch",
      { yPercent: 118 },
      { yPercent: 0, duration: 1.1, stagger: 0.04 },
      0.12,
    )
    .fromTo(
      ".wl-name",
      { "--sh": "-30%" },
      { "--sh": "130%", duration: 1.4, ease: "power2.inOut" },
      0.85,
    )
    .add(() => f.ripple(key), formAt - 0.15)
    // The big number rolls in step with the particles gathering.
    .add(() => {
      count.forEach((s, i, all) =>
        g.to(s, {
          yPercent: rest(Number(s.parentElement!.dataset.d)),
          duration: revealAt - formAt - 0.1 + (i - all.length + 1) * 0.25,
          ease: "power4.inOut",
        }),
      );
    }, formAt)
    // Fire the first rockets a second early so they burst as the words light up.
    .add(() => f.salvo(), revealAt - 0.95)
    .to(
      [key, glowEl],
      { opacity: 1, duration: 0.7, ease: "power2.out" },
      revealAt,
    )
    .add(() => {
      f.reveal();
      f.glow(key);
      o.onFilled();
    }, revealAt)
    .fromTo(
      key,
      { "--sh": "-30%" },
      { "--sh": "130%", duration: 1.3, ease: "power2.inOut" },
      revealAt + 0.15,
    )
    .to(
      ".wl-sign-path",
      { strokeDashoffset: 0, duration: 1.1, ease: "power3.inOut" },
      revealAt + 0.2,
    )
    .to(
      ".wl-sign-piece",
      { scale: 1, duration: 0.7, ease: "back.out(3)" },
      revealAt + 1.15,
    )
    .add(() => {
      const r = $(".wl-sign-piece").getBoundingClientRect();
      f.burst(r.left + r.width / 2, r.top + r.height / 2, theme, 20, 2.4);
    }, revealAt + 1.2)
    .from(".wl-en", { opacity: 0, y: 8, duration: 0.9 }, revealAt + 0.4)
    // The card rises out of the dark and turns once, back to front.
    .from(
      ".wl-card-in",
      { y: 110, scale: 0.88, opacity: 0, duration: 1.7 },
      1.0,
    )
    .fromTo(
      ".wl-card .mcard",
      { rotateY: -180, rotateX: 16 },
      {
        rotateY: 0,
        rotateX: 0,
        duration: 1.9,
        clearProps: "transform",
        onComplete: () => {
          if (!col) return;
          col.classList.remove("no-tr", "shine");
          void col.offsetWidth;
          col.classList.add("shine");
        },
      },
      1.0,
    );

  // The mascots drop onto the floor: fall, squash on contact, settle on a soft spring.
  const dropAt = revealAt - 0.2;
  [...crowd, me].forEach((m, i) => {
    const pop = m.querySelector<HTMLElement>(".wl-pop")!;
    const at = dropAt + i * 0.13 + (m === me ? 0.22 : 0);
    tl.fromTo(
      pop,
      { y: -70, opacity: 0, scaleX: 0.9, scaleY: 1.12 },
      {
        y: 0,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
        ease: "power2.in",
      },
      at,
    )
      .to(
        pop,
        { scaleX: 1.12, scaleY: 0.86, duration: 0.11, ease: "power1.out" },
        at + 0.5,
      )
      .to(
        pop,
        {
          scaleX: 1,
          scaleY: 1,
          duration: 0.75,
          ease: "elastic.out(1, 0.45)",
          clearProps: "transform",
        },
        at + 0.61,
      );
    if (m === me) {
      tl.add(() => {
        const r = me.querySelector(".wl-body")!.getBoundingClientRect();
        f.burst(
          r.left + r.width / 2,
          r.bottom - 6,
          SPARK_INFO[you].color,
          14,
          1.4,
          0.7,
        );
      }, at + 0.5);
    }
  });
  tl.add(() => o.onSettled(), dropAt + 1.6);
  $(".wl-pool").animate([{ opacity: 0 }, { opacity: 0.34 }], {
    duration: 1600,
    delay: (dropAt + 0.4) * 1000,
    easing: "cubic-bezier(.16,1,.3,1)",
    fill: "backwards",
  });

  // The others say their line one after another; yours comes last and stays.
  const chorusAt = dropAt + 1.2;
  bubO.forEach((bub, i) => {
    const t = chorusAt + i * 0.62;
    tl.to(
      bub,
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.8)" },
      t,
    ).to(
      bub,
      { autoAlpha: 0, y: -4, duration: 0.35, ease: "power2.in" },
      t + 1.15,
    );
  });
  tl.to(
    bubY,
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.8)" },
    chorusAt + bubO.length * 0.62 + 0.1,
  )
    .from(
      ".wl-meta > *",
      { y: 18, opacity: 0, duration: 0.9, stagger: 0.12 },
      revealAt + 0.6,
    )
    .from(
      ".wl-step",
      {
        y: 26,
        opacity: 0,
        duration: 1,
        stagger: 0.09,
        clearProps: "transform,opacity",
        onComplete: () => $(".wl-next").classList.remove("anim"),
      },
      revealAt + 0.8,
    )
    .from(".wl-actions", { opacity: 0, duration: 0.6 }, revealAt + 1.2)
    .add(() => {
      g.fromTo(
        key,
        { "--sh": "-30%" },
        {
          "--sh": "130%",
          duration: 1.3,
          ease: "power2.inOut",
          repeat: -1,
          repeatDelay: 6,
        },
      );
    }, revealAt + 6);
  // Everything is in its starting pose: show the page.
  el.classList.add("go");
  o.later(o.onSettled, 200);
}

/**
 * "{name}, you are the {Nth} Builder!" The number rolls like an odometer to
 * the real join order, "Builder!" assembles from particles and lights up in
 * the five mascot colours, fireworks go up on both sides, the card rises and
 * turns, and the five mascots drop onto the floor and say their lines.
 * Reduced motion gets the finished scene, still.
 */
export function WelcomeScreen({
  card,
  design,
  adminQr,
}: {
  card: CardView;
  design: CardDesign;
  adminQr: string;
}) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cardCol = useRef<HTMLDivElement>(null);
  const fx = useRef<WelcomeFx | null>(null);
  const reduced = useRef(false);
  const [art, setArt] = useState<Partial<Record<Spark, string>>>({});
  const [signW, setSignW] = useState(0);
  const [filled, setFilled] = useState(false);
  const [play, setPlay] = useState(0);
  const [ready, setReady] = useState(false);

  const name = card.nickname;
  const n = card.memberNo ?? 0;
  const ord = ordinal(n);
  const piece = memberCode(n).slice(-4);
  const you = card.spark;
  const theme = themeColor(design, you);
  const others = SPARKS.filter((s) => s !== you);
  const sized = signW > 0;
  const crew = [
    ...others.map((k, i) => ({
      k,
      ...SLOTS[i],
      d: i * 0.55 + 0.3,
      bd: i * 1.3 + 0.8,
    })),
    { k: you, ...YOU, d: 0, bd: 2.4 },
  ];

  /** Re-measures where the mascots stand; set by the pointer effect. */
  const settle = useRef(() => {});

  // The mascots are inlined (not <img>) so their eyes can follow the pointer
  // and blink; the timeline waits for them and for the display fonts.
  useEffect(() => {
    let cancelled = false;
    let got: (readonly [Spark, string | null])[] = [];
    const svgs = Promise.all(
      SPARKS.map((s) =>
        fetch(`/mascots/${s}.svg`)
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null)
          .then((t) => [s, t] as const),
      ),
    ).then((list) => {
      got = list;
    });
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 1800));
    void Promise.race([Promise.all([svgs, fonts]), timeout]).then(() => {
      if (cancelled) return;
      setArt(
        Object.fromEntries(
          got.filter(([, t]) => t?.trimStart().startsWith("<svg")),
        ),
      );
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One canvas for the whole page; it lives as long as the page does.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    reduced.current = prefersReducedMotion();
    const f = createWelcomeFx(cv, reduced.current);
    fx.current = f;
    return () => {
      f.destroy();
      fx.current = null;
    };
  }, []);

  // Lay out what depends on measured text: the name's continuous highlight
  // and the underline's width.
  useEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const measure = () => {
      const nameEl = el.querySelector<HTMLElement>(".wl-name");
      if (nameEl) {
        nameEl.style.setProperty(
          "--w",
          `${nameEl.getBoundingClientRect().width}px`,
        );
        nameEl
          .querySelectorAll<HTMLElement>(".ch")
          .forEach((ch) =>
            ch.style.setProperty("--off", `${-ch.offsetLeft}px`),
          );
      }
      const wrap = el.querySelector(".wl-keywrap");
      if (wrap) {
        setSignW(
          Math.max(160, Math.round(wrap.getBoundingClientRect().width * 0.92)),
        );
      }
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [ready]);

  // The welcome itself. Runs again on "replay".
  useEffect(() => {
    const el = root.current;
    const f = fx.current;
    if (!el || !f || !ready || !sized) return;
    setFilled(false);
    if (reduced.current) {
      f.start(theme);
      setFilled(true);
      el.classList.add("go", "still");
      return;
    }
    let cancelled = false;
    let revert = () => {};
    const timers: ReturnType<typeof setTimeout>[] = [];
    void import("gsap").then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(
        () =>
          playTimeline(gsap, el, f, {
            theme,
            you,
            col: cardCol.current,
            onFilled: () => setFilled(true),
            onSettled: () => settle.current(),
            later: (fn, ms) => timers.push(setTimeout(fn, ms)),
          }),
        el,
      );
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      revert();
      el.querySelector(".wl-next")?.classList.remove("anim");
    };
  }, [ready, sized, play, theme, you]);

  // Pointer, parallax and clicks. The pointer is read once per frame: it
  // pushes the particles, moves the card's light, sets the parallax target and
  // turns the mascots' eyes. Parallax eases inside the canvas frame and only
  // writes while it is still moving.
  useEffect(() => {
    const el = root.current;
    const f = fx.current;
    if (!el || !f || !ready) return;
    let crew: {
      m: HTMLElement;
      x: number;
      y: number;
      ex: number;
      ey: number;
    }[] = [];
    let layers: { el: HTMLElement; z: number }[] = [];
    const px = { tx: 0, ty: 0, x: 0, y: 0 };
    let ptr: { x: number; y: number; step: HTMLElement | null } | null = null;
    let raf = 0;

    const measure = () => {
      crew = [...el.querySelectorAll<HTMLElement>(".wl-m")].map((m) => {
        const r = m.getBoundingClientRect();
        return {
          m,
          x: r.left + r.width / 2,
          y: r.top + scrollY + r.height * 0.45,
          ex: 0,
          ey: 0,
        };
      });
      layers = [...el.querySelectorAll<HTMLElement>(".wl-par")].map((p) => ({
        el: p,
        z: Number(p.dataset.z) || 0.5,
      }));
    };
    measure();
    settle.current = measure;

    f.onFrame = () => {
      const dx = px.tx - px.x;
      const dy = px.ty - px.y;
      if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
      px.x += dx * 0.07;
      px.y += dy * 0.07;
      for (const q of layers) {
        q.el.style.transform = `translate3d(${(px.x * q.z * 18).toFixed(2)}px,${(px.y * q.z * 10).toFixed(2)}px,0)`;
      }
    };

    const apply = () => {
      raf = 0;
      if (!ptr || reduced.current) return;
      const { x, y } = ptr;
      f.pointer(x, y);
      px.tx = (x / innerWidth) * 2 - 1;
      px.ty = (y / innerHeight) * 2 - 1;
      const col = cardCol.current;
      const stage = col?.querySelector(".mc-stage");
      if (col && stage && hasFinePointer()) {
        const r = stage.getBoundingClientRect();
        const cl = (v: number) => Math.min(1.3, Math.max(-0.3, v));
        col.querySelector(".mc-tilt")?.classList.add("tracking");
        setCardLight(
          col,
          cl((x - r.left) / r.width),
          cl((y - r.top) / r.height),
          0.5,
        );
      }
      const sy = scrollY;
      for (const c of crew) {
        const dx = x - c.x;
        const dy = y - (c.y - sy);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 120);
        const ex = (dx / dist) * 2.4 * k;
        const ey = (dy / dist) * 1.8 * k;
        if (Math.abs(ex - c.ex) + Math.abs(ey - c.ey) < 0.35) continue;
        c.ex = ex;
        c.ey = ey;
        c.m.style.setProperty("--ex", `${ex.toFixed(2)}px`);
        c.m.style.setProperty("--ey", `${ey.toFixed(2)}px`);
      }
      if (ptr.step) {
        const r = ptr.step.getBoundingClientRect();
        ptr.step.style.setProperty("--gx", `${x - r.left}px`);
        ptr.step.style.setProperty("--gy", `${y - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      ptr = {
        x: e.clientX,
        y: e.clientY,
        step: (e.target as Element).closest<HTMLElement>(".wl-step"),
      };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      ptr = null;
      f.leave();
      px.tx = px.ty = 0;
      if (cardCol.current) levelCard(cardCol.current);
      for (const c of crew) {
        c.ex = c.ey = 0;
        c.m.style.removeProperty("--ex");
        c.m.style.removeProperty("--ey");
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const m = target.closest<HTMLElement>(".wl-m");
      if (m) {
        // A buddy: it hops and sparkles in its own colour.
        m.classList.remove("hop");
        void m.offsetWidth;
        m.classList.add("hop");
        const r = m.getBoundingClientRect();
        const k = m.dataset.spark as Spark;
        f.burst(
          r.left + r.width / 2,
          r.top + r.height * 0.4,
          SPARK_INFO[k].color,
          22,
          2.6,
        );
        return;
      }
      // Empty space: send a firework up towards the click.
      if (!target.closest("a, button, .mc-col, .wl-step, input")) {
        f.launchTo(e.clientX, e.clientY);
      }
    };
    let scrollT: ReturnType<typeof setTimeout> | undefined;
    const remeasure = () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(measure, 120);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    addEventListener("scroll", remeasure, { passive: true });
    addEventListener("resize", remeasure);
    return () => {
      f.onFrame = null;
      settle.current = () => {};
      cancelAnimationFrame(raf);
      clearTimeout(scrollT);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      removeEventListener("scroll", remeasure);
      removeEventListener("resize", remeasure);
    };
  }, [ready]);

  return (
    <section
      ref={root}
      className="wl"
      data-bg-pause
      style={{ "--c": theme } as CSSProperties}
    >
      <div className="wl-bg" aria-hidden>
        <div className="wl-neb" />
        <canvas className="wl-fx" ref={canvas} />
      </div>
      <div className="wrap wl-in">
        <p className="wl-kicker">
          <i className="wl-pulse" />
          <span className="wl-wt">Welcome to BuilderSpace</span>
          <span className="wl-bar" />
          <span>
            Piece №{" "}
            <b className="wl-odo" aria-hidden>
              <Odometer digits={piece} />
            </b>
            <span className="sr-only">{piece}</span>
          </span>
        </p>
        <h1
          className="wl-title"
          aria-label={`${name}, you are the ${n}${ord} Builder!`}
        >
          <span className="wl-row wl-row1" aria-hidden>
            <span className="wl-name">{chars(name)}</span>
            <span className="ch wl-comma">, </span>
            {chars("you are the")}
          </span>
          <span className="wl-row2" aria-hidden>
            <span className="wl-keywrap">
              <span className="wl-slot">
                Slot {piece} · <b>{filled ? "Filled ✓" : "Open"}</b>
              </span>
              <span className="wl-count">
                <Odometer digits={String(n)} />
                <sup>{ord}</sup>
              </span>
              <span className="wl-keyin">
                <span className="wl-key-glow">Builder!</span>
                <span className="wl-key">Builder!</span>
              </span>
            </span>
          </span>
        </h1>
        <Sign w={signW} />
        <p className="wl-en">
          <T
            zh={`你是第 ${n} 位 Builder！`}
            en={`Builder No. ${n}, your piece is in.`}
          />
        </p>

        <div className="wl-scene">
          <div className="wl-ground" aria-hidden>
            <div className="wl-floor" />
          </div>
          <div className="wl-pool" aria-hidden />
          <div className="wl-card">
            <div className="wl-par" data-z=".35">
              <div className="wl-card-in">
                <MemberCard
                  card={card}
                  design={design}
                  flipped={false}
                  still
                  colRef={cardCol}
                />
              </div>
            </div>
          </div>
          {crew.map((it) => {
            const s = SPARK_INFO[it.k];
            return (
              <button
                key={it.k}
                type="button"
                className={`wl-m ${it.cls}`}
                data-spark={it.k}
                aria-label={`${s.name} · ${s.role.en}: ${s.say}`}
                style={
                  {
                    "--x": `${it.x}%`,
                    "--y": `${it.y}%`,
                    "--s": it.s,
                    "--zi": it.zi,
                    "--d": `-${it.d}s`,
                    "--bd": `${it.bd}s`,
                    "--c": s.color,
                  } as CSSProperties
                }
              >
                <span className="wl-par" data-z={it.z}>
                  <span className="wl-pop">
                    <span className="wl-bub">
                      <span className="wl-bubble">{s.say}</span>
                    </span>
                    <span className="wl-body">
                      <span className="wl-shadow" />
                      <span
                        className="wl-art"
                        dangerouslySetInnerHTML={{
                          __html:
                            art[it.k] ??
                            `<img src="/mascots/${it.k}.svg" alt="">`,
                        }}
                      />
                    </span>
                    <span className="wl-name-tag">
                      {s.name}
                      {it.cls === "you" && (
                        <em>
                          <T zh="你" en="You" />
                        </em>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="wl-meta">
          <p className="wl-slogan">
            Different Pieces. One Big Idea.
            <span>五色各异，拼创无限。</span>
          </p>
          <p className="wl-hint">
            <T
              zh="点空白处放一朵烟花 · 点伙伴听它说话"
              en="Click empty space for a firework · click a buddy to hear it"
            />
          </p>
        </div>

        <div className="wl-next">
          <div
            className="wl-step first"
            style={{ "--c": SPARK_INFO.kiko.color } as CSSProperties}
          >
            <span className="wl-ico">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z" />
                <path d="M16 9h1.5A2.5 2.5 0 0 1 20 11.5v4a2.5 2.5 0 0 1-2.5 2.5H17v3l-3.5-3H11" />
              </svg>
            </span>
            <span className="mono mute">
              <T zh="01 · 今天" en="01 · Today" />
            </span>
            <h3>
              <T zh="进社群" en="Join the group" />
            </h3>
            <p>
              <T
                zh={`扫码加管理员微信，备注「BuilderSpace + ${name}」，管理员拉你进群。`}
                en={`Scan to add the admin on WeChat with the note "BuilderSpace + ${name}", and you'll be added to the group.`}
              />
            </p>
            <div className="wl-qr">
              {/* eslint-disable-next-line @next/next/no-img-element -- ops-supplied QR, any host */}
              <img src={adminQr} alt="Admin WeChat QR / 管理员微信二维码" />
            </div>
          </div>
          <Link
            className="wl-step"
            href="/events"
            style={{ "--c": SPARK_INFO.momo.color } as CSSProperties}
          >
            <span className="wl-ico">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
                <path d="M17 3v4M15 5h4" />
              </svg>
            </span>
            <span className="mono mute">
              <T zh="02 · 这周" en="02 · This week" />
            </span>
            <h3>
              <T zh="来一场 Build Night" en="Come to a Build Night" />
            </h3>
            <p>
              <T
                zh="带上想法，现场组队，当晚就开工。"
                en="Bring an idea, find a team there and start that night."
              />
            </p>
            <span className="wl-go">
              <T zh="看活动时间" en="See the dates" /> <i>→</i>
            </span>
          </Link>
          <Link
            className="wl-step"
            href="/me/card"
            style={{ "--c": SPARK_INFO.vivi.color } as CSSProperties}
          >
            <span className="wl-ico">
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="6" width="18" height="12" rx="2.5" />
                <path d="M3 10h18M7 15h4" />
              </svg>
            </span>
            <span className="mono mute">
              <T zh="03 · 随时" en="03 · Anytime" />
            </span>
            <h3>
              <T zh="把卡片做成你的样子" en="Make the card yours" />
            </h3>
            <p>
              <T
                zh="换材质、颜色和纹样，贴上拼块伙伴和贴纸。"
                en="Change the material, colour and pattern, and add stickers."
              />
            </p>
            <span className="wl-go">
              <T zh="去卡片工坊" en="Open the card studio" /> <i>→</i>
            </span>
          </Link>
        </div>
        <div className="wl-actions">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              scrollTo({ top: 0, behavior: "smooth" });
              setPlay((p) => p + 1);
            }}
          >
            <T zh="重播欢迎动画" en="Replay the welcome" />
          </button>
          <Link href="/me" className="btn ghost sm">
            <T zh="我的卡片" en="My card" />
          </Link>
        </div>
      </div>
    </section>
  );
}
