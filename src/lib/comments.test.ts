import { describe, expect, it } from "vitest";
import { countKind, threadsOf } from "./comments";
import type { ProjectComment } from "./types";

const c = (
  id: string,
  createdAt: string,
  extra: Partial<ProjectComment> = {},
): ProjectComment => ({
  id,
  parentId: null,
  kind: "idea",
  nickname: id,
  body: "…",
  bodyEn: null,
  translated: null,
  isOwner: false,
  createdAt,
  ...extra,
});

describe("threadsOf", () => {
  it("nests replies and dates a thread by its latest reply", () => {
    const [t] = threadsOf([
      c("a", "2026-10-14T10:00:00Z"),
      c("r", "2026-10-15T09:00:00Z", { parentId: "a", kind: null }),
    ]);
    expect(t).toMatchObject({ id: "a", at: "2026-10-15T09:00:00Z" });
    expect(t.replies.map((r) => r.id)).toEqual(["r"]);
  });

  it("keeps replies of a deleted comment under a placeholder", () => {
    const threads = threadsOf([
      c("r1", "2026-10-14T10:00:00Z", { parentId: "gone", kind: null }),
      c("r2", "2026-10-14T11:00:00Z", { parentId: "gone", kind: null }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ id: "gone", root: null });
    expect(threads[0].replies).toHaveLength(2);
  });
});

describe("countKind", () => {
  it("counts top-level comments only", () => {
    const list = [
      c("a", "2026-10-14T10:00:00Z", { kind: "join" }),
      c("b", "2026-10-14T11:00:00Z", { kind: "ask" }),
      c("r", "2026-10-14T12:00:00Z", { parentId: "a", kind: null }),
    ];
    expect(countKind(list, "join")).toBe(1);
    expect(countKind(list, "idea")).toBe(0);
  });
});
