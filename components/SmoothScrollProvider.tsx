"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollSmoother } from "@/lib/gsap";

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: reduceMotion ? 0 : 1.2,
      effects: !reduceMotion,
      normalizeScroll: true,
    });

    return () => {
      smoother.kill();
      gsap.ticker.remove(smoother.render as unknown as (t: number) => void);
    };
  }, []);

  return (
    <div id="smooth-wrapper" ref={wrapperRef}>
      <div id="smooth-content">{children}</div>
    </div>
  );
}
