import { describe, expect, it } from "vitest";
import {
  cardDesignSchema,
  DEFAULT_DESIGN,
  lockedParts,
  readDesign,
  shownDesign,
  stickerCat,
  STICKERS,
  themeColor,
  type CardDesign,
} from "./card-design";
import { STICKER_ART, stickerMask, stickerSvg } from "./card-stickers";
import { cardSaveSchema } from "./member-forms";

const bolt = { id: "bolt", x: 50, y: 50, r: 0, s: 0.45, f: "orig" } as const;
const design = (patch: Partial<CardDesign> = {}): CardDesign => ({
  ...DEFAULT_DESIGN,
  ...patch,
});

describe("cardDesignSchema", () => {
  it("accepts the default design", () => {
    expect(cardDesignSchema.parse(DEFAULT_DESIGN)).toEqual(DEFAULT_DESIGN);
  });

  it("rejects values the database would reject", () => {
    expect(
      cardDesignSchema.safeParse(design({ material: "gold" as never })).success,
    ).toBe(false);
    expect(
      cardDesignSchema.safeParse(design({ tagline: "x".repeat(33) })).success,
    ).toBe(false);
    expect(
      cardDesignSchema.safeParse(design({ stickers: Array(7).fill(bolt) }))
        .success,
    ).toBe(false);
    expect(
      cardDesignSchema.safeParse(
        design({ stickers: [{ ...bolt, id: "nope" as never }] }),
      ).success,
    ).toBe(false);
  });

  it("clamps and rounds sticker placement into the stored ranges", () => {
    const [st] = cardDesignSchema.parse(
      design({
        stickers: [{ id: "bolt", x: 120, y: -4, r: 200, s: 9, f: "holo" }],
      }),
    ).stickers;
    expect(st).toEqual({ id: "bolt", x: 98, y: 3, r: 180, s: 2.4, f: "holo" });
    const [fine] = cardDesignSchema.parse(
      design({ stickers: [{ ...bolt, x: 12.3456, r: 7.77, s: 0.12345 }] }),
    ).stickers;
    expect(fine).toMatchObject({ x: 12.35, r: 7.8, s: 0.25 });
  });

  it("trims the tagline", () => {
    expect(cardDesignSchema.parse(design({ tagline: "  hi  " })).tagline).toBe(
      "hi",
    );
  });
});

describe("readDesign", () => {
  it("falls back to the default for missing or broken rows", () => {
    expect(readDesign(null)).toEqual(DEFAULT_DESIGN);
    expect(readDesign("nope")).toEqual(DEFAULT_DESIGN);
  });

  it("keeps what parses and drops what doesn't", () => {
    const read = readDesign({
      material: "chrome",
      tint: "purple",
      pattern: "topo",
      tagline: 42,
      stickers: [bolt, { id: "ghost", x: 1 }, "x"],
    });
    expect(read).toEqual({
      material: "chrome",
      tint: "none",
      pattern: "topo",
      tagline: "",
      stickers: [bolt],
    });
  });
});

describe("verified-only parts", () => {
  const fancy = design({
    material: "holo",
    stickers: [bolt, { ...bolt, id: "campus-ibis" }],
  });

  it("finds holo, titanium and campus stickers", () => {
    expect(lockedParts(fancy)).toEqual({ material: true, stickers: true });
    expect(lockedParts(design({ material: "ti" }))).toEqual({
      material: true,
      stickers: false,
    });
    expect(lockedParts(DEFAULT_DESIGN)).toEqual({
      material: false,
      stickers: false,
    });
  });

  it("shows them only to verified members", () => {
    expect(shownDesign(fancy, true)).toBe(fancy);
    expect(shownDesign(fancy, false)).toEqual({
      ...fancy,
      material: "steel",
      stickers: [bolt],
    });
  });
});

describe("stickers", () => {
  it("has art for every sticker and only campus ones are campus", () => {
    for (const id of STICKERS) {
      expect(STICKER_ART[id]).toBeDefined();
      expect(stickerCat(id) === "campus").toBe(id.startsWith("campus-"));
      expect(stickerMask(id)).toMatch(/^url\(/);
    }
    expect(stickerCat("logo")).toBe("spark");
    expect(stickerCat("spark-geo")).toBe("spark");
  });

  it("prefixes ids so two copies on a page never clash", () => {
    const svg = stickerSvg("campus-bridge", "p1-")!;
    expect(svg).toContain('id="p1-g"');
    expect(svg).toContain("url(#p1-g)");
    expect(svg).not.toContain("__");
    expect(stickerSvg("logo", "p1-")).toBeNull();
  });
});

describe("cardSaveSchema", () => {
  it("parses the studio payload, back included", () => {
    const parsed = cardSaveSchema.parse({
      design: DEFAULT_DESIGN,
      spark: "geo",
      building: "  ",
      lookingFor: ["design"],
    });
    expect(parsed).toMatchObject({
      spark: "geo",
      building: null,
      lookingFor: ["design"],
    });
  });

  it("rejects an unknown mascot or too many asks", () => {
    const base = { design: DEFAULT_DESIGN, building: "", lookingFor: [] };
    expect(cardSaveSchema.safeParse({ ...base, spark: "rex" }).success).toBe(
      false,
    );
    expect(
      cardSaveSchema.safeParse({
        ...base,
        spark: "geo",
        lookingFor: ["design", "dev", "product", "team"],
      }).success,
    ).toBe(false);
  });
});

describe("themeColor", () => {
  it("follows the tint, or the mascot when there is none", () => {
    expect(themeColor(design({ tint: "kiko" }), "lumi")).toBe("#b8a0ff");
    expect(themeColor(DEFAULT_DESIGN, "lumi")).toBe("#ffd23f");
  });
});
