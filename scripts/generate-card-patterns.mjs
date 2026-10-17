// Generates the card studio's line patterns in public/textures/: the topographic
// contours and the puzzle tile. (The guilloche, guilloche.svg, predates this
// script.) Re-run after editing: node scripts/generate-card-patterns.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/textures");

/** Closed curves, `count` of them, each sampled at `pts` points by fn(i, angle). */
function rings(count, pts, fn) {
  let d = "";
  for (let i = 0; i < count; i++) {
    for (let k = 0; k <= pts; k++) {
      const [x, y] = fn(i, (k / pts) * Math.PI * 2);
      d += (k ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    d += "Z";
  }
  return d;
}

const topo = rings(18, 220, (i, t) => {
  const r =
    (i + 1) *
    34 *
    (1 +
      0.14 * Math.sin(3 * t + i * 0.3) +
      0.08 * Math.sin(5 * t + 1.7) +
      0.05 * Math.sin(7 * t - i * 0.2));
  return [570 + r * Math.cos(t), 150 + r * Math.sin(t) * 0.8];
});

writeFileSync(
  join(out, "topo.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 504" preserveAspectRatio="none"><path d="${topo}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.1"/></svg>\n`,
);

writeFileSync(
  join(out, "puzzle.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M0 10H16C17 10 17 8 16 7A4.5 4.5 0 1 1 24 7C23 8 23 10 24 10H40M10 0V16C10 17 8 17 7 16A4.5 4.5 0 1 0 7 24C8 23 10 23 10 24V40" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/></svg>\n`,
);
