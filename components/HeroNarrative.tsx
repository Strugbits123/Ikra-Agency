"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import Logo from "./Logo";

/**
 * Drop the reveal footage at this path and set the constant to enable it.
 * Until then the still stands in — same container, same object-fit, so
 * switching is a one-line change with no layout impact.
 */
const BACKGROUND_VIDEO_SRC: string | null = null;

/**
 * One continuous pinned sequence — no seam between "hero" and "reveal"
 * because there is no second section: it's all one sticky stage and one
 * scrubbed ScrollTrigger, so scrolling back up reverses every phase.
 *
 * Phases (as fractions of total scroll through the pin):
 *  0.00–0.22  the clip grows from its small resting size to fill the screen;
 *             the hero headline fades out over the tail of this.
 *  0.22–0.30  the clip fades out, revealing the closed orange doors beneath
 *             it — the screen reads as solid orange again.
 *  0.30–0.62  the doors slide apart diagonally (right up-and-right, left
 *             down-and-left), revealing the background behind them; the
 *             "growth creates a gap" copy scales up from the centre.
 *  0.62–1.00  hold — doors gone, copy fully visible, nothing moves. The pin
 *             stays engaged through this so there's real time to read before
 *             it releases into the next section.
 *
 * Layering (back to front): background image/video, the orange doors (at
 * rest they overlap and overhang, so the closed state is one unbroken
 * surface with no seams), the growing clip on top of the doors, then the
 * header/copy above everything.
 */
export default function HeroNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const introDoneRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setMounted(true);
  }, []);

  // Load sequence (plays once, not scroll-driven): the clip opens from
  // nothing, then the headline fades in.
  useEffect(() => {
    if (!mounted) return;
    const box = videoBoxRef.current;
    const headline = headlineRef.current;
    if (!box || !headline) return;

    // Measure the resting size before anything animates it — the
    // scroll-driven grow below reuses these numbers. Computed style (not
    // getBoundingClientRect) on purpose: the box carries a `scale-0` class by
    // default (so there's nothing to flash before this effect runs), and
    // getBoundingClientRect reports the post-transform, on-screen size — 0×0
    // while scaled to nothing. Computed width/height reflect the underlying
    // layout box, which `scale` never touches.
    const computed = getComputedStyle(box);
    box.dataset.restWidth = String(parseFloat(computed.width));
    box.dataset.restHeight = String(parseFloat(computed.height));

    if (reducedMotion) {
      // No ScrollTrigger runs in this mode, so nothing else ever reveals the
      // "growth creates a gap" copy — show everything at once instead of a
      // pinned reveal.
      gsap.set(headline, { opacity: 0 });
      gsap.set(box, { opacity: 0 });
      gsap.set(contentRef.current, { opacity: 1, scale: 1 });
      introDoneRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      // xPercent/yPercent (not the Tailwind translate classes) do the
      // centering from here on — GSAP writes the whole `transform` inline
      // style whenever it touches `scale`, which would otherwise silently
      // wipe the class-based translate the instant this runs.
      gsap.set(box, {
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        transformOrigin: "center center",
      });
      gsap.set(headline, { opacity: 0, y: 16 });

      gsap
        .timeline({
          delay: 0.2,
          onComplete: () => {
            introDoneRef.current = true;
          },
        })
        .to(box, { scale: 1, duration: 0.9, ease: "power3.out" })
        .to(
          headline,
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
          "-=0.3",
        );
    });

    return () => ctx.revert();
  }, [reducedMotion, mounted]);

  // The single scroll-driven sequence covering every phase above.
  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const box = videoBoxRef.current;
    if (!section || !box) return;

    const ctx = gsap.context(() => {
      // Same reasoning as the load-sequence effect: fall back to computed
      // style, never getBoundingClientRect, since the box may still be
      // scaled to 0 (which reports as 0×0 on-screen) at this point.
      const computedFallback = getComputedStyle(box);
      const startWidth =
        Number(box.dataset.restWidth) || parseFloat(computedFallback.width);
      const startHeight =
        Number(box.dataset.restHeight) || parseFloat(computedFallback.height);
      const logoRect = logoRef.current?.getBoundingClientRect() ?? null;

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        // Plain CSS `sticky` does not work here: ScrollSmoother fakes
        // scrolling by translating #smooth-content via a transform rather
        // than a real scroll offset, and `sticky` never engages without an
        // actual scrolling ancestor. GSAP's own pin sets position:fixed via
        // JS and is scroll-implementation-agnostic, so it works regardless.
        pin: stageRef.current,
        pinSpacing: false,
        onUpdate(self) {
          // ScrollTrigger fires an onUpdate at creation; without this guard it
          // would snap the clip to full scale mid-entrance-animation.
          if (!introDoneRef.current) return;

          const raw = self.progress;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;

          // --- Phase 1: grow (0 – 0.22) ---
          const growP = gsap.utils.clamp(0, 1, raw / 0.22);
          const targetWidth = W;
          const targetHeight = H;
          const w = gsap.utils.interpolate(startWidth, targetWidth, growP);
          const h = gsap.utils.interpolate(startHeight, targetHeight, growP);
          gsap.set(box, {
            xPercent: -50,
            yPercent: -50,
            width: w,
            height: h,
            maxWidth: "none",
            maxHeight: "none",
            scale: 1,
          });

          if (logoRef.current && logoRect) {
            const boxLeft = (targetWidth - w) / 2;
            const boxTop = (targetHeight - h) / 2;
            const covered =
              boxLeft < logoRect.right && boxTop < logoRect.bottom;
            gsap.to(logoRef.current, {
              backgroundColor: covered ? "#ffffff" : "#390303",
              duration: 0.25,
              overwrite: "auto",
            });
          }

          // Headline fades out over the tail of the grow.
          gsap.set(headlineRef.current, {
            opacity: 1 - gsap.utils.clamp(0, 1, (raw - 0.1) / 0.12),
          });

          // --- Phase 2: clip fades out, doors show through (0.22 – 0.30) ---
          const fadeP = gsap.utils.clamp(0, 1, (raw - 0.22) / 0.08);
          gsap.set(box, { opacity: 1 - fadeP });

          // --- Phase 3: doors slide apart diagonally (0.30 – 0.62) ---
          const doorP = gsap.utils.clamp(0, 1, (raw - 0.3) / 0.32);
          const drift = gsap.utils.clamp(0, 1, doorP / 0.7);
          gsap.set(panelLeftRef.current, {
            x: -doorP * W * 0.65,
            y: drift * H * 0.5,
          });
          gsap.set(panelRightRef.current, {
            x: doorP * W * 0.65,
            y: -drift * H * 0.5,
          });

          // Copy emerges from the centre of the gap and keeps scaling up,
          // reaching full size well before the doors finish so it's never
          // half-hidden by the still-moving panels.
          gsap.set(contentRef.current, {
            opacity: gsap.utils.clamp(0, 1, (doorP - 0.15) / 0.35),
            scale: 0.4 + doorP * 0.7,
          });

          // --- Phase 4: hold (0.62 – 1.0) — nothing changes; the pin simply
          // stays engaged so there's time to read before release.
        },
      });

      return () => trigger.kill();
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  // Custom circle cursor, active only while pointing at this section.
  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const section = sectionRef.current;
    const cursor = cursorRef.current;
    if (!section || !cursor) return;

    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3" });

    function handleMove(e: MouseEvent) {
      xTo(e.clientX);
      yTo(e.clientY);
    }
    function handleEnter(e: MouseEvent) {
      xTo(e.clientX);
      yTo(e.clientY);
      gsap.to(cursor, { opacity: 1, duration: 0.2 });
    }
    function handleLeave() {
      gsap.to(cursor, { opacity: 0, duration: 0.2 });
    }

    section.addEventListener("mousemove", handleMove);
    section.addEventListener("mouseenter", handleEnter);
    section.addEventListener("mouseleave", handleLeave);
    return () => {
      section.removeEventListener("mousemove", handleMove);
      section.removeEventListener("mouseenter", handleEnter);
      section.removeEventListener("mouseleave", handleLeave);
    };
  }, [reducedMotion, mounted]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-accent [&_*]:!cursor-none cursor-none"
      style={{ height: reducedMotion ? "100vh" : "450vh" }}
    >
      {mounted &&
        !reducedMotion &&
        createPortal(
          <div
            ref={cursorRef}
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-50 h-6 w-6 rounded-full bg-white opacity-0"
          />,
          document.body,
        )}

      {/* GSAP pins this element directly (see the ScrollTrigger below) rather
          than relying on CSS `sticky`, which does not work here — see the
          note by the ScrollTrigger config for why. `relative` still gives
          next/image `fill` something to resolve against before pinning
          kicks in (and in the reduced-motion path, where nothing pins it). */}
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden">
      <div className="relative h-full w-full">
        {/* Background reveal, always present, uncovered once the doors move. */}
        {BACKGROUND_VIDEO_SRC ? (
          <video
            className="absolute inset-0 z-0 h-full w-full object-cover"
            src={BACKGROUND_VIDEO_SRC}
            poster="/img/hero-bg.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <Image
            src="/img/hero-bg.jpg"
            alt="Misty coastal cliffs at dawn"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}

        {/* Orange doors. Oversized so the closed state fully overlaps (no
            seam), sitting under the clip until it fades, then sliding apart
            to reveal the background above. */}
        {!reducedMotion && (
          <>
            <div
              ref={panelLeftRef}
              className="absolute -top-1/4 left-0 z-10 h-[150%] w-[58%] bg-accent"
            />
            <div
              ref={panelRightRef}
              className="absolute -top-1/4 right-0 z-10 h-[150%] w-[58%] bg-accent"
            />
          </>
        )}

        {/* Small clip that grows to fill the screen, then fades to reveal
            the doors (which are the same colour, so the fade reads as
            seamless — the screen simply "becomes orange"). */}
        <div
          ref={videoBoxRef}
          className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-[300px] min-w-[140px] scale-0 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/video/section2.mp4"
            poster="/img/section2-bg.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        <header className="absolute top-0 left-0 z-30 w-full px-8 py-8 md:px-16">
          <Logo
            ref={logoRef}
            className="w-[90px] md:w-[120px]"
            color="var(--color-ink)"
          />
        </header>

        <p
          ref={headlineRef}
          className="absolute top-1/2 left-1/2 z-30 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 px-8 text-center text-[32px] leading-[1.3] font-light text-white/80 opacity-0 md:text-[52px] lg:max-w-[1300px] lg:text-[68px]"
        >
          eventually, success becomes your
          <br />
          biggest branding problem
        </p>

        <div
          aria-hidden
          className="absolute bottom-8 left-1/2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/70"
        />

        <div
          ref={contentRef}
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center opacity-0"
        >
          <p className="text-[45px] leading-[1.15] font-medium text-ink md:text-[94.6px]">
            growth creates a gap
          </p>
          <p className="mt-5 max-w-2xl text-[22px] leading-[1.3] font-light text-ink/80 md:text-[35.6px]">
            between who you&apos;ve become and how the world sees you
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}
