import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allEventResults, worksOnWall } from "./event-results";

describe("event results", () => {
  for (const [slug, results] of allEventResults()) {
    const works = results.works ?? [];

    it(`${slug}: every screenshot is in public/events/${slug}/`, () => {
      for (const w of works) {
        expect(w.shot.startsWith(`/events/${slug}/`), w.shot).toBe(true);
        expect(existsSync(join("public", w.shot)), w.shot).toBe(true);
      }
    });

    it(`${slug}: links are https and listed once`, () => {
      const urls = works.map((w) => w.url);
      for (const url of urls) expect(new URL(url).protocol, url).toBe("https:");
      expect(new Set(urls).size).toBe(urls.length);
    });

    it(`${slug}: organisers come last`, () => {
      const first = works.findIndex((w) => w.organiser);
      if (first === -1) return;
      expect(works.slice(first).every((w) => w.organiser)).toBe(true);
    });
  }

  it("counts participants' works, not organisers'", () => {
    expect(
      worksOnWall({
        works: [
          { name: "A", url: "https://a.github.io/", shot: "/a.jpg" },
          {
            name: "B",
            url: "https://b.dev/",
            shot: "/b.jpg",
            organiser: true,
          },
        ],
      }),
    ).toBe(1);
    expect(worksOnWall({})).toBe(0);
  });
});
