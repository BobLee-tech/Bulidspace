import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "@/components/page-head";
import { T } from "@/components/t";
import { getCardDesign, getSession } from "@/lib/auth";
import { cardViewOf } from "@/lib/members";
import { CardStudio } from "./card-studio";
import "../../members.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "定制卡片",
  robots: { index: false },
};

export default function CardStudioPage() {
  return (
    <section className="sec first">
      <div className="wrap">
        <PageHead
          path="me/card"
          eyebrow={{
            zh: "定制卡片 / Card studio",
            en: "Card studio",
          }}
          title={["Make it", "yours."]}
        />
        <p className="lede" style={{ marginBottom: 28 }}>
          <T
            zh="换材质和颜色，贴上拼块伙伴和贴纸。移动鼠标看光怎么走。"
            en="Change the material and colour, add your Spark and some stickers. Move the pointer to see the light travel."
          />
        </p>
        <Suspense fallback={<div className="join-wait" aria-busy />}>
          <Studio />
        </Suspense>
      </div>
    </section>
  );
}

async function Studio() {
  const session = await getSession();
  if (!session?.member) redirect("/join");
  const design = await getCardDesign();
  return (
    <CardStudio
      card={cardViewOf(session.member)}
      design={design}
      verified={session.member.verified}
    />
  );
}
