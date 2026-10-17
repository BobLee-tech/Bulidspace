import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "@/components/page-head";
import { T } from "@/components/t";
import { getSession } from "@/lib/auth";
import { JoinFlow } from "./join-flow";
import "../members.css";

export const metadata: Metadata = { title: "加入" };

export default function JoinPage() {
  return (
    <section className="sec first">
      <div className="wrap">
        <PageHead
          path="join"
          eyebrow={{
            zh: "加入 / Join · 约 1 分钟",
            en: "Join · about a minute",
          }}
          title={["Start", "here."]}
          aside={[
            {
              k: { zh: "谁可以加入", en: "Who can join" },
              v: {
                zh: "所有人，推荐学校邮箱",
                en: "Anyone, school email best",
              },
            },
            {
              k: { zh: "费用", en: "Cost" },
              v: { zh: "免费", en: "Free" },
            },
            {
              k: { zh: "登录方式", en: "Sign-in" },
              v: { zh: "邮箱 6 位验证码", en: "6-digit email code" },
            },
          ]}
        />
        <p className="lede" style={{ marginBottom: 32 }}>
          <T
            zh="加入就是注册：拿到一张属于你的成员卡，编号按真实的加入顺序发。零基础也行；我们不收学生证，zID 只在你自愿登记支持社团申请时填写，数据可随时要求删除。"
            en="Joining is signing up: you get your own member card, numbered in the order people joined. Beginners welcome. We never ask for your student card, your zID only if you opt in to back our club application, and your data is deleted on request."
          />
        </p>
        <Suspense fallback={<div className="join-wait" aria-busy />}>
          <JoinGate />
        </Suspense>
      </div>
    </section>
  );
}

/** Members who already have a card go straight to it. */
async function JoinGate() {
  const session = await getSession();
  if (session?.member) redirect("/me");
  return <JoinFlow signedInEmail={session?.email ?? null} />;
}
