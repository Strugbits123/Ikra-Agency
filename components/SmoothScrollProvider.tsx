"use client";

import { useEffect, useRef } from "react";
import { ScrollSmoother } from "@/lib/gsap";
import ScrollBar from "./ScrollBar";

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
    };
  }, []);

  return (
    <>
      <div id="smooth-wrapper" ref={wrapperRef}>
        <div id="smooth-content">{children}</div>
      </div>
      {/* Belongs to the scroll system rather than to the page: it reads the
          smoother's position, and the native scrollbar it stands in for is hidden
          unconditionally in globals.css, so it has to be mounted wherever the
          smoother is. It portals itself out to document.body — see the component
          — so where it sits in this tree costs nothing. */}
      <ScrollBar />
    </>
  );
}
