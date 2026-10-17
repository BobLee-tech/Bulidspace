import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCardDesign, getSession } from "@/lib/auth";
import { cardViewOf } from "@/lib/members";
import { WelcomeScreen } from "./welcome-screen";
import "../members.css";
import "./welcome.css";

export const metadata: Metadata = {
  title: "欢迎",
  robots: { index: false },
};

/** Where a new member lands after making their card; replayable from /me. */
export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="wl-wait" aria-busy />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const session = await getSession();
  if (!session?.member) redirect("/join");
  const design = await getCardDesign();
  return (
    <WelcomeScreen
      card={cardViewOf(session.member)}
      design={design}
      adminQr={
        process.env.NEXT_PUBLIC_ADMIN_WECHAT_QR || "/admin-wechat-qr.jpg"
      }
    />
  );
}
