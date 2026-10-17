"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Arr, Hud } from "@/components/fx/arr";
import { prefersReducedMotion } from "@/components/fx/motion";
import { Msg, T } from "@/components/t";
import {
  FINISH_LABEL,
  FINISHES,
  MATERIAL_LABEL,
  MATERIALS,
  MAX_STICKERS,
  MAX_TAGLINE,
  PATTERN_LABEL,
  PATTERNS,
  shownDesign,
  STICKER_BOUNDS,
  STICKER_CAT_LABEL,
  STICKER_CATS,
  STICKERS,
  stickerCat,
  TINT_INFO,
  TINTS,
  VERIFIED_MATERIALS,
  type CardDesign,
  type Finish,
  type Material,
  type PlacedSticker,
  type StickerCat,
  type StickerId,
} from "@/lib/card-design";
import { STICKER_ART, stickerSvg } from "@/lib/card-stickers";
import {
  LOOKING_FOR,
  LOOKING_LABEL,
  MAX_LOOKING,
  SPARK_INFO,
  SPARKS,
  type CardView,
  type LookingFor,
  type Spark,
} from "@/lib/members";
import { levelCard, MemberCard, type CardLook } from "../../join/member-card";
import { saveCardDesign } from "./actions";

type Pane = "look" | "stk" | "id";
type Status = { kind: "ok" | "error"; message: string } | null;
type Drag =
  | {
      mode: "move";
      uid: number;
      el: HTMLElement;
      x0: number;
      y0: number;
      sx: number;
      sy: number;
      w: number;
      h: number;
      cur: PlacedSticker;
    }
  | {
      mode: "rot";
      uid: number;
      el: HTMLElement;
      cx: number;
      cy: number;
      a0: number;
      d0: number;
      r0: number;
      s0: number;
      cur: PlacedSticker;
    };

const clamp = (v: number, [lo, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(lo, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const VERIFY_HINT =
  "学校邮箱认证后解锁：用学校邮箱登录的成员是认证成员|Unlocks with a school email: members who sign in with one are verified";
const FIVE = Object.values(SPARK_INFO).map((s) => s.color);

/** What the save button compares against: the design without studio keys, plus the back. */
const snapshot = (
  d: CardLook,
  spark: Spark,
  building: string,
  looking: LookingFor[],
) =>
  JSON.stringify([
    d.material,
    d.tint,
    d.pattern,
    d.tagline.trim(),
    d.stickers.map(({ id, x, y, r, s, f }) => [id, x, y, r, s, f]),
    spark,
    building.trim(),
    looking,
  ]);

/** Writes a sticker's position, angle and size straight onto an element. */
function place(el: HTMLElement, st: PlacedSticker) {
  el.style.setProperty("--x", `${st.x}%`);
  el.style.setProperty("--y", `${st.y}%`);
  el.style.setProperty("--r", `${st.r}deg`);
  el.style.setProperty("--s", String(st.s));
}

/** A puzzle-piece confetti burst from the card, in the five mascot colours. */
async function burst(from: Element | null) {
  if (!from || prefersReducedMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  const r = from.getBoundingClientRect();
  let shape: confetti.Shape | undefined;
  try {
    shape = confetti.shapeFromPath({
      path: "M0 8H11C12 8 12 6 11 5A4.5 4.5 0 1 1 19 5C18 6 18 8 19 8H30V19C30 20 32 20 33 19A4.5 4.5 0 1 1 33 27C32 26 30 26 30 27V38H0Z",
    });
  } catch {
    shape = undefined;
  }
  await confetti({
    particleCount: 60,
    spread: 75,
    startVelocity: 32,
    scalar: shape ? 1.3 : 0.8,
    ticks: 170,
    origin: {
      x: (r.left + r.width / 2) / innerWidth,
      y: (r.top + r.height / 2) / innerHeight,
    },
    colors: FIVE,
    shapes: shape ? [shape] : undefined,
    disableForReducedMotion: true,
  });
}

/**
 * The card studio: material, tint and pattern; up to six stickers to move,
 * rotate and scale; a tagline; and the builder-profile back. The preview is
 * the real card. Dragging writes straight to the sticker's element and only
 * commits to state when the pointer lets go, so a drag never re-renders.
 */
export function CardStudio({
  card,
  design: stored,
  verified,
}: {
  card: CardView;
  design: CardDesign;
  verified: boolean;
}) {
  // Start from what the card shows: verified-only parts fall back if need be.
  const [initial] = useState(() => shownDesign(stored, verified));
  const uidN = useRef(initial.stickers.length);
  const [design, setDesign] = useState<CardLook>(() => ({
    ...initial,
    stickers: initial.stickers.map((s, i) => ({ ...s, uid: i + 1 })),
  }));
  const [spark, setSparkState] = useState<Spark>(card.spark);
  const [building, setBuilding] = useState(card.building ?? "");
  const [looking, setLooking] = useState<LookingFor[]>(card.lookingFor);
  const [pane, setPane] = useState<Pane>("look");
  const [flipped, setFlipped] = useState(false);
  const [cat, setCat] = useState<StickerCat>("spark");
  const [sel, setSel] = useState<number | null>(null);
  const [popUid, setPopUid] = useState<number | null>(null);
  const [saved, setSaved] = useState(() =>
    snapshot(
      { ...initial, stickers: initial.stickers },
      card.spark,
      card.building ?? "",
      card.lookingFor,
    ),
  );
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();
  const col = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const moveRaf = useRef(0);
  const lastMove = useRef<{ x: number; y: number; shift: boolean } | null>(
    null,
  );

  const current = snapshot(design, spark, building, looking);
  const dirty = current !== saved;
  const selected = design.stickers.find((s) => s.uid === sel) ?? null;
  const preview: CardView = {
    ...card,
    spark,
    building: building.trim() || null,
    lookingFor: looking,
  };
  const locked = (m: Material) => !verified && VERIFIED_MATERIALS.includes(m);
  const lockedSticker = (id: StickerId) =>
    !verified && stickerCat(id) === "campus";

  const update = (fn: (d: CardLook) => CardLook) => {
    setDesign(fn);
    setStatus(null);
  };
  const patchSticker = (uid: number, patch: Partial<PlacedSticker>) =>
    update((d) => ({
      ...d,
      stickers: d.stickers.map((s) => (s.uid === uid ? { ...s, ...patch } : s)),
    }));
  /** Selecting brings a sticker to the top of the stack. */
  const select = (uid: number | null, toFront = false) => {
    setSel(uid);
    // Moving a node restarts its CSS animations: let the pop play only once.
    setPopUid(null);
    if (uid == null || !toFront) return;
    setDesign((d) => {
      const i = d.stickers.findIndex((s) => s.uid === uid);
      if (i < 0 || i === d.stickers.length - 1) return d;
      const next = [...d.stickers];
      next.push(...next.splice(i, 1));
      return { ...d, stickers: next };
    });
  };
  const flash = () => {
    const el = col.current;
    if (!el || prefersReducedMotion()) return;
    el.classList.remove("swap");
    void el.offsetWidth;
    el.classList.add("swap");
  };
  const showPane = (p: Pane) => {
    setPane(p);
    setFlipped(p === "id");
    if (p === "id") setSel(null);
  };

  function addSticker(id: StickerId) {
    if (lockedSticker(id)) {
      setStatus({ kind: "error", message: VERIFY_HINT });
      return;
    }
    if (design.stickers.length >= MAX_STICKERS) {
      setStatus({
        kind: "error",
        message: `最多 ${MAX_STICKERS} 张贴纸，先删掉一张|Up to ${MAX_STICKERS} stickers, remove one first`,
      });
      return;
    }
    setFlipped(false);
    const uid = ++uidN.current;
    const st: PlacedSticker = {
      uid,
      id,
      x: Math.round(50 + rnd(-14, 14)),
      y: Math.round(50 + rnd(-12, 12)),
      r: Math.round(rnd(-14, 14)),
      s: STICKER_ART[id].s0,
      f: "orig",
    };
    update((d) => ({ ...d, stickers: [...d.stickers, st] }));
    setSel(uid);
    setPopUid(uid);
  }
  function removeSticker(uid: number) {
    update((d) => ({
      ...d,
      stickers: d.stickers.filter((s) => s.uid !== uid),
    }));
    setSel(null);
  }
  function setSpark(next: Spark) {
    const old = spark;
    setSparkState(next);
    setStatus(null);
    // Your Spark sticker and, if the colour followed the old mascot, the colour change with it.
    setDesign((d) => ({
      ...d,
      tint: d.tint === old ? next : d.tint,
      stickers: d.stickers.map((s) =>
        s.id === `spark-${old}` ? { ...s, id: `spark-${next}` } : s,
      ),
    }));
  }
  function shuffle() {
    const pick = <V,>(list: readonly V[], not: V, ok: (v: V) => boolean) => {
      const pool = list.filter((v) => v !== not && ok(v));
      return pool[(Math.random() * pool.length) | 0] ?? not;
    };
    update((d) => ({
      ...d,
      material: pick(MATERIALS, d.material, (m) => !locked(m)),
      tint: Math.random() < 0.3 ? "none" : pick(TINTS, d.tint, () => true),
      pattern: pick(PATTERNS, d.pattern, () => true),
    }));
    flash();
  }

  function save() {
    const payload = {
      design: {
        material: design.material,
        tint: design.tint,
        pattern: design.pattern,
        tagline: design.tagline.trim(),
        stickers: design.stickers.map(({ id, x, y, r, s, f }) => ({
          id,
          x,
          y,
          r,
          s,
          f,
        })),
      },
      spark,
      building,
      lookingFor: looking,
    };
    const snap = current;
    startTransition(async () => {
      const res = await saveCardDesign(payload);
      if (res.status === "error") {
        setStatus({ kind: "error", message: res.message });
        return;
      }
      setSaved(snap);
      setStatus({
        kind: "ok",
        message:
          "已保存，「我的卡片」已更新|Saved. Your card is updated everywhere",
      });
      const el = col.current;
      if (el && !prefersReducedMotion()) {
        el.classList.remove("shine");
        void el.offsetWidth;
        el.classList.add("shine");
      }
      void burst(el?.querySelector(".mcard") ?? null);
    });
  }

  /* ---------- drag, rotate, scale ---------- */

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (flipped) return;
    const target = e.target as Element;
    if (target.closest(".h-del")) return;
    const rot = target.closest(".h-rot");
    const stk = target.closest<HTMLElement>(".stk");
    if (!rot && !stk) {
      if (target.closest(".mc-stage")) setSel(null);
      return;
    }
    e.preventDefault();
    const uid = rot ? sel : Number(stk!.dataset.uid);
    const st = design.stickers.find((s) => s.uid === uid);
    const el = col.current?.querySelector<HTMLElement>(
      `.stk[data-uid="${uid}"]`,
    );
    if (uid == null || !st || !el) return;
    if (col.current) levelCard(col.current);
    if (!rot) select(uid, true);
    if (rot) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      drag.current = {
        mode: "rot",
        uid,
        el,
        cx,
        cy,
        a0: Math.atan2(e.clientY - cy, e.clientX - cx),
        d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
        r0: st.r,
        s0: st.s,
        cur: { ...st },
      };
    } else {
      const face = col
        .current!.querySelector(".mc-front")!
        .getBoundingClientRect();
      drag.current = {
        mode: "move",
        uid,
        el,
        x0: e.clientX,
        y0: e.clientY,
        sx: st.x,
        sy: st.y,
        w: face.width,
        h: face.height,
        cur: { ...st },
      };
      el.classList.add("dragging");
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // Pointer moves are coalesced to one write per frame.
  function applyMove() {
    moveRaf.current = 0;
    const d = drag.current;
    const p = lastMove.current;
    if (!d || !p) return;
    const st = d.cur;
    if (d.mode === "move") {
      st.x = +clamp(
        d.sx + ((p.x - d.x0) / d.w) * 100,
        STICKER_BOUNDS.x,
      ).toFixed(2);
      st.y = +clamp(
        d.sy + ((p.y - d.y0) / d.h) * 100,
        STICKER_BOUNDS.y,
      ).toFixed(2);
    } else {
      const a = Math.atan2(p.y - d.cy, p.x - d.cx);
      let r = d.r0 + ((a - d.a0) * 180) / Math.PI;
      if (p.shift) r = Math.round(r / 15) * 15;
      st.r = +(((((r + 540) % 360) + 360) % 360) - 180).toFixed(1);
      st.s = +clamp(
        (d.s0 * Math.hypot(p.x - d.cx, p.y - d.cy)) / d.d0,
        STICKER_BOUNDS.s,
      ).toFixed(3);
    }
    place(d.el, st);
    const box = stage.current?.querySelector<HTMLElement>(".selbox");
    if (box) place(box, st);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    lastMove.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
    if (!moveRaf.current) moveRaf.current = requestAnimationFrame(applyMove);
  }
  function endDrag() {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(moveRaf.current);
    moveRaf.current = 0;
    if (lastMove.current) applyMove();
    lastMove.current = null;
    d.el.classList.remove("dragging");
    drag.current = null;
    const { x, y, r, s } = d.cur;
    patchSticker(d.uid, { x, y, r, s });
  }
  useEffect(() => () => cancelAnimationFrame(moveRaf.current), []);

  // Keyboard: arrows move (Shift for 5%), [ ] rotate, - = scale, Delete removes.
  useEffect(() => {
    if (sel == null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("input, textarea, select")) return;
      const st = design.stickers.find((s) => s.uid === sel);
      if (!st) return;
      const step = e.shiftKey ? 5 : 1;
      let patch: Partial<PlacedSticker> | null = null;
      switch (e.key) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          removeSticker(st.uid!);
          return;
        case "Escape":
          setSel(null);
          return;
        case "ArrowLeft":
          patch = { x: clamp(st.x - step, STICKER_BOUNDS.x) };
          break;
        case "ArrowRight":
          patch = { x: clamp(st.x + step, STICKER_BOUNDS.x) };
          break;
        case "ArrowUp":
          patch = { y: clamp(st.y - step, STICKER_BOUNDS.y) };
          break;
        case "ArrowDown":
          patch = { y: clamp(st.y + step, STICKER_BOUNDS.y) };
          break;
        case "[":
          patch = { r: +(st.r - 5 < -180 ? st.r + 355 : st.r - 5).toFixed(1) };
          break;
        case "]":
          patch = { r: +(st.r + 5 > 180 ? st.r - 355 : st.r + 5).toFixed(1) };
          break;
        case "-":
          patch = { s: +clamp(st.s - 0.05, STICKER_BOUNDS.s).toFixed(3) };
          break;
        case "=":
        case "+":
          patch = { s: +clamp(st.s + 0.05, STICKER_BOUNDS.s).toFixed(3) };
          break;
      }
      if (!patch) return;
      e.preventDefault();
      patchSticker(st.uid!, patch);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const art = (id: StickerId) => {
    const a = STICKER_ART[id];
    const markup = stickerSvg(id, `tray-${id}-`);
    return markup ? (
      <span className="tart" dangerouslySetInnerHTML={{ __html: markup }} />
    ) : (
      <span className="tart">
        <span
          className="tart-img"
          style={{ backgroundImage: `url(${"img" in a ? a.img : ""})` }}
        />
      </span>
    );
  };

  const selbox = selected && !flipped && (
    <div className="mc-edit">
      <div
        className="selbox"
        style={
          {
            "--x": `${selected.x}%`,
            "--y": `${selected.y}%`,
            "--r": `${selected.r}deg`,
            "--s": selected.s,
            "--ar": STICKER_ART[selected.id].ar,
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="h-del"
          aria-label="删除选中的贴纸 / Remove the selected sticker"
          onClick={() => removeSticker(selected.uid!)}
        >
          ×
        </button>
        <span
          className="h-rot"
          title="拖动旋转和缩放 / Drag to rotate and scale"
          aria-hidden
        />
      </div>
    </div>
  );

  return (
    <div className="studio">
      <div className="stage-col">
        <div
          ref={stage}
          className="studio-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onFocus={(e) => {
            const stk = (e.target as Element).closest<HTMLElement>(".stk");
            if (stk) setSel(Number(stk.dataset.uid));
          }}
        >
          <MemberCard
            card={preview}
            design={design}
            flipped={flipped}
            tilt={0.3}
            editable
            popUid={popUid}
            overlay={selbox}
            colRef={col}
          />
          <div className="dim dim-x" aria-hidden>
            <span>85.60 mm</span>
          </div>
          <div className="dim dim-y" aria-hidden>
            <span>53.98 mm</span>
          </div>
        </div>
        <div className="row-actions studio-tools">
          <button
            type="button"
            className="btn ghost sm"
            aria-pressed={flipped}
            onClick={() => {
              setFlipped((f) => !f);
              setSel(null);
            }}
          >
            {flipped ? (
              <T zh="看正面" en="Show the front" />
            ) : (
              <T zh="看背面" en="Show the back" />
            )}
          </button>
          <button type="button" className="btn ghost sm" onClick={shuffle}>
            <T zh="随机一张" en="Surprise me" />
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!design.stickers.length}
            onClick={() => {
              update((d) => ({ ...d, stickers: [] }));
              setSel(null);
            }}
          >
            <T zh="清空贴纸" en="Clear stickers" />
          </button>
        </div>
        <p className="mute small studio-hint">
          <T
            zh="拖动贴纸移动 · 拖右上角圆点旋转和缩放（按住 Shift 每次转 15°）· 选中后按 Delete 删除，方向键微调"
            en="Drag a sticker to move it · drag the corner dot to rotate and scale (Shift snaps to 15°) · Delete removes it, arrow keys nudge"
          />
        </p>
      </div>

      <aside
        className="form hud studio-panel"
        aria-label="卡片设置 / Card settings"
      >
        <Hud />
        <div className="ptabs" role="tablist">
          {(
            [
              ["look", { zh: "外观", en: "Look" }],
              ["stk", { zh: "贴纸", en: "Stickers" }],
              ["id", { zh: "背面", en: "Back" }],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pane === p}
              onClick={() => showPane(p)}
            >
              <T {...label} />
            </button>
          ))}
        </div>

        {pane === "look" && (
          <div className="ptab" role="tabpanel">
            <fieldset className="grp">
              <legend className="grp-h">
                <span className="mono mute">
                  <T zh="材质" en="Material" />
                </span>
                <span className="val">
                  <T {...MATERIAL_LABEL[design.material]} />
                </span>
              </legend>
              <div className="opts">
                {MATERIALS.map((m) => (
                  <label
                    key={m}
                    className={locked(m) ? "opt locked" : "opt"}
                    title={
                      locked(m)
                        ? "学校邮箱认证后解锁 / Verified members"
                        : undefined
                    }
                    onClick={() => {
                      if (locked(m))
                        setStatus({ kind: "error", message: VERIFY_HINT });
                    }}
                  >
                    <input
                      type="radio"
                      name="material"
                      value={m}
                      checked={design.material === m}
                      disabled={locked(m)}
                      onChange={() => {
                        update((d) => ({ ...d, material: m }));
                        flash();
                      }}
                    />
                    <span className={`mat-sw mat-sw-${m}`} aria-hidden />
                    <span className="t">
                      <b>{MATERIAL_LABEL[m].zh}</b>
                      <small>{MATERIAL_LABEL[m].en}</small>
                    </span>
                    {VERIFIED_MATERIALS.includes(m) && (
                      <span className="lk">
                        {locked(m) && <LockIcon />}
                        <T zh="认证" en="Verified" />
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="grp">
              <legend className="grp-h">
                <span className="mono mute">
                  <T zh="颜色" en="Colour" />
                </span>
                <span className="val">
                  {design.material === "ti" && design.tint === "none" ? (
                    <T
                      zh="Geo 蓝（阳极钛默认）"
                      en="Geo blue (titanium's own)"
                    />
                  ) : (
                    <T {...TINT_INFO[design.tint].label} />
                  )}
                </span>
              </legend>
              <div className="tints">
                {TINTS.map((t) => (
                  <label key={t} className="tint">
                    <input
                      type="radio"
                      name="tint"
                      value={t}
                      checked={design.tint === t}
                      onChange={() => {
                        update((d) => ({ ...d, tint: t }));
                        flash();
                      }}
                    />
                    <span
                      className="dot"
                      aria-hidden
                      style={{
                        background:
                          t === "none"
                            ? "linear-gradient(135deg, #f0f0f2, #6a6a70 55%, #1a1a1c)"
                            : `linear-gradient(135deg, ${TINT_INFO[t].a}, ${TINT_INFO[t].b})`,
                      }}
                    />
                    <T {...TINT_INFO[t].label} />
                  </label>
                ))}
              </div>
              <p className="mute small">
                <T
                  zh="五种颜色来自五个拼块伙伴。颜色只出现在卡片上，网站界面仍然是黑、白、铬。"
                  en="The five colours come from the five Sparks. They only appear on cards; the site stays black, white and chrome."
                />
              </p>
            </fieldset>
            <fieldset className="grp">
              <legend className="grp-h">
                <span className="mono mute">
                  <T zh="纹样" en="Pattern" />
                </span>
                <span className="val">
                  <T {...PATTERN_LABEL[design.pattern]} />
                </span>
              </legend>
              <div className="opts pats">
                {PATTERNS.map((p) => (
                  <label key={p} className="opt">
                    <input
                      type="radio"
                      name="pattern"
                      value={p}
                      checked={design.pattern === p}
                      onChange={() => {
                        update((d) => ({ ...d, pattern: p }));
                        flash();
                      }}
                    />
                    <span className="pv" data-pat={p} aria-hidden>
                      <span className="c">
                        <i />
                      </span>
                    </span>
                    <span className="t">
                      <b>{PATTERN_LABEL[p].zh}</b>
                      <small>{PATTERN_LABEL[p].en}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field grp">
              <span className="field-row">
                <span className="mono mute">
                  <T zh="签名（印在名字下面）" en="Tagline (under your name)" />
                </span>
                <span className="count mono mute">
                  {design.tagline.length} / {MAX_TAGLINE}
                </span>
              </span>
              <input
                type="text"
                maxLength={MAX_TAGLINE}
                placeholder="Ship small, ship often."
                value={design.tagline}
                onChange={(e) => {
                  const tagline = e.target.value;
                  update((d) => ({ ...d, tagline }));
                }}
              />
            </label>
          </div>
        )}

        {pane === "stk" && (
          <div className="ptab" role="tabpanel">
            <div className="grp">
              <div className="grp-h">
                <span className="mono mute">
                  <T zh="贴纸" en="Stickers" />
                </span>
                <span className="val">
                  {design.stickers.length} / {MAX_STICKERS}
                </span>
              </div>
              <div
                className="seg"
                role="group"
                aria-label="贴纸分类 / Sticker sets"
              >
                {STICKER_CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cat === c}
                    onClick={() => setCat(c)}
                  >
                    <T {...STICKER_CAT_LABEL[c]} />
                    {c === "campus" && !verified && <LockIcon />}
                  </button>
                ))}
              </div>
              <div className="tray">
                {STICKERS.filter((id) => stickerCat(id) === cat).map((id) => {
                  const lockedHere = lockedSticker(id);
                  const label = STICKER_ART[id].label;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={lockedHere ? "locked" : undefined}
                      title={`${label.zh} / ${label.en}`}
                      aria-label={
                        lockedHere
                          ? `${label.zh} / ${label.en} (locked: verified members)`
                          : `贴上 ${label.zh} / Add ${label.en}`
                      }
                      onClick={() => addSticker(id)}
                    >
                      {art(id)}
                      {lockedHere && <LockIcon corner />}
                    </button>
                  );
                })}
              </div>
              <p className="mute small">
                {cat === "campus" ? (
                  verified ? (
                    <T
                      zh="认证成员专属的校园贴纸。"
                      en="Campus stickers, for verified members."
                    />
                  ) : (
                    <T
                      zh="学校邮箱认证后解锁这一组。"
                      en="This set unlocks with a school email."
                    />
                  )
                ) : (
                  <T
                    zh={`点一下贴到卡片上，最多 ${MAX_STICKERS} 张。`}
                    en={`Click to stick it on the card, up to ${MAX_STICKERS}.`}
                  />
                )}
              </p>
            </div>
            <div className="grp">
              <div className="grp-h">
                <span className="mono mute">
                  <T zh="选中贴纸的质感" en="Selected sticker's finish" />
                </span>
                <div className="seg" role="group" aria-label="质感 / Finish">
                  {FINISHES.map((f: Finish) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={selected?.f === f}
                      disabled={!selected}
                      onClick={() =>
                        selected && patchSticker(selected.uid!, { f })
                      }
                    >
                      <T {...FINISH_LABEL[f]} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {pane === "id" && (
          <div className="ptab" role="tabpanel">
            <fieldset className="grp">
              <legend className="mono mute">
                <T zh="你的拼块" en="Your piece" />
              </legend>
              <div className="sparks">
                {SPARKS.map((s) => (
                  <label
                    key={s}
                    className="spark"
                    style={{ "--c": SPARK_INFO[s].color } as CSSProperties}
                  >
                    <input
                      type="radio"
                      name="spark"
                      value={s}
                      checked={spark === s}
                      onChange={() => setSpark(s)}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art */}
                    <img src={`/mascots/${s}.svg`} alt="" />
                    <b>{SPARK_INFO[s].name}</b>
                    <small>
                      <T {...SPARK_INFO[s].role} />
                    </small>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field grp">
              <span className="field-row">
                <span className="mono mute">
                  <T zh="正在做 / 想做" en="Building, or want to build" />
                </span>
                <span className="count mono mute">{building.length} / 40</span>
              </span>
              <input
                type="text"
                maxLength={40}
                placeholder="帮留学生找合租室友的小工具 / A flatmate finder"
                value={building}
                onChange={(e) => {
                  setBuilding(e.target.value);
                  setStatus(null);
                }}
              />
            </label>
            <fieldset className="grp">
              <legend className="mono mute">
                <T
                  zh={`在找（最多 ${MAX_LOOKING} 个）`}
                  en={`Looking for (up to ${MAX_LOOKING})`}
                />
              </legend>
              <div className="filters">
                {LOOKING_FOR.map((k) => {
                  const on = looking.includes(k);
                  return (
                    <label key={k} className="chip">
                      <input
                        type="checkbox"
                        value={k}
                        checked={on}
                        disabled={!on && looking.length >= MAX_LOOKING}
                        onChange={() => {
                          setLooking((l) =>
                            on ? l.filter((x) => x !== k) : [...l, k],
                          );
                          setStatus(null);
                        }}
                      />
                      <T {...LOOKING_LABEL[k]} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        <div className="save-row">
          <span
            className={dirty ? "dirty on mono" : "dirty mono"}
            role="status"
          >
            {status ? (
              <span className={status.kind === "error" ? "err" : "ok-text"}>
                <Msg s={status.message} />
              </span>
            ) : dirty ? (
              <T zh="有未保存的修改" en="Unsaved changes" />
            ) : (
              <T zh="已保存" en="Saved" />
            )}
          </span>
          <div className="row-actions">
            <Link href="/me" className="btn ghost sm">
              <T zh="返回我的卡片" en="Back to my card" />
            </Link>
            <button
              type="button"
              className="btn solid"
              disabled={pending || !dirty}
              onClick={save}
            >
              {pending ? (
                <T zh="保存中…" en="Saving…" />
              ) : (
                <T zh="保存卡片" en="Save card" />
              )}{" "}
              <Arr />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LockIcon({ corner = false }: { corner?: boolean }) {
  return (
    <svg
      className={corner ? "lock corner" : "lock"}
      viewBox="0 0 16 16"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path
        d="M5 7V5a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
