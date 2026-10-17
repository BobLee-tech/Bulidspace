// Sticker art for the member card, ported from the card-studio prototype.
// The five sparks reuse public/mascots/*.svg and the logo is the site mark;
// the rest are small inline SVGs. Gradient ids are written as `__x` and
// prefixed per sticker on the card (see stickerSvg) so two copies never clash.
import type { Bi } from "@/components/t";
import type { StickerId } from "./card-design";
import { SPARK_INFO, SPARKS } from "./members";

type Art = {
  label: Bi;
  /** Size the sticker starts at when added (1 = 22% of the card's width). */
  s0: number;
  /** Width / height. */
  ar: number;
} & ({ img: string } | { vb: string; body: string });

// Page fonts reach inline SVG through CSS variables; next/font renames the
// families, so a plain font-family="Unbounded" would never match.
const UNB = `style="font-family:var(--f-display);font-weight:800"`;
const MON = `style="font-family:var(--f-mono)"`;
const SILVER = `<linearGradient id="__s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#a2a2a8"/><stop offset=".6" stop-color="#f4f4f2"/><stop offset="1" stop-color="#bcbcc1"/></linearGradient>`;

const HEART = [
  ".XX...XX.",
  "XXXX.XXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "...XXX...",
  "....X....",
];
const heartRects = HEART.flatMap((row, r) =>
  [...row].map((ch, c) =>
    ch === "X"
      ? `<rect x="${c * 10 + 5}" y="${r * 10 + 5}" width="10.4" height="10.4" fill="${r === 1 && c === 1 ? "#ffffff" : r >= 5 ? "#d9304f" : "#ff4d6d"}"/>`
      : "",
  ),
).join("");

const svg = (vb: string, body: string) => {
  const [, , w, h] = vb.split(" ").map(Number);
  return { vb, body, ar: w / h };
};

export const STICKER_ART: Record<StickerId, Art> = {
  logo: {
    label: { zh: "Logo 双块", en: "Logo" },
    img: "/mark-240.webp",
    ar: 240 / 154,
    s0: 1.1,
  },
  ...(Object.fromEntries(
    SPARKS.map((s) => [
      `spark-${s}`,
      {
        label: {
          zh: `${SPARK_INFO[s].name} · ${SPARK_INFO[s].role.zh}`,
          en: `${SPARK_INFO[s].name} · ${SPARK_INFO[s].role.en}`,
        },
        img: `/mascots/${s}.svg`,
        ar: 120 / 116,
        s0: 0.95,
      },
    ]),
  ) as Record<`spark-${(typeof SPARKS)[number]}`, Art>),
  sparkle: {
    label: { zh: "闪光", en: "Sparkle" },
    s0: 0.4,
    ...svg(
      "0 0 100 100",
      `<defs><linearGradient id="__g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#dcdce0"/><stop offset="1" stop-color="#9a9aa0"/></linearGradient></defs><path d="M50 4C53 34 66 47 96 50C66 53 53 66 50 96C47 66 34 53 4 50C34 47 47 34 50 4Z" fill="url(#__g)"/>`,
    ),
  },
  bolt: {
    label: { zh: "闪电", en: "Bolt" },
    s0: 0.45,
    ...svg(
      "0 0 100 100",
      `<path d="M60 4L16 58H45L36 96L84 38H55Z" fill="#ffd23f" stroke="#111" stroke-width="4" stroke-linejoin="round"/>`,
    ),
  },
  code: {
    label: { zh: "代码", en: "Code" },
    s0: 0.6,
    ...svg(
      "0 14 100 72",
      `<rect x="4" y="18" width="92" height="64" rx="14" fill="#0c0c0e" stroke="#f4f4f2" stroke-width="2.5"/><path d="M36 36L22 50L36 64M64 36L78 50L64 64" fill="none" stroke="#f4f4f2" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M56 30L44 70" stroke="#5b9bff" stroke-width="6.5" stroke-linecap="round"/>`,
    ),
  },
  heart: {
    label: { zh: "像素心", en: "Pixel heart" },
    s0: 0.5,
    ...svg("0 0 100 90", heartRects),
  },
  shipit: {
    label: { zh: "Ship it 胶带", en: "Ship-it tape" },
    s0: 0.95,
    ...svg(
      "0 0 180 56",
      `<defs><pattern id="__p" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="10" fill="#050505"/></pattern></defs><path d="M6 8L174 4L176 50L4 52Z" fill="#ffd23f"/><path d="M6 8L28 7.4L27 51.7L4 52Z" fill="url(#__p)"/><path d="M152 4.6L174 4L176 50L153 50.6Z" fill="url(#__p)"/><text x="90" y="35" text-anchor="middle" ${UNB} font-size="16" fill="#050505" letter-spacing="-.3">SHIP IT</text>`,
    ),
  },
  e404: {
    label: { zh: "404", en: "404" },
    s0: 0.65,
    ...svg(
      "0 0 120 84",
      `<defs>${SILVER}</defs><rect x="3" y="3" width="114" height="78" rx="12" fill="#0c0c0e" stroke="#3a3a3d" stroke-width="2"/><text x="60" y="50" text-anchor="middle" ${UNB} font-size="34" fill="url(#__s)" letter-spacing="-1.5">404</text><text x="60" y="68" text-anchor="middle" ${MON} font-size="7.6" fill="#8a8a90" letter-spacing="1.6">SLEEP NOT FOUND</text>`,
    ),
  },
  "campus-stamp": {
    label: { zh: "悉尼邮戳", en: "Sydney postmark" },
    s0: 0.6,
    ...svg(
      "0 0 100 100",
      `<defs><path id="__c" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/></defs><circle cx="50" cy="50" r="47" fill="#050505" stroke="#f4f4f2" stroke-width="2"/><circle cx="50" cy="50" r="27" fill="none" stroke="#f4f4f2" stroke-width="1" stroke-dasharray="1.5 2"/><text ${MON} font-size="8.4" letter-spacing="2.2" fill="#f4f4f2"><textPath href="#__c">SYDNEY · UNSW · BUILDERSPACE ·</textPath></text><text x="50" y="57" text-anchor="middle" ${UNB} font-size="19" fill="#f4f4f2">T3</text>`,
    ),
  },
  "campus-ticket": {
    label: { zh: "学期票根", en: "Term ticket" },
    s0: 0.75,
    ...svg(
      "0 0 150 70",
      `<path d="M8 6H142A6 6 0 0 1 148 12V26A9 9 0 0 0 148 44V58A6 6 0 0 1 142 64H8A6 6 0 0 1 2 58V44A9 9 0 0 0 2 26V12A6 6 0 0 1 8 6Z" fill="#f4f4f2"/><line x1="110" y1="12" x2="110" y2="58" stroke="#050505" stroke-width="1.4" stroke-dasharray="3 3"/><text x="56" y="36" text-anchor="middle" ${UNB} font-size="15" fill="#050505" letter-spacing="-.4">T3 · 2026</text><text x="56" y="50" text-anchor="middle" ${MON} font-size="6.4" fill="#050505" letter-spacing="1.4">ADMIT ONE BUILDER</text><text x="130" y="39" text-anchor="middle" ${UNB} font-size="9" fill="#a98bff">№</text>`,
    ),
  },
  "campus-coffee": {
    label: { zh: "Flat white", en: "Flat white" },
    s0: 0.48,
    ...svg(
      "0 0 90 112",
      `<path d="M30 6q-6 6 0 12t0 12M46 4q-6 6 0 12t0 12" stroke="#c4c4c9" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M20 38H70L64 106H26Z" fill="#f4f4f2" stroke="#050505" stroke-width="2.5" stroke-linejoin="round"/><path d="M22.6 60H67.4L65.6 82H24.4Z" fill="#c8894f"/><text x="45" y="74" text-anchor="middle" ${MON} font-size="7" fill="#fff" letter-spacing="1">FLAT WHITE</text><path d="M16 30H74V38H16Z" fill="#2a2a2e"/><path d="M24 24H66L70 30H20Z" fill="#3a3a3d"/>`,
    ),
  },
  "campus-ibis": {
    label: { zh: "垃圾桶鸡", en: "Bin chicken" },
    s0: 0.7,
    ...svg(
      "0 0 120 104",
      `<path d="M54 76L50 98M66 76L68 98" stroke="#1a1a1c" stroke-width="3.2" stroke-linecap="round"/><ellipse cx="62" cy="56" rx="34" ry="22" fill="#f4f4f2" stroke="#050505" stroke-width="2.5"/><path d="M90 50q20 4 26 16q-14 0-26-6z" fill="#2a2a2e"/><path d="M38 50C30 42 26 32 28 22" stroke="#1a1a1c" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="28" cy="20" r="7.5" fill="#1a1a1c"/><path d="M23 22C11 30 7 44 9 58" stroke="#1a1a1c" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="30" cy="18" r="1.4" fill="#fff"/>`,
    ),
  },
  "campus-bridge": {
    label: { zh: "港湾大桥", en: "Harbour Bridge" },
    s0: 0.8,
    ...svg(
      "0 0 140 84",
      `<defs><linearGradient id="__g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d4a"/><stop offset="1" stop-color="#ff8fb3"/></linearGradient><clipPath id="__k"><rect x="2" y="2" width="136" height="80" rx="12"/></clipPath></defs><g clip-path="url(#__k)"><rect x="0" y="0" width="140" height="84" fill="url(#__g)"/><circle cx="70" cy="58" r="22" fill="#ffd23f"/><rect x="0" y="62" width="140" height="22" fill="#14102a"/><path d="M14 62Q70 10 126 62" stroke="#050505" stroke-width="6" fill="none"/><path d="M0 58H140" stroke="#050505" stroke-width="4"/><g stroke="#050505" stroke-width="2"><line x1="38" y1="36" x2="38" y2="58"/><line x1="54" y1="28" x2="54" y2="58"/><line x1="70" y1="25" x2="70" y2="58"/><line x1="86" y1="28" x2="86" y2="58"/><line x1="102" y1="36" x2="102" y2="58"/></g><rect x="8" y="42" width="12" height="20" fill="#050505"/><rect x="120" y="42" width="12" height="20" fill="#050505"/><path d="M10 72h30M60 76h24M98 71h26" stroke="#6fa8ff" stroke-width="2" stroke-linecap="round" opacity=".6"/></g>`,
    ),
  },
  "campus-library": {
    label: { zh: "图书馆通宵", en: "Library all-nighter" },
    s0: 0.7,
    ...svg(
      "0 0 124 70",
      `<path fill-rule="evenodd" d="M24 6H116A6 6 0 0 1 122 12V58A6 6 0 0 1 116 64H24L4 35ZM20 30A5 5 0 1 0 20 40A5 5 0 1 0 20 30Z" fill="#5b9bff"/><text x="72" y="30" text-anchor="middle" ${MON} font-size="8.5" fill="#0b1630" letter-spacing="2">LIBRARY</text><text x="72" y="52" text-anchor="middle" ${UNB} font-size="20" fill="#0b1630" letter-spacing="-1">24/7</text>`,
    ),
  },
};

/** The sticker's SVG markup with its ids made unique by `prefix`. */
export function stickerSvg(id: StickerId, prefix: string) {
  const art = STICKER_ART[id];
  if ("img" in art) return null;
  return `<svg class="art" xmlns="http://www.w3.org/2000/svg" viewBox="${art.vb}" aria-hidden="true">${art.body.replaceAll("__", prefix)}</svg>`;
}

const masks = new Map<StickerId, string>();

/** A CSS mask of the sticker's own shape, so the sheen never spills past it. */
export function stickerMask(id: StickerId) {
  let m = masks.get(id);
  if (!m) {
    const art = STICKER_ART[id];
    m =
      "img" in art
        ? `url(${art.img})`
        : `url("data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.vb}">${art.body.replaceAll("__", "m")}</svg>`,
          )}")`;
    masks.set(id, m);
  }
  return m;
}
