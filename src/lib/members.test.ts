import { describe, expect, it } from "vitest";
import { parseMemberProfile, parseSurvey } from "./member-forms";
import {
  isUnsw,
  memberCode,
  ordinal,
  schoolDomain,
  sealLabel,
} from "./members";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe("ordinal", () => {
  it.each([
    [1, "st"],
    [2, "nd"],
    [3, "rd"],
    [4, "th"],
    [11, "th"],
    [12, "th"],
    [13, "th"],
    [21, "st"],
    [71, "st"],
    [72, "nd"],
    [111, "th"],
    [123, "rd"],
  ])("%i → %s", (n, suffix) => {
    expect(ordinal(n)).toBe(suffix);
  });
});

describe("school email", () => {
  it("recognises school domains the same way the database does", () => {
    expect(schoolDomain("z5555555@ad.unsw.edu.au")).toBe("ad.unsw.edu.au");
    expect(schoolDomain("A@Student.UNSW.edu.au")).toBe("student.unsw.edu.au");
    expect(schoolDomain("kim@mit.edu")).toBe("mit.edu");
    expect(schoolDomain("lee@ox.ac.uk")).toBe("ox.ac.uk");
    expect(schoolDomain("bo@gmail.com")).toBeNull();
    expect(schoolDomain("bo@edu.example.com")).toBeNull();
  });

  it("labels the seal UNSW only for UNSW", () => {
    expect(isUnsw("ad.unsw.edu.au")).toBe(true);
    expect(sealLabel("ad.unsw.edu.au")).toBe("UNSW");
    expect(sealLabel("sydney.edu.au")).toBe("STUDENT");
  });

  it("pads card numbers to four digits", () => {
    expect(memberCode(7)).toBe("BS-0007");
    expect(memberCode(71)).toBe("BS-0071");
    expect(memberCode(12345)).toBe("BS-12345");
  });
});

describe("parseMemberProfile", () => {
  const base: [string, string][] = [
    ["nickname", " Bo "],
    ["schoolDegree", "UNSW · Master of IT"],
    ["major", "IT"],
    ["skills", "web"],
    ["skills", "uiux"],
    ["spark", "lumi"],
    ["building", ""],
  ];

  it("accepts a minimal profile and trims text", () => {
    const result = parseMemberProfile(form(base));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      nickname: "Bo",
      skills: ["web", "uiux"],
      spark: "lumi",
      building: null,
      lookingFor: [],
      channel: null,
    });
  });

  it("caps skills at four and looking-for at three", () => {
    const skills = ["web", "backend", "mobile", "ai", "hw"].map(
      (s) => ["skills", s] as [string, string],
    );
    const looking = ["design", "dev", "product", "team"].map(
      (s) => ["lookingFor", s] as [string, string],
    );
    const result = parseMemberProfile(
      form([...base.filter(([k]) => k !== "skills"), ...skills, ...looking]),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("skills");
    expect(paths).toContain("lookingFor");
  });

  it("rejects old skill names, unknown mascots and a missing nickname", () => {
    const result = parseMemberProfile(
      form([
        ["nickname", "  "],
        ["skills", "frontend"],
        ["spark", "pikachu"],
      ]),
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["nickname", "skills", "spark"]),
    );
  });
});

describe("parseSurvey", () => {
  it("accepts an empty survey: every question is optional", () => {
    const result = parseSurvey(form([]));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      stalledProject: null,
      referralSource: null,
      eventInterest: null,
      affiliationSupport: false,
      fullName: null,
      zid: null,
    });
  });

  it("drops a name and zID typed without opting in", () => {
    const result = parseSurvey(
      form([
        ["fullName", "Li Bo"],
        ["zid", "z1234567"],
      ]),
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ fullName: null, zid: null });
  });

  it("needs a name, a valid zID and consent from supporters", () => {
    const missing = parseSurvey(form([["affiliationSupport", "on"]]));
    expect(missing.success).toBe(false);
    const ok = parseSurvey(
      form([
        ["affiliationSupport", "on"],
        ["fullName", "Li Bo"],
        ["zid", "1234567"],
        ["affiliationConsent", "on"],
      ]),
    );
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({
      zid: "z1234567",
      affiliationConsent: true,
    });
  });
});
