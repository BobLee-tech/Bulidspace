"use client";

import { useActionState, useState } from "react";
import { Arr, Hud } from "@/components/fx/arr";
import { CheckGroup, ChoiceGroup, TextField } from "@/components/form-fields";
import { Msg, T } from "@/components/t";
import type { FormState } from "@/lib/forms";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import {
  BLOCKERS,
  BLOCKER_LABEL,
  EVENT_INTEREST,
  EVENT_INTEREST_LABEL,
  REFERRAL_LABEL,
  REFERRAL_SOURCES,
} from "@/lib/types";
import { submitSurvey } from "./actions";

/**
 * The second half of the old join form, now optional and after the card:
 * what got in the way last term, where they heard of us, the next event, and
 * the opt-in to back the club application (name and zID only then).
 */
export function SurveyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitSurvey,
    { status: "idle" },
  );
  const [supporting, setSupporting] = useState(false);
  const err = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  if (state.status === "ok") {
    return (
      <div className="form hud" role="status">
        <Hud />
        <p className="mono mute">
          <T zh="问卷已提交" en="Survey sent" />
        </p>
        <p>
          <T
            zh="谢谢！这些回答帮我们安排下一场活动。"
            en="Thanks, this helps us plan the next event."
          />
        </p>
      </div>
    );
  }

  return (
    <form className="form hud" noValidate onSubmit={submitWithoutReset(action)}>
      <Hud />
      <div>
        <p className="mono mute">
          <T zh="选填 · 约 1 分钟" en="Optional · about a minute" />
        </p>
        <h2 className="h3" style={{ marginTop: 6 }}>
          <T zh="帮我们更了解你" en="Help us get to know you" />
        </h2>
      </div>
      <ChoiceGroup
        name="stalledProject"
        legend={
          <T
            zh="上学期有没有想做、但没做成的项目"
            en="Last term, was there a project you wanted to build but didn't?"
          />
        }
        options={[
          ["yes", { zh: "有", en: "Yes" }],
          ["no", { zh: "没有", en: "No" }],
        ]}
        optional
      />
      <CheckGroup
        name="blockers"
        legend={
          <T
            zh="做项目时卡在哪（可多选）"
            en="What got in the way? (pick any)"
          />
        }
        options={BLOCKERS.map((b) => [b, BLOCKER_LABEL[b]])}
      />
      <ChoiceGroup
        name="referralSource"
        legend={<T zh="从哪里知道我们" en="How did you hear about us?" />}
        options={REFERRAL_SOURCES.map((r) => [r, REFERRAL_LABEL[r]])}
        optional
      />
      <ChoiceGroup
        name="eventInterest"
        legend={
          <T
            zh="下一场线下活动想来吗"
            en="Would you come to the next in-person event?"
          />
        }
        options={EVENT_INTEREST.map((e) => [e, EVENT_INTEREST_LABEL[e]])}
        optional
      />
      <label className="consent">
        <input type="checkbox" name="showcaseConsent" />
        <span>
          <T
            zh="我同意在项目广场和活动回顾中展示我的作品（可随时撤回）"
            en="Show my work in the project plaza and event recaps (you can withdraw any time)"
          />
        </span>
      </label>
      <div className="support">
        <label className="consent">
          <input
            type="checkbox"
            name="affiliationSupport"
            checked={supporting}
            onChange={(e) => setSupporting(e.target.checked)}
          />
          <span>
            <T
              zh="我是 UNSW 在读学生，愿意登记支持 BuilderSpace 申请成为正式社团"
              en="I'm a current UNSW student and I'd like to back BuilderSpace's application to become an official club"
            />
          </span>
        </label>
        {supporting && (
          <>
            <p className="mute support-note">
              <T
                zh="申请需要一份支持者名单。下面两项只会提交给 Arc 用于这次申请，不公开，也不用于其他用途；想撤回随时告诉管理员。"
                en="The application needs a list of supporters. These two fields go only to Arc for this application. They are never public or used for anything else, and you can ask an admin to remove them at any time."
              />
            </p>
            <div className="row2">
              <TextField
                name="fullName"
                label={
                  <T
                    zh="全名（与学生证一致）"
                    en="Full name (as on your student card)"
                  />
                }
                error={err.fullName}
                max={80}
              />
              <TextField
                name="zid"
                label={<span style={{ textTransform: "none" }}>zID</span>}
                placeholder="z1234567"
                error={err.zid}
                max={8}
              />
            </div>
            <label className="consent">
              <input type="checkbox" name="affiliationConsent" />
              <span>
                <T
                  zh="我同意把以上姓名和 zID 提交给 Arc，仅用于 BuilderSpace 的社团申请"
                  en="I agree to my name and zID being passed to Arc, only for BuilderSpace's club application"
                />
              </span>
            </label>
            {err.affiliationConsent && (
              <span className="form-status err">
                <Msg s={err.affiliationConsent} />
              </span>
            )}
          </>
        )}
      </div>
      {state.status === "error" && (
        <p className="form-status err" role="alert">
          <Msg s={state.message} />
        </p>
      )}
      <button
        type="submit"
        className="btn solid primary"
        disabled={pending}
        style={{ alignSelf: "start" }}
      >
        {pending ? (
          <T zh="提交中…" en="Sending…" />
        ) : (
          <T zh="提交问卷" en="Send" />
        )}{" "}
        <Arr />
      </button>
    </form>
  );
}
