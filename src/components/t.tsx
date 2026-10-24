import type { ReactNode } from "react";

export type Bi = { zh: ReactNode; en: ReactNode };

/**
 * Renders both languages; CSS on <html data-lang> shows one. Pages stay fully
 * static and cacheable, and switching language needs no reload or refetch.
 */
export function T({ zh, en }: Bi) {
  return (
    <>
      <span data-l="zh">{zh}</span>
      <span data-l="en" lang="en">
        {en}
      </span>
    </>
  );
}

/**
 * Small grey mark on text ops translated, shown only in the language that
 * reads the translation; renders nothing when the author wrote it.
 */
export function TranslatedMark({
  lang,
  className = "",
}: {
  lang: "zh" | "en" | null | undefined;
  className?: string;
}) {
  if (!lang) return null;
  return lang === "en" ? (
    <span data-l="en" lang="en" className={`tr-mark ${className}`}>
      Translated
    </span>
  ) : (
    <span data-l="zh" className={`tr-mark ${className}`}>
      译文
    </span>
  );
}

export const LANG_STORAGE_KEY = "bs-lang";

/** Runs before first paint so English readers never see a flash of Chinese. */
export const langBootScript = `try{var l=localStorage.getItem("${LANG_STORAGE_KEY}");if(l==="en"){document.documentElement.dataset.lang="en";document.documentElement.lang="en"}}catch(e){}`;

/** Renders a "中文|English" message (form validation and server replies). */
export function Msg({ s }: { s: string }) {
  const [zh, en] = s.split("|");
  return <T zh={zh} en={en ?? zh} />;
}
