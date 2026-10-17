import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Arr } from "@/components/fx/arr";
import { PageHead } from "@/components/page-head";
import { T } from "@/components/t";
import { getCardDesign, getSession, surveyDone } from "@/lib/auth";
import {
  cardViewOf,
  isUnsw,
  LOOKING_LABEL,
  MEMBER_SKILL_LABEL,
  memberCode,
  ordinal,
  SPARK_INFO,
  type Member,
} from "@/lib/members";
import { logOut } from "./actions";
import { MeCard } from "./me-card";
import { SurveyForm } from "./survey-form";
import "../members.css";

export const metadata: Metadata = {
  title: "我的卡片",
  robots: { index: false },
};

export default function MePage() {
  return (
    <section className="sec first">
      <div className="wrap">
        <Suspense fallback={<div className="join-wait" aria-busy />}>
          <Me />
        </Suspense>
      </div>
    </section>
  );
}

async function Me() {
  const session = await getSession();
  if (!session?.member) redirect("/join");
  const m = session.member;
  const [done, design] = await Promise.all([surveyDone(), getCardDesign()]);
  const spark = SPARK_INFO[m.spark];

  return (
    <>
      <PageHead
        path="me"
        eyebrow={{ zh: "我的卡片 / My card", en: "My card" }}
        title={[`${m.nickname}’s`, "card."]}
        aside={[
          {
            k: { zh: "编号", en: "Number" },
            v: { zh: memberCode(m.memberNo), en: memberCode(m.memberNo) },
          },
          {
            k: { zh: "拼块", en: "Piece" },
            v: {
              zh: `${spark.name} · ${spark.role.zh}`,
              en: `${spark.name} · ${spark.role.en}`,
            },
          },
          {
            k: { zh: "身份", en: "Status" },
            v: m.verified
              ? { zh: "认证成员", en: "Verified member" }
              : { zh: "成员", en: "Member" },
          },
        ]}
      />

      <div className="join2 me-grid">
        <MeCard card={cardViewOf(m)} design={design} />
        <div className="me-side">
          <div className="row-actions">
            <Link href="/me/card" className="btn solid">
              <T zh="定制卡片" en="Customise your card" /> <Arr />
            </Link>
            <Link href="/welcome" className="btn ghost">
              <T zh="重看欢迎 · 加群二维码" en="Welcome again · group QR" />
            </Link>
          </div>
          <Details m={m} />
          {!done && <SurveyForm />}
          <form action={logOut}>
            <button type="submit" className="linkish">
              <T zh="退出登录" en="Sign out" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Details({ m }: { m: Member }) {
  const spark = SPARK_INFO[m.spark];
  const rows: [React.ReactNode, React.ReactNode][] = [
    [
      <T key="k" zh="编号" en="Number" />,
      `${memberCode(m.memberNo)} · ${m.memberNo}${ordinal(m.memberNo)} Builder`,
    ],
    [
      <T key="k" zh="拼块" en="Piece" />,
      <>
        {spark.name} · {spark.zh} · <T {...spark.role} />
      </>,
    ],
    [<T key="k" zh="学校与学位" en="University" />, m.schoolDegree || "—"],
    [<T key="k" zh="专业" en="Major" />, m.major || "—"],
    [
      <T key="k" zh="技能" en="Skills" />,
      m.skills.length
        ? m.skills.map((s, i) => (
            <span key={s}>
              {i > 0 && "、"}
              <T {...MEMBER_SKILL_LABEL[s]} />
            </span>
          ))
        : "—",
    ],
    [<T key="k" zh="正在做" en="Building" />, m.building || "—"],
    [
      <T key="k" zh="在找" en="Looking for" />,
      m.lookingFor.length
        ? m.lookingFor.map((k, i) => (
            <span key={k}>
              {i > 0 && "、"}
              <T {...LOOKING_LABEL[k]} />
            </span>
          ))
        : "—",
    ],
    [<T key="k" zh="登录邮箱" en="Email" />, m.email],
    [
      <T key="k" zh="认证" en="Verified" />,
      m.verified ? (
        <span className="ok-text">
          ✓ {isUnsw(m.schoolDomain) ? "UNSW" : m.schoolDomain}
        </span>
      ) : (
        <T
          zh="未认证 · 用学校邮箱登录的成员是认证成员"
          en="Not verified · members who sign in with a school email are verified"
        />
      ),
    ],
  ];
  return (
    <div className="hud me-details">
      <dl>
        {rows.map(([k, v], i) => (
          <div key={i}>
            <dt className="mono mute">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mute small">
        <T
          zh="拼图徽章和公开卡片页下一步上线。"
          en="Puzzle badges and public card pages come next."
        />
      </p>
    </div>
  );
}
