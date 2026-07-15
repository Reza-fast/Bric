"use client";

import { useEffect, useState } from "react";

/** Subscribe to a CSS media query. Returns `false` until mounted to avoid SSR mismatch. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsMobile(breakpointPx = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpointPx}px)`);
}
