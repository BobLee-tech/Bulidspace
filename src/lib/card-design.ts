// The card studio's vocabulary: materials, tints, patterns and stickers, plus
// the saved design's schema. Values mirror the checks in
// supabase/migrations/20261017010000_member_cards.sql; sticker art lives in
// src/lib/card-stickers.ts so this file stays small enough for the server.
import { z } from "zod";
import type { Bi } from "@/components/t";
import { SPARK_INFO, SPARKS, type Spark } from "./members";

export const MATERIALS = [
  "steel",
  "chrome",
  "carbon",
  "glass",
  "holo",
  "ti",
] as const;
export type Material = (typeof MATERIALS)[number];

/** Holo foil and anodized titanium are for members with a school email. */
export const VERIFIED_MATERIALS: readonly Material[] = ["holo", "ti"];

export const MATERIAL_LABEL: Record<Material, Bi> = {
  steel: { zh: "拉丝钢", en: "Brushed" },
  chrome: { zh: "黑镜铬", en: "Mirror" },
  carbon: { zh: "碳纤维", en: "Carbon" },
  glass: { zh: "磨砂玻璃", en: "Frosted" },
  holo: { zh: "五色全息", en: "Holo foil" },
  ti: { zh: "阳极钛", en: "Anodized" },
};

export const TINTS = ["none", ...SPARKS] as const;
export type Tint = (typeof TINTS)[number];

/** a → b is the tint's gradient; o is how strongly it colours the metal. */
export const TINT_INFO: Record<
  Tint,
  { label: Bi; a: string; b: string; o: number }
> = {
  none: {
    label: { zh: "原色", en: "Natural" },
    a: "transparent",
    b: "transparent",
    o: 0,
  },
  vivi: {
    label: { zh: "Vivi 粉", en: "Vivi pink" },
    a: "#ff9cc0",
    b: "#8a2f52",
    o: 0.55,
  },
  lumi: {
    label: { zh: "Lumi 黄", en: "Lumi yellow" },
    a: "#ffe27a",
    b: "#7a5c00",
    o: 0.5,
  },
  geo: {
    label: { zh: "Geo 蓝", en: "Geo blue" },
    a: "#6fa8ff",
    b: "#1d3f8f",
    o: 0.6,
  },
  momo: {
    label: { zh: "Momo 绿", en: "Momo green" },
    a: "#8fe58a",
    b: "#2a6b27",
    o: 0.55,
  },
  kiko: {
    label: { zh: "Kiko 紫", en: "Kiko purple" },
    a: "#b8a0ff",
    b: "#4b2f9a",
    o: 0.6,
  },
};

export const PATTERNS = [
  "guil",
  "puzzle",
  "grid",
  "topo",
  "dots",
  "none",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_LABEL: Record<Pattern, Bi> = {
  guil: { zh: "扭索纹", en: "Guilloche" },
  puzzle: { zh: "拼图", en: "Puzzle" },
  grid: { zh: "蓝图网格", en: "Blueprint" },
  topo: { zh: "等高线", en: "Topo" },
  dots: { zh: "半调", en: "Halftone" },
  none: { zh: "无", en: "None" },
};

export const FINISHES = ["orig", "chrome", "holo"] as const;
export type Finish = (typeof FINISHES)[number];

export const FINISH_LABEL: Record<Finish, Bi> = {
  orig: { zh: "原色", en: "Original" },
  chrome: { zh: "铬", en: "Chrome" },
  holo: { zh: "全息", en: "Holo" },
};

export const STICKER_CATS = ["spark", "symbol", "campus"] as const;
export type StickerCat = (typeof STICKER_CATS)[number];

export const STICKER_CAT_LABEL: Record<StickerCat, Bi> = {
  spark: { zh: "拼块伙伴", en: "Sparks" },
  symbol: { zh: "符号", en: "Symbols" },
  campus: { zh: "校园", en: "Campus" },
};

/** Campus stickers (id `campus-…`) are for verified members, like holo and ti. */
export const STICKERS = [
  "logo",
  ...SPARKS.map((s) => `spark-${s}` as const),
  "sparkle",
  "bolt",
  "code",
  "heart",
  "shipit",
  "e404",
  "campus-stamp",
  "campus-ticket",
  "campus-coffee",
  "campus-ibis",
  "campus-bridge",
  "campus-library",
] as const;
export type StickerId = (typeof STICKERS)[number];

export const stickerCat = (id: StickerId): StickerCat =>
  id === "logo" || id.startsWith("spark-")
    ? "spark"
    : id.startsWith("campus-")
      ? "campus"
      : "symbol";

export const MAX_STICKERS = 6;
export const MAX_TAGLINE = 32;
/** Where a sticker's centre may sit, in % of the card face, and its range. */
export const STICKER_BOUNDS = {
  x: [2, 98],
  y: [3, 97],
  r: [-180, 180],
  s: [0.25, 2.4],
} as const;

const round = (digits: number) => (v: number) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};
const within = (key: keyof typeof STICKER_BOUNDS, digits: number) =>
  z
    .number()
    .finite()
    .transform((v) => {
      const [lo, hi] = STICKER_BOUNDS[key];
      return round(digits)(Math.min(hi, Math.max(lo, v)));
    });

export const stickerSchema = z.object({
  id: z.enum(STICKERS),
  x: within("x", 2),
  y: within("y", 2),
  r: within("r", 1),
  s: within("s", 3),
  f: z.enum(FINISHES).default("orig"),
});
export type Sticker = z.infer<typeof stickerSchema>;
/** A sticker in the studio, with a key that survives reordering. */
export type PlacedSticker = Sticker & { uid?: number };

export const cardDesignSchema = z.object({
  material: z.enum(MATERIALS),
  tint: z.enum(TINTS),
  pattern: z.enum(PATTERNS),
  tagline: z
    .string()
    .trim()
    .max(
      MAX_TAGLINE,
      `签名最多 ${MAX_TAGLINE} 个字|Keep the tagline to ${MAX_TAGLINE} characters`,
    ),
  stickers: z
    .array(stickerSchema)
    .max(
      MAX_STICKERS,
      `最多 ${MAX_STICKERS} 张贴纸|Up to ${MAX_STICKERS} stickers`,
    ),
});
export type CardDesign = z.infer<typeof cardDesignSchema>;

/** A fresh card: brushed steel, guilloche, and the logo sticker where the old card had the mascot. */
export const DEFAULT_DESIGN: CardDesign = {
  material: "steel",
  tint: "none",
  pattern: "guil",
  tagline: "",
  stickers: [{ id: "logo", x: 84, y: 46, r: -8, s: 1.45, f: "orig" }],
};

/**
 * A stored design, read leniently: whatever doesn't parse falls back to the
 * default and unknown stickers are dropped, so one bad value never breaks a
 * card. Writes go through cardDesignSchema strictly.
 */
export function readDesign(raw: unknown): CardDesign {
  if (!raw || typeof raw !== "object") return DEFAULT_DESIGN;
  const r = raw as Record<string, unknown>;
  const pick = <T>(schema: z.ZodType<T>, v: unknown, fallback: T) => {
    const p = schema.safeParse(v);
    return p.success ? p.data : fallback;
  };
  const stickers = Array.isArray(r.stickers)
    ? r.stickers
        .map((s) => stickerSchema.safeParse(s))
        .flatMap((p) => (p.success ? [p.data] : []))
        .slice(0, MAX_STICKERS)
    : DEFAULT_DESIGN.stickers;
  return {
    material: pick(z.enum(MATERIALS), r.material, DEFAULT_DESIGN.material),
    tint: pick(z.enum(TINTS), r.tint, DEFAULT_DESIGN.tint),
    pattern: pick(z.enum(PATTERNS), r.pattern, DEFAULT_DESIGN.pattern),
    tagline: pick(cardDesignSchema.shape.tagline, r.tagline, ""),
    stickers,
  };
}

/** Verified-only parts of a design, for the server check and the message. */
export function lockedParts(design: CardDesign) {
  return {
    material: VERIFIED_MATERIALS.includes(design.material),
    stickers: design.stickers.some((s) => stickerCat(s.id) === "campus"),
  };
}

/**
 * What a card actually shows: verified-only parts fall back (steel, no campus
 * stickers) if the member is not verified, as the database would insist.
 */
export function shownDesign<D extends CardDesign>(
  design: D,
  verified: boolean,
): D {
  if (verified) return design;
  const locked = lockedParts(design);
  if (!locked.material && !locked.stickers) return design;
  return {
    ...design,
    material: locked.material ? "steel" : design.material,
    stickers: design.stickers.filter((s) => stickerCat(s.id) !== "campus"),
  };
}

/** The colour a card glows with: its tint, or the member's mascot. */
export const themeColor = (design: CardDesign, spark: Spark) =>
  design.tint === "none" ? SPARK_INFO[spark].color : TINT_INFO[design.tint].a;
