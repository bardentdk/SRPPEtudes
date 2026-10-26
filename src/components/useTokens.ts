"use client";

import { useEffect, useState } from "react";

// Leaflet et Recharts écrivent des attributs SVG/canvas, qui ne comprennent pas var(--x) :
// on lit donc les valeurs résolues des tokens, et on les relit à chaque changement de thème.
const NAMES = { ink: "--ink", ink2: "--ink-2", muted: "--muted", surface: "--surface", grid: "--grid", axis: "--axis", s1: "--s1", s2: "--s2", s3: "--s3", s4: "--s4" } as const;
export type Tokens = Record<keyof typeof NAMES, string>;

const FALLBACK: Tokens = { ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", surface: "#fcfcfb", grid: "#e1e0d9", axis: "#c3c2b7", s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100" };

function read(): { tokens: Tokens; dark: boolean } {
  const css = getComputedStyle(document.documentElement);
  const tokens = Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [k, css.getPropertyValue(v).trim()])) as Tokens;
  return { tokens, dark: css.colorScheme === "dark" };
}

export function useTokens() {
  const [state, setState] = useState({ tokens: FALLBACK, dark: false });
  useEffect(() => {
    const update = () => setState(read());
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);
  return state;
}
