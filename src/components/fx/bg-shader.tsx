"use client";

import { useEffect, useRef } from "react";
import type { ShaderMount } from "@paper-design/shaders";
import { rafThrottle } from "./motion";

/**
 * A fixed, low-contrast dithering texture that slowly flows; never animated
 * behind an opaque, dominant hero, nor while the works band or a hidden tab
 * would make it wasted work. Reduced motion keeps one still frame.
 */
export function BgShader() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false,
      mount: ShaderMount | null = null,
      lost = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const update = rafThrottle(() => {
      if (!mount || lost) return;
      // Also pages that paint their own full-screen backdrop ([data-bg-pause]).
      const hero = [
        ...document.querySelectorAll<HTMLElement>(".hero, [data-bg-pause]"),
      ].find((h) => h.getClientRects().length);
      const r = hero?.getBoundingClientRect();
      const heroDominates =
        r &&
        Math.min(innerHeight, r.bottom) - Math.max(0, r.top) >
          innerHeight * 0.55;
      // The existing particle mascot can enter while the hero is leaving.
      // Keep this material static while works is visible too: at most three
      // WebGL renderers animate even during that overlap.
      const works = [
        ...document.querySelectorAll<HTMLElement>(".works-wrap"),
      ].find((w) => w.getClientRects().length);
      const wr = works?.getBoundingClientRect();
      const worksVisible = wr && wr.bottom > 0 && wr.top < innerHeight;
      const pause =
        reduce.matches || document.hidden || heroDominates || worksVisible;
      // The texture flows on its own but no longer drifts with the scroll:
      // a background sliding under the content made scrolling feel slippery.
      mount.setSpeed(pause ? 0 : 0.18);
      el.dataset.paused = String(Boolean(pause));
    });
    const onLost = () => {
      lost = true;
      mount?.setSpeed(0);
      el.classList.remove("on");
    };
    const init = async () => {
      try {
        const {
          ShaderMount,
          ditheringFragmentShader,
          DitheringShapes,
          DitheringTypes,
          ShaderFitOptions,
          getShaderColorFromString: c,
        } = await import("@/lib/paper-shaders");
        if (cancelled) return;
        mount = new ShaderMount(
          el,
          ditheringFragmentShader,
          {
            u_colorBack: c("#050505"),
            u_colorFront: c("#161618"),
            u_shape: DitheringShapes.warp,
            u_type: DitheringTypes["8x8"],
            u_pxSize: 3,
            u_fit: ShaderFitOptions.none,
            u_scale: 0.55,
            u_rotation: 0,
            u_originX: 0.5,
            u_originY: 0.5,
            u_offsetX: 0,
            u_offsetY: 0,
            u_worldWidth: 0,
            u_worldHeight: 0,
          },
          undefined,
          0,
          0,
          1,
          1920 * 1080,
        );
        mount.canvasElement.addEventListener("webglcontextlost", onLost);
        el.classList.add("on");
        update();
      } catch {
        el.replaceChildren();
      }
    };
    // Give the initial content a frame before requesting the material chunk.
    const raf = requestAnimationFrame(() => {
      void init();
    });
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    reduce.addEventListener("change", update);
    const main = document.querySelector("main");
    const mo = new MutationObserver(update);
    if (main)
      mo.observe(main, {
        childList: true,
        subtree: true,
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      mo.disconnect();
      update.cancel();
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
      reduce.removeEventListener("change", update);
      mount?.canvasElement.removeEventListener("webglcontextlost", onLost);
      const gl = mount?.canvasElement.getContext("webgl2");
      mount?.dispose();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      el.classList.remove("on");
    };
  }, []);
  return (
    <>
      <div className="bg-shader" ref={ref} aria-hidden />
      <div className="bg-light" aria-hidden />
    </>
  );
}
