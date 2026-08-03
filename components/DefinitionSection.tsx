"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useRevealOnView } from "@/lib/useRevealOnView";

function RevealBlock({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, revealed } = useRevealOnView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

const DICTIONARY_CONTENT = (
  <>
    <p className="text-lg font-light text-ink/80 italic md:text-xl">
      /ɪˈkrɑ/ <span className="not-italic">noun, uncount.</span>
    </p>
    <p className="mt-2 text-base font-light text-ink/60">
      from Russian икра (caviar)
    </p>

    <p className="mt-8 text-[26px] leading-[1.3] font-medium text-accent md:text-[34px]">
      The rarest expression of refined taste
    </p>

    <p className="mt-6 text-base leading-[1.3] font-light text-ink/80 md:text-lg">
      it transforms a simple moment into an experience of true rarity and
      prestige.
    </p>

    <div className="mt-8 border-t border-ink/20 pt-4 text-sm font-light text-ink/60">
      <p>synonyms — rarity, distinction, upstream thinking</p>
      <p className="mt-1">antonyms — filler, mass-market, downstream</p>
    </div>
  </>
);

/**
 * The "ikra." wordmark's dot as a photo that grows into a full-screen circle
 * reveal — the wordmark stays put (pinned, not sliding), the circle behind
 * "kra" expands until it covers the whole viewport, then the pin releases
 * into the footer. Pinned with GSAP rather than CSS `sticky`, which does not
 * work under ScrollSmoother's transform-based fake scroll (see the note in
 * HeroNarrative).
 */
export default function DefinitionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const dictionaryRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const circle = circleRef.current;
    if (!section || !stage || !circle) return;

    const ctx = gsap.context(() => {
      // Circle's resting diameter, unaffected by the scale transform we're
      // about to apply to it.
      const baseSize = parseFloat(getComputedStyle(circle).width) || 1;
      // The circle's on-screen horizontal centre is stable regardless of
      // pin state (the stage is always full viewport width via `w-full`,
      // pinned or not), so it's safe to measure once up front. Its vertical
      // centre is NOT safe to measure yet — before the pin engages the stage
      // still sits at its normal (unpinned) document position, possibly
      // thousands of pixels down the page. Once pinned, `items-center` on an
      // exactly-h-screen stage puts it at H/2, so that's used directly
      // instead of a live measurement.
      const cx = circle.getBoundingClientRect().x + baseSize / 2;

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: stage,
        pinSpacing: false,
        onUpdate(self) {
          const raw = self.progress;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;
          const cy = H / 2;
          // Exact farthest-corner distance from the circle's true centre,
          // not a generic diagonal-based guess — guarantees coverage with a
          // known, deliberate margin rather than hoping a heuristic holds
          // across every aspect ratio.
          const corners = [
            [0, 0],
            [W, 0],
            [0, H],
            [W, H],
          ];
          const maxCornerDist = Math.max(
            ...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)),
          );
          const requiredDiameter = maxCornerDist * 2 * 1.15; // 15% margin
          const maxScale = requiredDiameter / baseSize;

          // 0–0.2: editorial statement + resting wordmark.
          // 0.2–0.8: circle grows to full coverage.
          // 0.8–1.0: hold, fully covered, right before the footer.
          const growP = gsap.utils.clamp(0, 1, (raw - 0.2) / 0.6);
          gsap.set(circle, { scale: 1 + (maxScale - 1) * growP });

          // Dictionary copy: in once the wordmark's had a moment on screen,
          // out again before the circle finishes covering everything.
          const dictIn = gsap.utils.clamp(0, 1, (raw - 0.3) / 0.15);
          const dictOut = 1 - gsap.utils.clamp(0, 1, (raw - 0.75) / 0.15);
          const dictOpacity = Math.min(dictIn, dictOut);
          gsap.set(dictionaryRef.current, {
            opacity: dictOpacity,
            y: (1 - dictIn) * 16,
          });
        },
      });
      return () => trigger.kill();
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-gray"
      style={{ height: reducedMotion ? "auto" : "300vh" }}
    >
      <div className="px-8 pt-24 pb-12 md:px-16 md:pt-32">
        <RevealBlock>
          <p className="max-w-4xl text-[26px] leading-[1.3] font-normal text-ink md:text-[39px]">
            We are rebranding agency for the most discerning ambitions. Our
            work transforms a simple idea into an experience of true rarity
            and prestige.
          </p>
        </RevealBlock>
      </div>

      <div
        ref={stageRef}
        className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      >
        <div className="relative inline-flex items-baseline text-[140px] leading-none font-medium text-accent md:text-[280px]">
          ikra
          {!reducedMotion && (
            <div
              ref={circleRef}
              aria-hidden
              className="relative ml-[0.05em] inline-block overflow-hidden rounded-full align-baseline"
              style={{ width: "0.85em", height: "0.85em" }}
            >
              <Image
                src="/img/section3-spoon.jpg"
                alt=""
                fill
                className="object-cover"
                sizes="50vw"
              />
            </div>
          )}
        </div>
      </div>

      {reducedMotion ? (
        <div className="px-8 pb-24 md:px-16">
          <RevealBlock className="max-w-md">{DICTIONARY_CONTENT}</RevealBlock>
        </div>
      ) : (
        <div
          ref={dictionaryRef}
          className="pointer-events-none absolute right-8 max-w-md opacity-0 md:right-16"
          style={{ top: "170vh" }}
        >
          {DICTIONARY_CONTENT}
        </div>
      )}
    </section>
  );
}
