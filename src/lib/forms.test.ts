import { describe, expect, it } from "vitest";
import {
  channelFromSearch,
  parseProjectCommentForm,
  parseProjectForm,
  parseProjectUpdateForm,
  parseVolunteerForm,
  projectSlug,
} from "./forms";
import { POSITION_LABEL, VOLUNTEER_POSITIONS } from "./types";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe("parseProjectForm", () => {
  const base: [string, string][] = [
    ["name", "合租雷达"],
    ["problem", "找室友靠刷帖"],
    ["targetUser", "悉尼留学生"],
    ["ownerName", "YK"],
    ["contact", "wechat: yk"],
    ["repoUrl", ""],
    ["demoUrl", ""],
  ];

  it("treats empty links as null", () => {
    const result = parseProjectForm(form(base));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ repoUrl: null, demoUrl: null });
  });

  it("rejects non-http links", () => {
    const result = parseProjectForm(
      form([
        ...base.filter(([k]) => k !== "repoUrl"),
        ["repoUrl", "javascript:alert(1)"],
      ]),
    );
    expect(result.success).toBe(false);
  });

  const folder = "0b6c1f0e-8a4e-4d43-9a39-2f1f6f0f7c11";

  it("has no media when nothing was uploaded", () => {
    const result = parseProjectForm(form(base));
    expect(result.data?.media).toEqual({
      coverPath: null,
      coverFocusX: 50,
      coverFocusY: 50,
      videoPath: null,
      videoPosterPath: null,
      videoSeconds: null,
    });
  });

  it("keeps uploaded cover and video paths", () => {
    const result = parseProjectForm(
      form([
        ...base,
        ["coverPath", `${folder}/cover.webp`],
        ["coverFocusX", "30"],
        ["coverFocusY", "120"],
        ["videoPath", `${folder}/video.mp4`],
        ["videoPosterPath", `${folder}/poster-2.jpg`],
        ["videoSeconds", "7.4"],
      ]),
    );
    expect(result.data?.media).toEqual({
      coverPath: `${folder}/cover.webp`,
      coverFocusX: 30,
      coverFocusY: 50,
      videoPath: `${folder}/video.mp4`,
      videoPosterPath: `${folder}/poster-2.jpg`,
      videoSeconds: 7.4,
    });
  });

  it("rejects paths outside the upload folders and over-long videos", () => {
    for (const [k, v] of [
      ["coverPath", "../secrets/cover.jpg"],
      ["coverPath", `${folder}/cover.gif`],
      ["videoPath", `${folder}/video.exe`],
    ]) {
      expect(parseProjectForm(form([...base, [k, v]])).success).toBe(false);
    }
    const long = parseProjectForm(
      form([
        ...base,
        ["videoPath", `${folder}/video.mp4`],
        ["videoSeconds", "181"],
      ]),
    );
    expect(long.success).toBe(false);
  });

  it("drops a video path that came without a length", () => {
    const result = parseProjectForm(
      form([...base, ["videoPath", `${folder}/video.mp4`]]),
    );
    expect(result.data?.media.videoPath).toBeNull();
  });
});

describe("parseVolunteerForm", () => {
  const base: [string, string][] = [
    ["nickname", " Yuki "],
    ["email", " Yuki@Example.com "],
    ["schoolDegree", "UNSW · Master of IT"],
    ["positions", "events"],
    ["positions", "web_tools"],
    ["weeklyHours", "2to5"],
    ["about", " 办过两场校内活动 "],
    ["portfolioUrl", ""],
    ["dataConsent", "on"],
  ];

  it("accepts a complete application and trims text", () => {
    const result = parseVolunteerForm(form(base));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      nickname: "Yuki",
      email: "yuki@example.com",
      positions: ["events", "web_tools"],
      weeklyHours: "2to5",
      about: "办过两场校内活动",
      portfolioUrl: null,
      channel: null,
      dataConsent: true,
    });
  });

  it("needs at least one known position", () => {
    const none = parseVolunteerForm(
      form(base.filter(([k]) => k !== "positions")),
    );
    expect(none.error!.issues.map((i) => i.path[0])).toContain("positions");

    const unknown = parseVolunteerForm(
      form([...base.filter(([k]) => k !== "positions"), ["positions", "ceo"]]),
    );
    expect(unknown.success).toBe(false);
  });

  it("does not store anything without consent", () => {
    const result = parseVolunteerForm(
      form(base.filter(([k]) => k !== "dataConsent")),
    );
    expect(result.error!.issues.map((i) => i.path[0])).toContain("dataConsent");
  });

  it("requires only the WeChat name, the email and a position", () => {
    const required = ["nickname", "email", "positions"];
    const result = parseVolunteerForm(
      form(base.filter(([k]) => !required.includes(k))),
    );
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect([...new Set(paths)].sort()).toEqual([...required].sort());
  });

  it("stores the optional fields as null when left blank", () => {
    const optional = ["schoolDegree", "weeklyHours", "about", "portfolioUrl"];
    const result = parseVolunteerForm(
      form([
        ...base.filter(([k]) => !optional.includes(k)),
        ["schoolDegree", "  "],
        ["about", ""],
      ]),
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      schoolDegree: null,
      weeklyHours: null,
      about: null,
      portfolioUrl: null,
    });
  });

  it("rejects a malformed email and an unknown weekly-hours value", () => {
    const rest = base.filter(([k]) => k !== "email");
    for (const bad of ["yuki", "yuki@", "wechat: yuki", "a b@x.com"]) {
      const result = parseVolunteerForm(form([...rest, ["email", bad]]));
      expect(result.error!.issues.map((i) => i.path[0])).toContain("email");
    }
    const hours = parseVolunteerForm(
      form([
        ...base.filter(([k]) => k !== "weeklyHours"),
        ["weeklyHours", "always"],
      ]),
    );
    expect(hours.error!.issues.map((i) => i.path[0])).toContain("weeklyHours");
  });

  it("adds https:// to a link typed without it", () => {
    const rest = base.filter(([k]) => k !== "portfolioUrl");
    const cases: [string, string][] = [
      ["github.com/yuki", "https://github.com/yuki"],
      ["www.yuki.dev", "https://www.yuki.dev"],
      ["//yuki.dev/a", "https://yuki.dev/a"],
      ["http://yuki.dev", "http://yuki.dev"],
      ["HTTPS://yuki.dev", "https://yuki.dev"],
      ["http:yuki.dev", "http://yuki.dev"],
    ];
    for (const [typed, stored] of cases) {
      const result = parseVolunteerForm(
        form([...rest, ["portfolioUrl", typed]]),
      );
      expect(result.data?.portfolioUrl).toBe(stored);
    }
    for (const bad of ["hello", "mailto:a@b.co", "ftp://yuki.dev"]) {
      const result = parseVolunteerForm(form([...rest, ["portfolioUrl", bad]]));
      expect(result.success).toBe(false);
    }
  });

  it("keeps an http(s) portfolio link and rejects anything else", () => {
    const rest = base.filter(([k]) => k !== "portfolioUrl");
    const ok = parseVolunteerForm(
      form([...rest, ["portfolioUrl", "https://github.com/yuki"]]),
    );
    expect(ok.data?.portfolioUrl).toBe("https://github.com/yuki");

    const bad = parseVolunteerForm(
      form([...rest, ["portfolioUrl", "javascript:alert(1)"]]),
    );
    expect(bad.success).toBe(false);

    // The column is capped at 300 characters; catch it here, not at insert.
    const long = parseVolunteerForm(
      form([...rest, ["portfolioUrl", `https://x.dev/${"a".repeat(290)}`]]),
    );
    expect(long.error!.issues.map((i) => i.path[0])).toContain("portfolioUrl");
  });

  it("offers every position on the form", () => {
    expect(new Set(VOLUNTEER_POSITIONS).size).toBe(9);
    expect(Object.keys(POSITION_LABEL).sort()).toEqual(
      [...VOLUNTEER_POSITIONS].sort(),
    );
  });

  it("keeps a clean channel tag and drops a malformed one", () => {
    const ok = parseVolunteerForm(form([...base, ["channel", "Poster-QR"]]));
    expect(ok.data?.channel).toBe("poster-qr");
    const bad = parseVolunteerForm(form([...base, ["channel", "<script>"]]));
    expect(bad.success).toBe(true);
    expect(bad.data?.channel).toBeNull();
  });
});

describe("channelFromSearch", () => {
  it("prefers ref over utm_source", () => {
    expect(channelFromSearch("?ref=poster-qr&utm_source=x")).toBe("poster-qr");
    expect(channelFromSearch("?utm_source=xiaohongshu")).toBe("xiaohongshu");
    expect(channelFromSearch("")).toBeNull();
  });
});

describe("parseProjectUpdateForm", () => {
  const base: [string, string][] = [
    ["slug", "coursemate"],
    ["kind", "demo"],
    ["body", " 课程评价流程跑通，10 位同学试用 "],
    ["url", ""],
    ["submittedBy", "Bob"],
  ];

  it("accepts an update and trims the body", () => {
    const result = parseProjectUpdateForm(form(base));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      body: "课程评价流程跑通，10 位同学试用",
      url: null,
    });
  });

  it("rejects an unknown kind and a missing name", () => {
    const result = parseProjectUpdateForm(
      form([
        ["slug", "coursemate"],
        ["kind", "tweet"],
        ["body", "x"],
        ["url", ""],
        ["submittedBy", ""],
      ]),
    );
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["kind", "submittedBy"]));
  });
});

describe("parseProjectCommentForm", () => {
  const thread = "0b7e3f4a-9c1d-4e2f-8a6b-5c4d3e2f1a0b";
  const base: [string, string][] = [
    ["slug", "coursemate"],
    ["nickname", " 阿杰 "],
    ["body", " 我会 React，想一起做前端 "],
  ];

  it("accepts a top-level comment with a kind", () => {
    const result = parseProjectCommentForm(form([...base, ["kind", "join"]]));
    expect(result.data).toEqual({
      slug: "coursemate",
      parentId: null,
      kind: "join",
      nickname: "阿杰",
      body: "我会 React，想一起做前端",
    });
  });

  it("needs a kind unless it is a reply", () => {
    const top = parseProjectCommentForm(form(base));
    expect(top.error!.issues.map((i) => i.path[0])).toEqual(["kind"]);

    const reply = parseProjectCommentForm(
      form([...base, ["parentId", thread]]),
    );
    expect(reply.data).toMatchObject({ parentId: thread, kind: null });
  });

  it("drops the kind sent with a reply", () => {
    const result = parseProjectCommentForm(
      form([...base, ["parentId", thread], ["kind", "ask"]]),
    );
    expect(result.data?.kind).toBeNull();
  });

  it("rejects an unknown kind, a bad thread id and an empty body", () => {
    const result = parseProjectCommentForm(
      form([
        ["slug", "coursemate"],
        ["kind", "spam"],
        ["parentId", "not-a-uuid"],
        ["nickname", "x"],
        ["body", "   "],
      ]),
    );
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["kind", "parentId", "body"]));
  });

  it("caps the body at 500 characters", () => {
    const result = parseProjectCommentForm(
      form([...base.slice(0, 2), ["kind", "idea"], ["body", "长".repeat(501)]]),
    );
    expect(result.success).toBe(false);
  });
});

describe("projectSlug", () => {
  it("keeps ascii words and appends the suffix", () => {
    expect(projectSlug("Menu Lens!", "a1b2c3")).toBe("menu-lens-a1b2c3");
  });

  it("falls back when the name has no ascii", () => {
    expect(projectSlug("合租雷达", "a1b2c3")).toBe("project-a1b2c3");
  });
});
