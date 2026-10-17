// Generates the five Spark mascots (Vivi, Lumi, Geo, Momo, Kiko) as standalone SVGs
// in public/mascots/. Source of truth for the shapes and colours; re-run after
// editing, then optimise:
//   node scripts/generate-mascots.mjs && pnpm dlx svgo@3.3.2 -rf public/mascots --multipass
// Each file is self-contained (ids are prefixed with the mascot name), keeps the
// `look` / `blink` groups so pages can animate the eyes when inlined, and draws a
// soft-vinyl look: dark outline, body lit from the top left, occlusion at the feet,
// bounce light on the right and glossy highlights.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAL = {
  vivi: ["#ffe3ee", "#ff9dc1", "#f0699d", "#b8386c"],
  lumi: ["#fff7cf", "#ffd84d", "#efb21c", "#a87300"],
  geo: ["#dde9ff", "#6ba6ff", "#3c77ea", "#1d48ad"],
  momo: ["#e2fbdb", "#80dc78", "#44b33e", "#227f29"],
  kiko: ["#f0e8ff", "#b59bff", "#8966ef", "#5838bd"],
};
const INK = "#26192c";
const BODY = `<rect x="29" y="38" width="62" height="62" rx="20"/><circle cx="60" cy="34" r="14.5"/><circle cx="26" cy="68" r="14.5"/><circle cx="94" cy="68" r="14.5"/><ellipse cx="46" cy="102" rx="10.5" ry="6.5"/><ellipse cx="74" cy="102" rx="10.5" ry="6.5"/>`;
const ACC_DEFS = {
  vivi: `<radialGradient id="__lens" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".5" stop-color="#d6ecff" stop-opacity=".7"/><stop offset="1" stop-color="#8fc0ff" stop-opacity=".55"/></radialGradient><linearGradient id="__wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c08a68"/><stop offset="1" stop-color="#6e4532"/></linearGradient>`,
  lumi: `<radialGradient id="__glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6b0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffd84d" stop-opacity=".35"/><stop offset="1" stop-color="#ffd84d" stop-opacity="0"/></radialGradient><radialGradient id="__bulb" cx=".42" cy=".36" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fff6c2"/><stop offset="1" stop-color="#ffcf2e"/></radialGradient>`,
  geo: `<linearGradient id="__alu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f8fb"/><stop offset=".5" stop-color="#bcc4d2"/><stop offset=".7" stop-color="#e2e6ed"/><stop offset="1" stop-color="#8b95a7"/></linearGradient>`,
  momo: `<linearGradient id="__cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ea4ff"/><stop offset=".55" stop-color="#3f6fe8"/><stop offset="1" stop-color="#2a4fbd"/></linearGradient><linearGradient id="__brim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c64da"/><stop offset="1" stop-color="#203d98"/></linearGradient>`,
  kiko: `<radialGradient id="__yel" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff3ad"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#e3a300"/></radialGradient><radialGradient id="__heart" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#ffc6db"/><stop offset=".55" stop-color="#ff74a3"/><stop offset="1" stop-color="#e03f7a"/></radialGradient>`,
};
function mascotSVG(id) {
  const [l, b, d, dd] = PAL[id];
  const outline = (shapes, w) =>
    `<g fill="${dd}" stroke="${dd}" stroke-width="${w}" stroke-linejoin="round">${shapes}</g>`;
  const nub = (cx, cy, rot = 0) => {
    const e = `<ellipse cx="${cx}" cy="${cy}" rx="7" ry="5.8" transform="rotate(${rot} ${cx} ${cy})"/>`;
    return (
      outline(e, 2.6) +
      `<g fill="url(#__b)">${e}</g><ellipse cx="${cx - 2}" cy="${cy - 2.2}" rx="2.6" ry="1.4" transform="rotate(${rot - 20} ${cx - 2} ${cy - 2.2})" fill="#fff" opacity=".5"/>`
    );
  };
  const eye = (x, y = 67) =>
    `<ellipse cx="${x}" cy="${y}" rx="5.3" ry="6.9" fill="url(#__eye)"/><circle cx="${x + 1.9}" cy="${y - 2.9}" r="2.2" fill="#fff"/><circle cx="${x - 1.8}" cy="${y + 2.9}" r="1" fill="#fff" opacity=".75"/>`;
  const shut = (x, y = 68) =>
    `<path d="M${x - 5.2} ${y}q5.2-6 10.4 0" fill="none" stroke="${INK}" stroke-width="2.7" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="38.5" cy="78" rx="7.5" ry="4.4" fill="url(#__bl)"/><ellipse cx="81.5" cy="78" rx="7.5" ry="4.4" fill="url(#__bl)"/>`;
  const mouth = {
    smile: `<path d="M55.5 77.5q4.5 4.4 9 0" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`,
    grin: `<path d="M53.4 76.4h13.2q-.8 8-6.6 8t-6.6-8z" fill="#5b2133"/><path d="M56.4 81.6q3.6-2.4 7.2 0q-1.4 2.8-3.6 2.8t-3.6-2.8z" fill="#ff7b95"/>`,
    ooh: `<ellipse cx="60" cy="79.5" rx="3.3" ry="3.9" fill="#5b2133"/><ellipse cx="60" cy="81.2" rx="2" ry="1.5" fill="#ff7b95"/>`,
    calm: `<path d="M56.5 79.2q3.5 2.2 7 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  };
  const face = (eyes, m) =>
    `<g class="look"><g class="blink">${eyes}</g></g>${blush}${mouth[m]}`;
  const MINI = `<rect x="51" y="88" width="18" height="15" rx="4"/><circle cx="60" cy="87" r="4.6"/><circle cx="70" cy="95.5" r="4.6"/>`;
  const parts = {
    vivi: {
      back: "",
      face: face(eye(49) + eye(71), "ooh"),
      front: `
      <path d="M14 21l2.2 5.4 5.4 2.2-5.4 2.2L14 36.2l-2.2-5.4-5.4-2.2 5.4-2.2z" fill="#ffd84d" stroke="#c99400" stroke-width="1" stroke-linejoin="round"/>
      <g transform="rotate(-24 101 92)"><rect x="97.6" y="95" width="7.2" height="19" rx="3.6" fill="url(#__wood)" stroke="#4b2e21" stroke-width="1.5"/>
      <circle cx="101.2" cy="83" r="13" fill="url(#__lens)" stroke="#4b2e21" stroke-width="6.2"/><circle cx="101.2" cy="83" r="13" fill="none" stroke="url(#__m)" stroke-width="3.6"/>
      <path d="M93.5 79q2.6-6.2 9.4-6.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/></g>${nub(92, 96, -20)}`,
    },
    lumi: {
      back: `<circle cx="100" cy="22" r="19" fill="url(#__glow)"/>`,
      face: face(eye(49) + shut(71), "grin"),
      front: `
      <g stroke="#ffcf3f" stroke-width="2.6" stroke-linecap="round"><path d="M100 1v4.5"/><path d="M86 7l3 3"/><path d="M114 7l-3 3"/></g>
      <path d="M100 10.5a9.6 9.6 0 0 1 6.2 16.9q-1.5 1.4-1.7 3.8h-9q-.2-2.4-1.7-3.8A9.6 9.6 0 0 1 100 10.5z" fill="url(#__bulb)" stroke="#9b7410" stroke-width="1.5"/>
      <path d="M97 24.5l1.5-3 1.5 3 1.5-3 1.5 3" stroke="#e08a00" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
      <rect x="95.4" y="31" width="9.2" height="7" rx="2" fill="url(#__m)" stroke="#5e6672" stroke-width="1.2"/><path d="M95.8 33.4h8.4M95.8 35.8h8.4" stroke="#5e6672" stroke-width=".9"/>
      <ellipse cx="96.6" cy="15.6" rx="2.4" ry="1.4" transform="rotate(-35 96.6 15.6)" fill="#fff"/>${nub(102, 47, -55)}`,
    },
    geo: {
      back: "",
      face: face(eye(49) + eye(71), "calm"),
      front: `
      <g fill="#fff" fill-opacity=".16" stroke="#1b2848" stroke-width="2.3"><circle cx="49" cy="67" r="9.4"/><circle cx="71" cy="67" r="9.4"/></g>
      <path d="M58.4 65.8q1.6-2 3.2 0" stroke="#1b2848" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M43.5 62.5l3.5-2.8M65.5 62.5l3.5-2.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>
      <g transform="rotate(-9 97 95)"><rect x="80" y="80" width="34" height="23" rx="3.2" fill="url(#__alu)" stroke="#34405a" stroke-width="1.6"/>
      <g fill="#6ba6ff"><rect x="93.2" y="88.6" width="7.6" height="6.8" rx="1.6"/><circle cx="97" cy="88.4" r="2"/><circle cx="101" cy="92" r="2"/></g>
      <path d="M82 82.4h30" stroke="#fff" stroke-width="1.2" opacity=".7"/>
      <path d="M76.5 103h41l-3.4 4.6H79.9z" fill="url(#__alu)" stroke="#34405a" stroke-width="1.6" stroke-linejoin="round"/></g>${nub(84, 99, 10)}`,
    },
    momo: {
      back: "",
      face: face(eye(49) + eye(71), "smile"),
      front: `
      <path d="M32.5 45C32.5 7 87.5 7 87.5 45Z" fill="url(#__cap)" stroke="#172f72" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M60 17V45M46.5 20.5q-4.2 10.5-4.2 24.5M73.5 20.5q4.2 10.5 4.2 24.5" stroke="#1f3f95" stroke-width="1" fill="none" opacity=".6"/>
      <path d="M60 44C79 40.5 99.5 42 106.5 49.5C92.5 52.2 75.5 51.2 60 48.5Z" fill="url(#__brim)" stroke="#172f72" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="60" cy="17" r="2.7" fill="#172f72"/><path d="M40 31q7-11 19.5-12" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".4"/>
      <g transform="rotate(30 104 90)"><path d="M100.8 82h6.4v24.5a3.2 3.2 0 0 1-6.4 0z" fill="url(#__m)" stroke="#4f5661" stroke-width="1.4"/>
      <path d="M96.4 71a9 9 0 1 0 15.2 0l-3.7 3.5h-7.8z" fill="url(#__m)" stroke="#4f5661" stroke-width="1.4" stroke-linejoin="round"/></g>${nub(95, 96, -15)}`,
    },
    kiko: {
      back: "",
      face: face(shut(49) + shut(71), "smile"),
      front: `
      <path d="M101 43C88 34 90 20.5 101 27C112 20.5 114 34 101 43Z" fill="url(#__heart)" stroke="#b8326a" stroke-width="1.4" stroke-linejoin="round"/>
      <ellipse cx="96" cy="27.6" rx="2.6" ry="1.6" transform="rotate(-30 96 27.6)" fill="#fff" opacity=".85"/>
      <g fill="#b98500" stroke="#b98500" stroke-width="2.4" stroke-linejoin="round">${MINI}</g><g fill="url(#__yel)">${MINI}</g>
      <ellipse cx="55.6" cy="91.4" rx="2.6" ry="1.5" fill="#fff" opacity=".8"/>${nub(49, 97, 20)}${nub(72, 99, -20)}`,
    },
  }[id];
  return `<svg class="art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 116" aria-hidden="true"><defs>
    <radialGradient id="__b" gradientUnits="userSpaceOnUse" cx="44" cy="40" r="84"><stop offset="0" stop-color="${l}"/><stop offset=".36" stop-color="${b}"/><stop offset=".78" stop-color="${d}"/><stop offset="1" stop-color="${dd}"/></radialGradient>
    <linearGradient id="__ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dd}" stop-opacity="0"/><stop offset="1" stop-color="${dd}" stop-opacity=".5"/></linearGradient>
    <radialGradient id="__rim" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${l}" stop-opacity=".6"/><stop offset="1" stop-color="${l}" stop-opacity="0"/></radialGradient>
    <radialGradient id="__hl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".6" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="__bl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5f8f" stop-opacity=".5"/><stop offset="1" stop-color="#ff5f8f" stop-opacity="0"/></radialGradient>
    <linearGradient id="__eye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1324"/><stop offset="1" stop-color="#4a3557"/></linearGradient>
    <linearGradient id="__m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a7afbb"/><stop offset=".6" stop-color="#eef1f5"/><stop offset="1" stop-color="#6b7380"/></linearGradient>
    <clipPath id="__clip">${BODY}</clipPath>${ACC_DEFS[id]}</defs>
    ${parts.back}${outline(BODY, 3.4)}<g fill="url(#__b)">${BODY}</g>
    <g clip-path="url(#__clip)"><rect x="0" y="60" width="120" height="56" fill="url(#__ao)"/><ellipse cx="99" cy="90" rx="24" ry="20" fill="url(#__rim)"/><ellipse cx="46" cy="45" rx="22" ry="12" transform="rotate(-24 46 45)" fill="url(#__hl)"/></g>
    <ellipse cx="39" cy="41" rx="4.2" ry="2.4" transform="rotate(-32 39 41)" fill="#fff" opacity=".85"/><ellipse cx="55" cy="25.5" rx="4.4" ry="2.1" transform="rotate(-18 55 25.5)" fill="#fff" opacity=".55"/>
    ${parts.face}${parts.front}</svg>`;
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "mascots",
);
mkdirSync(out, { recursive: true });
for (const id of Object.keys(PAL)) {
  const svg = mascotSVG(id)
    .replaceAll("__", `${id}-`)
    .replace(' class="art"', "")
    .replace(' aria-hidden="true"', "")
    .replace(/\n\s*/g, "");
  writeFileSync(join(out, `${id}.svg`), svg + "\n");
  console.log(`public/mascots/${id}.svg`);
}
