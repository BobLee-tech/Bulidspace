// The welcome screen's backdrop, ported from the card-studio prototype. One
// fixed canvas and one rAF loop paint everything behind the page: a puzzle-
// board grid, a particle network tinted to the card's colour, the key words
// assembling from particles, and puzzle-shaped fireworks on both sides.
// Glow comes from cached radial sprites drawn with additive blending, never
// from canvas shadowBlur, so a frame stays cheap even mid-salvo.

const RAMP = ["#ff8fb3", "#ffd23f", "#6fd36a", "#5b9bff", "#a98bff"];
const TAU = Math.PI * 2;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: string, b: string, t: number) => {
  const B = hex(b);
  return (
    "#" +
    hex(a)
      .map((v, i) =>
        Math.round(v + (B[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};
/** A colour along the five mascots, quantised so the sprite cache stays small. */
const ramp = (u: number) => {
  const f = (Math.round(clamp(u, 0, 1) * 24) / 24) * 4;
  const i = Math.min(3, Math.floor(f));
  return mix(RAMP[i], RAMP[i + 1], f - i);
};

// Points along a puzzle-piece outline (unit square, knobs out on top and
// right, sockets on bottom and left): the "puzzle" firework bursts into it.
const PIECE = (() => {
  const out: [number, number][] = [];
  const edge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    sign: number,
  ) => {
    const dx = bx - ax;
    const dy = by - ay;
    const nx = dy * sign;
    const ny = -dx * sign;
    const P = (s: number, v: number) =>
      out.push([ax + dx * s + nx * v, ay + dy * s + ny * v]);
    for (let s = 0; s < 0.42; s += 0.07) P(s, 0);
    for (let a = 228; a >= -48; a -= 23) {
      const r = (a * Math.PI) / 180;
      P(0.5 + Math.cos(r) * 0.12, 0.15 + Math.sin(r) * 0.12);
    }
    for (let s = 0.58; s < 1; s += 0.07) P(s, 0);
  };
  edge(-0.5, -0.5, 0.5, -0.5, 1);
  edge(0.5, -0.5, 0.5, 0.5, 1);
  edge(0.5, 0.5, -0.5, 0.5, -1);
  edge(-0.5, 0.5, -0.5, -0.5, -1);
  return out;
})();

/** One side of a puzzle cell, with its knob bulging towards `dir`. */
function puzzleEdge(
  g: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dir: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * dir;
  const ny = ux * dir;
  const P = (a: number, b: number): [number, number] => [
    x1 + ux * len * a + nx * len * b,
    y1 + uy * len * a + ny * len * b,
  ];
  g.moveTo(x1, y1);
  g.lineTo(...P(0.38, 0));
  g.bezierCurveTo(...P(0.42, 0), ...P(0.4, 0.06), ...P(0.38, 0.085));
  g.bezierCurveTo(...P(0.33, 0.25), ...P(0.67, 0.25), ...P(0.62, 0.085));
  g.bezierCurveTo(...P(0.6, 0.06), ...P(0.58, 0), ...P(0.62, 0));
  g.lineTo(x2, y2);
}

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  s: number;
  c: string;
  p: number;
};
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  life: number;
  max: number;
  size: number;
  drag: number;
  g: number;
  glit: boolean;
  p: number;
};
type Rocket = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  kind: Kind;
  c: string;
};
type Kind = "puzzle" | "peony" | "multi" | "ring";
type GlyphPart = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  cx: number;
  cy: number;
  d: number;
  dur: number;
  c: string;
  p: number;
};
const KINDS: Kind[] = ["puzzle", "puzzle", "peony", "peony", "multi", "ring"];

export type WelcomeFx = ReturnType<typeof createWelcomeFx>;

/**
 * Starts nothing by itself: call start(colour). With reduced motion, start()
 * paints one still frame (grid and particles) and every effect is a no-op.
 */
export function createWelcomeFx(cv: HTMLCanvasElement, reduce: boolean) {
  const ctx = cv.getContext("2d")!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let running = false;
  let destroyed = false;
  let last = 0;
  let clock = 0;
  let raf = 0;
  let onFrame: (() => void) | null = null;
  let main = "#ffd84d";
  let rgb = hex(main);
  let field: Mote[] = [];
  let sparks: Spark[] = [];
  let rockets: Rocket[] = [];
  let flashes: { x: number; y: number; life: number; c: string }[] = [];
  let tasks: { at: number; fn: () => void }[] = [];
  let glyph: {
    start: number;
    reveal: number;
    size: number;
    parts: GlyphPart[];
  } | null = null;
  let ripple: { x: number; y: number; start: number } | null = null;
  let glow: {
    x: number;
    y: number;
    w: number;
    h: number;
    start: number;
  } | null = null;
  let gridBase: HTMLCanvasElement | null = null;
  let gridHot: HTMLCanvasElement | null = null;
  let nextAmbient = Infinity;
  let ambientUntil = 0;
  const mouse = { x: 0, y: 0, on: false };
  const sprites = new Map<string, HTMLCanvasElement>();
  const small = () => W < 700;

  function sprite(c: string) {
    let s = sprites.get(c);
    if (s) return s;
    const [r, g, b] = hex(c);
    s = document.createElement("canvas");
    s.width = s.height = 64;
    const x = s.getContext("2d")!;
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.16, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.42, `rgba(${r},${g},${b},.3)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, 64, 64);
    sprites.set(c, s);
    return s;
  }
  const dot = (c: string, x: number, y: number, s: number) =>
    ctx.drawImage(sprite(c), x - s / 2, y - s / 2, s, s);

  // The grid is drawn once per size into two offscreen canvases: a faint one
  // that is always there, and one in the card's colour that the ripple reveals.
  function buildGrid() {
    const cell = small() ? 64 : 88;
    const make = (color: string, alpha: number, lw: number) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(W * dpr);
      c.height = Math.ceil(H * dpr);
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = lw;
      g.beginPath();
      const ox = ((W / 2) % cell) - cell;
      const oy = ((H * 0.34) % cell) - cell;
      for (let y = oy, j = 0; y < H + cell; y += cell, j++) {
        for (let x = ox, i = 0; x < W + cell; x += cell, i++) {
          puzzleEdge(g, x, y, x + cell, y, (i + j) % 2 ? 1 : -1);
          puzzleEdge(g, x, y, x, y + cell, (i + j) % 2 ? -1 : 1);
        }
      }
      g.stroke();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "destination-in";
      const grd = g.createRadialGradient(
        W / 2,
        H * 0.36,
        0,
        W / 2,
        H * 0.36,
        Math.max(W, H) * 0.72,
      );
      grd.addColorStop(0, "#000");
      grd.addColorStop(0.5, "rgba(0,0,0,.55)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      return c;
    };
    gridBase = make("#ffffff", 0.055, 1);
    gridHot = make(main, 0.75, 1.4);
  }

  function buildField() {
    const n = Math.round(clamp((W * H) / 12500, 34, small() ? 56 : 120));
    field = Array.from({ length: n }, () => {
      const u = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rnd(-0.15, 0.15),
        vy: rnd(-0.15, 0.15),
        z: rnd(0.35, 1),
        s: rnd(6, 14),
        c:
          u < 0.62
            ? main
            : u < 0.86
              ? "#ffffff"
              : RAMP[(Math.random() * 5) | 0],
        p: Math.random() * TAU,
      };
    });
  }

  function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr = Math.min(1.5, devicePixelRatio || 1);
    cv.width = Math.ceil(W * dpr);
    cv.height = Math.ceil(H * dpr);
    buildGrid();
    buildField();
  }
  let resizeT: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      resize();
      if (!running) paint(0, 0);
    }, 160);
  };
  addEventListener("resize", onResize);

  function drawGrid() {
    ctx.globalAlpha = 1;
    if (gridBase) ctx.drawImage(gridBase, 0, 0, W, H);
    if (!ripple || !gridHot) return;
    const t = clock - ripple.start;
    if (t < 0) return;
    if (t > 2.6) {
      ripple = null;
      return;
    }
    const r = (1 - Math.pow(1 - t / 2.6, 3)) * Math.hypot(W, H);
    const band = 110;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, r + band, 0, TAU);
    ctx.arc(ripple.x, ripple.y, Math.max(0, r - band), 0, TAU, true);
    ctx.clip();
    ctx.globalAlpha = 0.55 * (1 - t / 2.6);
    ctx.drawImage(gridHot, 0, 0, W, H);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function stepField(dt: number, now: number) {
    const k = dt * 60;
    const damp = Math.pow(0.96, k);
    for (const q of field) {
      q.vx += Math.sin(q.y * 0.004 + now * 0.00025 + q.p) * 0.004 * k;
      q.vy += Math.cos(q.x * 0.004 - now * 0.0002) * 0.004 * k;
      if (mouse.on) {
        const dx = q.x - mouse.x;
        const dy = q.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 22500) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / 150) * 0.32 * k;
          q.vx += (dx / d) * f;
          q.vy += (dy / d) * f;
        }
      }
      q.vx *= damp;
      q.vy *= damp;
      q.x += q.vx * k * q.z;
      q.y += q.vy * k * q.z;
      if (q.x < -20) q.x = W + 20;
      else if (q.x > W + 20) q.x = -20;
      if (q.y < -20) q.y = H + 20;
      else if (q.y > H + 20) q.y = -20;
    }
    // The network: links batched into three alpha buckets, one stroke each.
    const maxD = small() ? 92 : 124;
    const max2 = maxD * maxD;
    const B: Mote[][] = [[], [], []];
    for (let i = 0; i < field.length; i++) {
      const a = field[i];
      for (let j = i + 1; j < field.length; j++) {
        const b = field[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < max2) {
          const s = 1 - Math.sqrt(d2) / maxD;
          B[s > 0.66 ? 2 : s > 0.33 ? 1 : 0].push(a, b);
        }
      }
    }
    ctx.lineWidth = 1;
    const [r, g, b] = rgb;
    B.forEach((arr, bi) => {
      if (!arr.length) return;
      ctx.strokeStyle = `rgba(${r},${g},${b},${[0.05, 0.1, 0.18][bi]})`;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 2) {
        ctx.moveTo(arr[i].x, arr[i].y);
        ctx.lineTo(arr[i + 1].x, arr[i + 1].y);
      }
      ctx.stroke();
    });
    if (mouse.on) {
      ctx.strokeStyle = `rgba(${r},${g},${b},.24)`;
      ctx.beginPath();
      for (const q of field) {
        const dx = q.x - mouse.x;
        const dy = q.y - mouse.y;
        if (dx * dx + dy * dy < 32400) {
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
    for (const q of field) {
      ctx.globalAlpha =
        (0.3 + 0.7 * q.z) * (0.6 + 0.4 * Math.sin(now * 0.0018 + q.p));
      dot(q.c, q.x, q.y, q.s * q.z);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow() {
    if (!glow) return;
    ctx.globalAlpha = clamp((clock - glow.start) / 0.9, 0, 1) * 0.16;
    ctx.drawImage(
      sprite(main),
      glow.x - glow.w / 2,
      glow.y - scrollY - glow.h / 2,
      glow.w,
      glow.h,
    );
    ctx.globalAlpha = 1;
  }

  function drawGlyph() {
    if (!glyph) return;
    const t = clock - glyph.start;
    if (t < 0) return;
    let fade = 1;
    if (glyph.reveal) {
      fade = 1 - (clock - glyph.reveal) / 0.6;
      if (fade <= 0) {
        glyph = null;
        return;
      }
    }
    const sy = scrollY;
    for (const q of glyph.parts) {
      const p = clamp((t - q.d) / q.dur, 0, 1);
      if (p <= 0) continue;
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const ie = 1 - e;
      const x = ie * ie * q.sx + 2 * ie * e * q.cx + e * e * q.tx;
      const y = ie * ie * q.sy + 2 * ie * e * q.cy + e * e * q.ty - sy;
      const s =
        glyph.size *
        (p < 1 ? 1.5 - 0.5 * e : 1 + 0.12 * Math.sin(clock * 6 + q.p));
      ctx.globalAlpha = Math.min(1, p * 4) * fade * (p < 1 ? 0.95 : 0.8);
      dot(q.c, x, y, s);
    }
    ctx.globalAlpha = 1;
  }

  function explode(x: number, y: number, kind: Kind, color: string) {
    if (sparks.length > (small() ? 520 : 1100)) return;
    const sf = clamp(W / 1400, 0.65, 1.1);
    const add = (
      vx: number,
      vy: number,
      c: string,
      life: number,
      size: number,
      o: { drag?: number; g?: number; glit?: boolean } = {},
    ) =>
      sparks.push({
        x,
        y,
        vx,
        vy,
        c,
        life,
        max: life,
        size,
        drag: o.drag ?? 0.975,
        g: o.g ?? 0.045,
        glit: !!o.glit,
        p: Math.random() * TAU,
      });
    if (kind === "puzzle") {
      const R = 5.4 * sf;
      const rot = rnd(-0.5, 0.5);
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      const pts = small() ? PIECE.filter((_, i) => i % 2) : PIECE;
      for (const [ux, uy] of pts) {
        add(
          (ux * cr - uy * sr) * R,
          (ux * sr + uy * cr) * R,
          color,
          rnd(1.6, 1.9),
          rnd(10, 13),
          {
            drag: 0.982,
            g: 0.022,
          },
        );
      }
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * TAU;
        const v = rnd(0.2, 1.4) * sf;
        add(Math.cos(a) * v, Math.sin(a) * v, "#ffffff", rnd(0.8, 1.3), 7, {
          glit: true,
          g: 0.02,
        });
      }
    } else if (kind === "ring") {
      const n = small() ? 36 : 54;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const v = 3.6 * sf;
        add(Math.cos(a) * v, Math.sin(a) * v, color, rnd(1.3, 1.7), 11, {
          drag: 0.978,
          g: 0.03,
        });
      }
    } else {
      const n = small() ? 48 : 80;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.06, 0.06);
        const v = rnd(1.2, 4.4) * sf;
        const c =
          kind === "multi"
            ? RAMP[i % 5]
            : Math.random() < 0.18
              ? "#ffffff"
              : color;
        add(Math.cos(a) * v, Math.sin(a) * v, c, rnd(1.2, 2.0), rnd(9, 13), {
          glit: Math.random() < 0.3,
        });
      }
    }
    flashes.push({ x, y, life: 0.45, c: color });
  }

  function launch(
    side: number,
    kind?: Kind,
    color?: string,
    tx?: number,
    ty?: number,
  ) {
    const x0 = side < 0 ? W * rnd(0.04, 0.16) : W * rnd(0.84, 0.96);
    rockets.push({
      sx: x0,
      sy: H + 20,
      tx: tx ?? (side < 0 ? W * rnd(0.08, 0.26) : W * rnd(0.74, 0.92)),
      ty: ty ?? H * rnd(0.12, 0.34),
      t: 0,
      dur: rnd(0.85, 1.1),
      kind: kind ?? KINDS[(Math.random() * KINDS.length) | 0],
      c: color ?? (Math.random() < 0.5 ? main : ramp(Math.random())),
    });
  }

  function drawRockets(dt: number) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt;
      const p = Math.min(1, r.t / r.dur);
      const e = 1 - Math.pow(1 - p, 3);
      for (let j = 0; j < 7; j++) {
        const pp = Math.max(0, e - j * 0.022);
        ctx.globalAlpha = (1 - j / 7) * 0.8;
        dot(
          j ? r.c : "#ffffff",
          r.sx + (r.tx - r.sx) * pp,
          r.sy + (r.ty - r.sy) * pp,
          11 - j,
        );
      }
      if (p >= 1) {
        explode(r.tx, r.ty, r.kind, r.c);
        rockets.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSparks(dt: number) {
    const k = dt * 60;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const q = sparks[i];
      const dr = Math.pow(q.drag, k);
      q.vx *= dr;
      q.vy = q.vy * dr + q.g * k;
      q.x += q.vx * k;
      q.y += q.vy * k;
      q.life -= dt;
      if (q.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        continue;
      }
      const lf = q.life / q.max;
      let a = Math.min(1, lf * 1.7);
      if (q.glit) a *= 0.45 + 0.55 * Math.abs(Math.sin(q.p + q.life * 22));
      const s = q.size * (0.55 + lf * 0.6);
      ctx.globalAlpha = a * 0.35;
      dot(q.c, q.x - q.vx * 2.2, q.y - q.vy * 2.2, s * 0.8);
      ctx.globalAlpha = a;
      dot(q.c, q.x, q.y, s);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        flashes.splice(i, 1);
        continue;
      }
      const u = f.life / 0.45;
      ctx.globalAlpha = u * 0.5;
      dot(f.c, f.x, f.y, 240 * Math.sqrt(1 - u * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  function paint(dt: number, now: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    stepField(dt, now);
    ctx.globalCompositeOperation = "lighter";
    drawGlow();
    drawGlyph();
    drawRockets(dt);
    drawSparks(dt);
  }

  function frame(now: number) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (clock >= tasks[i].at) {
        const { fn } = tasks[i];
        tasks.splice(i, 1);
        fn();
      }
    }
    if (clock >= nextAmbient) {
      if (clock < ambientUntil) {
        launch(Math.random() < 0.5 ? -1 : 1);
        nextAmbient = clock + rnd(2.6, 4.4);
      } else nextAmbient = Infinity;
    }
    paint(dt, now);
    onFrame?.();
    raf = requestAnimationFrame(frame);
  }
  let started = false;
  const run = () => {
    if (running || reduce || destroyed || !started) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);

  const center = (el: Element) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      w: r.width,
      h: r.height,
    };
  };

  return {
    /** Runs once per animation frame, after the canvas is painted. */
    set onFrame(fn: (() => void) | null) {
      onFrame = fn;
    },
    start(color: string) {
      main = color;
      rgb = hex(color);
      sparks = [];
      rockets = [];
      flashes = [];
      tasks = [];
      glyph = ripple = glow = null;
      clock = 0;
      nextAmbient = Infinity;
      ambientUntil = 0;
      started = true;
      resize();
      if (reduce) {
        paint(0, 0);
        return;
      }
      halt();
      run();
    },
    destroy() {
      destroyed = true;
      halt();
      clearTimeout(resizeT);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    },
    /** Run `fn` `sec` seconds from now on the canvas clock (pauses with the tab). */
    at(sec: number, fn: () => void) {
      tasks.push({ at: clock + sec, fn });
    },
    /**
     * Samples the element's own text into points; particles fly in from all
     * over and settle into the glyphs. Returns how long that takes.
     */
    formText(el: HTMLElement, delay: number) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const w = Math.ceil(r.width);
      const h = Math.ceil(r.height);
      const fs = parseFloat(cs.fontSize);
      if (!w || !h) return 0;
      const oc = document.createElement("canvas");
      oc.width = w;
      oc.height = h;
      const g = oc.getContext("2d", { willReadFrequently: true })!;
      g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#fff";
      g.fillText(el.textContent ?? "", w / 2, h / 2 + fs * 0.03);
      const data = g.getImageData(0, 0, w, h).data;
      const step = Math.max(3, Math.round(fs / 24));
      let pts: [number, number][] = [];
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if (data[(y * w + x) * 4 + 3] > 140) pts.push([x, y]);
        }
      }
      const cap = small() ? 560 : 1100;
      if (pts.length > cap) {
        for (let i = pts.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [pts[i], pts[j]] = [pts[j], pts[i]];
        }
        pts = pts.slice(0, cap);
      }
      if (!pts.length) return 0;
      const sy = scrollY;
      glyph = {
        start: clock + delay,
        reveal: 0,
        size: step * 2.7,
        parts: pts.map(([x, y]) => {
          const u = x / w;
          const edge = Math.random() < 0.45;
          const side = Math.random() < 0.5 ? -1 : 1;
          const sx = edge ? (side < 0 ? -30 : W + 30) : Math.random() * W;
          const sY = (edge ? rnd(0.1, 0.9) : Math.random()) * H + sy;
          const tx = r.left + x;
          const ty = r.top + sy + y;
          return {
            sx,
            sy: sY,
            tx,
            ty,
            cx: (sx + tx) / 2 + rnd(-180, 180),
            cy: (sY + ty) / 2 + rnd(-220, 120),
            d: u * 0.5 + Math.random() * 0.28,
            dur: rnd(0.9, 1.3),
            c: ramp(u),
            p: Math.random() * TAU,
          };
        }),
      };
      return Math.max(...glyph.parts.map((q) => q.d + q.dur));
    },
    /** The real words are lit: fade the particle copy out. */
    reveal() {
      if (glyph) glyph.reveal = clock;
    },
    ripple(el: Element) {
      const c = center(el);
      ripple = { x: c.x, y: c.y, start: clock };
    },
    glow(el: Element) {
      const c = center(el);
      glow = {
        x: c.x,
        y: c.y + scrollY,
        w: c.w * 1.5,
        h: c.h * 2.6,
        start: clock,
      };
    },
    /** The opening salvo, then a firework every few seconds for half a minute. */
    salvo() {
      const at = (s: number, fn: () => void) =>
        tasks.push({ at: clock + s, fn });
      at(0, () => {
        launch(-1, "puzzle", main);
        launch(1, "puzzle", main);
      });
      at(0.45, () => launch(-1, "multi"));
      at(0.7, () => launch(1, "peony", ramp(Math.random())));
      at(1.1, () => {
        launch(-1, "ring", "#ffffff");
        launch(1, "ring", "#ffffff");
      });
      at(1.6, () => launch(1, "puzzle", ramp(Math.random())));
      at(1.9, () => launch(-1, "peony", main));
      nextAmbient = clock + 3.8;
      ambientUntil = clock + 30;
    },
    /** A firework towards a point the visitor clicked. */
    launchTo(x: number, y: number) {
      if (!reduce)
        launch(
          x < W / 2 ? -1 : 1,
          undefined,
          undefined,
          x,
          Math.min(y, H * 0.8),
        );
    },
    burst(x: number, y: number, color: string, n = 22, speed = 2.2, life = 1) {
      if (reduce) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const v = rnd(0.3, 1) * speed;
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - speed * 0.3,
          c: Math.random() < 0.3 ? "#ffffff" : color,
          life: rnd(0.6, 1) * life,
          max: life,
          size: rnd(6, 9),
          drag: 0.95,
          g: 0.04,
          glit: true,
          p: Math.random() * TAU,
        });
      }
    },
    pointer(x: number, y: number) {
      mouse.x = x;
      mouse.y = y;
      mouse.on = true;
    },
    leave() {
      mouse.on = false;
    },
  };
}
