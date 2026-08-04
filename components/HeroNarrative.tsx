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
 * Where the doors come to rest, as fractions of the viewport. The opening
 * motion itself is the original diagonal one — left down-and-left, right
 * up-and-right — and only the endpoint is new: the panels stop here instead of
 * carrying on out of frame, leaving orange wedges in the bottom-left and
 * top-right corners permanently.
 *
 * With a panel DOOR_PANEL_W wide, these land the left panel's inner edge at
 * 23% and its top edge at 48% of the viewport (the right panel mirrors it), so
 * the two wedges straddle the middle of the screen and the band bridges them.
 */
const DOOR_PANEL_W = 0.58;
const DOOR_REST_X = 0.35;
const DOOR_REST_Y = 0.73;

/**
 * The band spans the gap between the doors' resting inner edges — derived from
 * the numbers above rather than restated, so the two cannot drift apart — and
 * tucks 2px under each panel instead of butting against it, so no rounding
 * difference can show a hairline of background between the orange shapes. Same
 * trick the doors already use to overlap each other while closed.
 */
const BAND_INSET = `calc(${((DOOR_PANEL_W - DOOR_REST_X) * 100).toFixed(2)}% - 2px)`;

const WAVE_TEXT = "Holding your business back";
/** Half-wavelength of the band's undulating top and bottom edges, in px. */
const WAVE_STEP = 78;
/** How far crests and troughs push past the band's flat edge, in px. */
const WAVE_DEPTH = 12;
/** Per-character rise of the running text wave, in px. */
const WAVE_TEXT_RISE = 10;
/** Seconds for one full up-and-down cycle of a single character. */
const WAVE_TEXT_CYCLE = 1.7;
/** Seconds between neighbouring characters — what makes the wave travel. */
const WAVE_TEXT_STAGGER = 0.065;

/**
 * The band's outline: a rectangle whose top and bottom edges undulate.
 * Generated from the measured box rather than stretching one fixed viewBox
 * with preserveAspectRatio="none", so the waves keep the same wavelength and
 * depth at every viewport width instead of smearing out on wide screens — and
 * so they regenerate at the right size when the copy wraps to a second line.
 */
function wavyBandPath(w: number, h: number) {
  const halfWaves = Math.max(4, Math.round(w / WAVE_STEP));
  const step = w / halfWaves;
  // A quadratic control point pushed two depths past the mid-line peaks at
  // exactly one depth, so crests land on y=0 and troughs on y=2*WAVE_DEPTH.
  const edge = (midY: number, from: number, to: number, i: number) =>
    `Q ${(from + to) / 2} ${midY + (i % 2 === 0 ? -1 : 1) * WAVE_DEPTH * 2} ${to} ${midY}`;

  const parts = [`M 0 ${WAVE_DEPTH}`];
  for (let i = 0; i < halfWaves; i++) {
    parts.push(edge(WAVE_DEPTH, i * step, (i + 1) * step, i));
  }
  parts.push(`L ${w} ${h - WAVE_DEPTH}`);
  for (let i = halfWaves; i > 0; i--) {
    parts.push(edge(h - WAVE_DEPTH, i * step, (i - 1) * step, i));
  }
  return `${parts.join(" ")} Z`;
}

/**
 * Orange band with wavy edges, spanning the whole gap the doors leave behind,
 * with the headline running a continuous wave inside it. Only the characters
 * move — the band itself never scales or distorts — and the vertical padding
 * is deliberately deeper than the troughs plus the character rise, so the
 * text can never touch, let alone escape, the wavy outline.
 */
function WavyBand({ animate }: { animate: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setBox({ w: el.offsetWidth, h: el.offsetHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animate) return;
    const el = boxRef.current;
    if (!el) return;
    const chars = gsap.utils.toArray<HTMLElement>(
      el.querySelectorAll("[data-wave-char]"),
    );
    if (!chars.length) return;

    const ctx = gsap.context(() => {
      // Stagger + yoyo + repeat is what turns a plain rise into a travelling
      // wave: every character runs the same tween, each one late by a fixed
      // offset. It owns its own timeline, so it keeps going during the scroll
      // holds and never touches the scrubbed ScrollTrigger.
      gsap.to(chars, {
        y: -WAVE_TEXT_RISE,
        duration: WAVE_TEXT_CYCLE / 2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: WAVE_TEXT_STAGGER },
      });
    });
    return () => ctx.revert();
  }, [animate]);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden px-10 py-12 text-center md:px-16 md:py-14"
    >
      {box.w > 0 && (
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${box.w} ${box.h}`}
          preserveAspectRatio="none"
        >
          <path d={wavyBandPath(box.w, box.h)} fill="var(--color-accent)" />
        </svg>
      )}
      {/* `relative` (not a z-index) keeps the copy above the absolutely
          positioned outline: both are z-auto, so paint order is DOM order. */}
      <p className="relative text-[32px] leading-[1.15] font-medium text-white md:text-[48px] lg:text-[64px]">
        {/* Splitting into characters destroys the text for a screen reader,
            so the real sentence is announced once and the pieces are hidden. */}
        <span className="sr-only">{WAVE_TEXT}</span>
        {WAVE_TEXT.split("").map((char, i) => (
          <span
            key={i}
            aria-hidden
            data-wave-char
            className="inline-block whitespace-pre"
          >
            {char}
          </span>
        ))}
      </p>
    </div>
  );
}

const GAP_COPY = (
  <>
    <p className="text-[45px] leading-[1.15] font-medium text-ink md:text-[94.6px]">
      growth creates a gap
    </p>
    <p className="mt-5 max-w-2xl text-[22px] leading-[1.3] font-light text-ink/80 md:text-[35.6px]">
      between who you&apos;ve become and how the world sees you
    </p>
  </>
);

const LEAP_COPY = (
  <p className="mt-12 text-[20px] leading-[1.3] font-normal text-ink md:mt-14 md:text-[32px]">
    until you <span className="text-accent">make the leap</span>
  </p>
);

/**
 * One continuous pinned sequence — no seam between "hero" and "reveal"
 * because there is no second section: it's all one sticky stage and one
 * scrubbed ScrollTrigger, so scrolling back up reverses every phase.
 *
 * Phases (as fractions of total scroll through the pin):
 *  0.00–0.22  the clip shrinks from its resting size down to nothing,
 *             dissolving over the tail; the hero headline fades out with it.
 *  0.22–0.30  the clip is gone and the doors beneath it are still closed, so
 *             the screen is one unbroken orange surface — "growth creates a
 *             gap" fades up on it, ink on orange.
 *  0.30–0.45  the doors open diagonally, exactly as they always did (right
 *             up-and-right, left down-and-left), but stop partway instead of
 *             leaving — orange wedges stay in the bottom-left and top-right
 *             corners for good; "growth creates a gap" fades out as they go.
 *  0.40–0.60  the wavy orange band fades in, bridging the gap between the two
 *             resting wedges so band and doors read as one continuous form.
 *  0.55–0.75  "until you make the leap" fades in below the band.
 *  0.75–1.00  hold — nothing scroll-driven moves. The band's per-character
 *             wave runs on its own timeline and keeps going regardless.
 *
 * Layering (back to front): background image/video, the orange doors, the
 * wavy band and its copy, then the header and hero copy above everything.
 */
export default function HeroNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wavyRef = useRef<HTMLDivElement>(null);
  const leapRef = useRef<HTMLDivElement>(null);
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

    if (reducedMotion) {
      // No ScrollTrigger runs in this mode, so nothing would ever reveal the
      // centre copy. It renders as a plain static column instead (see the JSX),
      // which needs no GSAP at all — only the clip and the hero headline, both
      // of which exist purely to be animated, have to be hidden here.
      gsap.set(headline, { opacity: 0 });
      gsap.set(box, { opacity: 0 });
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
          // would snap the clip straight to its resting size, cutting the
          // entrance animation short.
          if (!introDoneRef.current) return;

          const raw = self.progress;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;

          // --- Phase 1: the clip shrinks away to nothing (0 – 0.22) ---
          // Driven by `scale`, not width/height: it costs no layout work,
          // holds the clip's aspect ratio on the way down, picks up exactly
          // where the entrance timeline's scale 0 → 1 left off, and stays
          // correct across resizes without re-measuring the resting box.
          const shrinkP = gsap.utils.clamp(0, 1, raw / 0.22);
          gsap.set(box, {
            xPercent: -50,
            yPercent: -50,
            scale: 1 - shrinkP,
            // Dissolve over the tail so it leaves cleanly instead of pinching
            // down to a sub-pixel sliver.
            opacity: 1 - gsap.utils.clamp(0, 1, (shrinkP - 0.7) / 0.3),
          });

          // Headline fades out over the tail of the shrink.
          gsap.set(headlineRef.current, {
            opacity: 1 - gsap.utils.clamp(0, 1, (raw - 0.1) / 0.12),
          });

          // The logo ends up sitting over the revealed background, so it goes
          // ink → white as the clip disappears — well before the doors part.
          // (This used to be driven by the growing clip passing behind the
          // logo, which can't happen now that the clip only ever shrinks.)
          gsap.set(logoRef.current, {
            backgroundColor: gsap.utils.interpolate(
              "#390303",
              "#ffffff",
              gsap.utils.clamp(0, 1, (raw - 0.18) / 0.1),
            ),
          });

          // --- Phase 2: the screen is solid orange (0.22 – 0.30) — the clip
          // is gone and the doors are still closed. "growth creates a gap"
          // fades up on it, so the beat carries the copy instead of being an
          // empty pause.

          // --- Phase 3: doors open diagonally, then stop (0.30 – 0.45) ---
          // The original motion, unchanged in character: each panel slides out
          // while drifting vertically, with the drift finishing ahead of the
          // slide (hence `drift` running on doorP/0.7). The only difference is
          // where it ends — at DOOR_REST_*, so both panels stay on screen as
          // corner wedges instead of carrying on out of frame.
          const doorP = gsap.utils.clamp(0, 1, (raw - 0.3) / 0.15);
          const drift = gsap.utils.clamp(0, 1, doorP / 0.7);
          gsap.set(panelLeftRef.current, {
            x: -doorP * W * DOOR_REST_X,
            y: drift * H * DOOR_REST_Y,
          });
          gsap.set(panelRightRef.current, {
            x: doorP * W * DOOR_REST_X,
            y: -drift * H * DOOR_REST_Y,
          });

          // The hero copy is an opening state now rather than the payload of
          // the reveal: up on the orange, then out again as the doors part.
          // Opacity only, no movement, and both lines go together.
          gsap.set(contentRef.current, {
            opacity: Math.min(
              gsap.utils.clamp(0, 1, (raw - 0.22) / 0.08),
              1 - doorP,
            ),
          });

          // --- Phase 4: the wavy band fades in (0.40 – 0.60) ---
          gsap.set(wavyRef.current, {
            opacity: gsap.utils.clamp(0, 1, (raw - 0.4) / 0.2),
          });

          // --- Phase 5: the closing line follows it (0.55 – 0.75) ---
          gsap.set(leapRef.current, {
            opacity: gsap.utils.clamp(0, 1, (raw - 0.55) / 0.2),
          });

          // --- Phase 6: hold (0.75 – 1.0) — nothing scroll-driven changes;
          // the pin stays engaged so there's time to read before release. The
          // band's character wave carries on under its own timeline.
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
      style={{ height: reducedMotion ? "100vh" : "600vh" }}
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
            seam) and so the diagonal drift never exposes a panel's short edge,
            sitting under the clip until it shrinks away, then opening to
            DOOR_REST_* and staying put as corner wedges. In reduced motion
            they are rendered already parked — the same offsets expressed in
            vw/vh, since there is no ScrollTrigger to drive them. */}
          <div
            ref={panelLeftRef}
            className="absolute -top-1/4 left-0 z-10 h-[150%] bg-accent"
            style={{
              width: `${DOOR_PANEL_W * 100}%`,
              transform: reducedMotion
                ? `translate(${-DOOR_REST_X * 100}vw, ${DOOR_REST_Y * 100}vh)`
                : undefined,
            }}
          />
          <div
            ref={panelRightRef}
            className="absolute -top-1/4 right-0 z-10 h-[150%] bg-accent"
            style={{
              width: `${DOOR_PANEL_W * 100}%`,
              transform: reducedMotion
                ? `translate(${DOOR_REST_X * 100}vw, ${-DOOR_REST_Y * 100}vh)`
                : undefined,
            }}
          />

          {/* Small clip that shrinks away as you scroll, uncovering nothing
            but the closed orange doors it sits on — so the screen simply
            "becomes orange" once it's gone. */}
          <div
            ref={videoBoxRef}
            className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-75 min-w-35 scale-0 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
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

          {reducedMotion ? (
            /* Nothing animates, so the whole centre reads as one static
               column: the opening copy the scroll version fades out, the band,
               and the closing line. Laid out in flow so they stack instead of
               overlapping the way the two scroll-driven layers do. */
            <div
              className="absolute inset-y-0 z-20 flex flex-col items-center justify-center text-center"
              style={{ left: BAND_INSET, right: BAND_INSET }}
            >
              {GAP_COPY}
              <div className="mt-10 w-full">
                <WavyBand animate={false} />
              </div>
              {LEAP_COPY}
            </div>
          ) : (
            <>
              <div
                ref={contentRef}
                className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center opacity-0"
              >
                {GAP_COPY}
              </div>

              {/* Inset to the doors' resting width so the band lands exactly in
                the gap between them, and centred as one group with the closing
                line so the pair sits together rather than the band alone. */}
              <div
                className="pointer-events-none absolute inset-y-0 z-20 flex flex-col items-center justify-center"
                style={{ left: BAND_INSET, right: BAND_INSET }}
              >
                <div ref={wavyRef} className="w-full opacity-0">
                  <WavyBand animate />
                </div>
                <div ref={leapRef} className="text-center opacity-0">
                  {LEAP_COPY}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
