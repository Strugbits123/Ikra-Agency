"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 * 29% and its top edge at 48% of the viewport (the right panel mirrors it), so
 * the two wedges straddle the middle of the screen and the band bridges them.
 *
 * DOOR_REST_X is the one knob for how much orange stays on screen: less travel
 * leaves wider wedges and so a shorter span for the ribbon to cross. The
 * ribbon's ends follow automatically — both BAND_INSET and the geometry below
 * are derived from these, never restated — so widening the wedges cannot pull
 * the wave off their corners.
 */
const DOOR_PANEL_W = 0.58;
const DOOR_REST_X = 0.29;
const DOOR_REST_Y = 0.73;

/**
 * The band spans the gap between the doors' resting inner edges — derived from
 * the numbers above rather than restated, so the two cannot drift apart — and
 * tucks 2px under each panel instead of butting against it, so no rounding
 * difference can show a hairline of background between the orange shapes. Same
 * trick the doors already use to overlap each other while closed.
 */
const BAND_INSET = `calc(${((DOOR_PANEL_W - DOOR_REST_X) * 100).toFixed(2)}% - 2px)`;

const WAVE_TEXT = "holding your business back";
/**
 * Gap between repetitions of the phrase. Written as escapes because these are
 * non-breaking spaces on purpose: SVG collapses runs of ordinary whitespace,
 * which would shrink the gap to a single space.
 */
const WAVE_TEXT_GAP = "\u00a0\u00a0\u00a0";
/** How fast the copy travels right-to-left along the ribbon, in px per second. */
const MARQUEE_SPEED = 55;

/** Gap between the ribbon's box and the closing line beneath it, in px. */
const LEAP_GAP = 56;
/** Cubics emitted per half wave. Three tracks a sine to well under a pixel. */
const SAMPLES_PER_HUMP = 3;

/**
 * Everything about the ribbon, derived from the stage it sits on.
 *
 * The whole thing is arranged so both ends land EXACTLY on the door wedges'
 * inner corners: the left cap's top edge on the left wedge's top edge, the
 * right cap's bottom edge on the right wedge's bottom edge. That is achieved by
 * describing the centre line as a straight baseline between those two anchor
 * points plus a sine — because sin() is zero at both ends for any whole number
 * of half waves, the oscillation never disturbs where the ends actually land,
 * no matter how pronounced it gets. Amplitude and hump count are therefore free
 * to be tuned for looks without ever reopening a gap.
 */
function bandGeometry(stageW: number, stageH: number) {
  // Matches BAND_INSET, so the ribbon spans the gap and tucks 2px under each
  // wedge horizontally.
  const inset = (DOOR_PANEL_W - DOOR_REST_X) * stageW - 2;
  const width = stageW - inset * 2;

  // The wedges' horizontal edges. The left wedge exists only *below* its top
  // edge, the right wedge only *above* its bottom edge — which is exactly why
  // the ends have to be pinned rather than merely overlapped.
  const leftEdge = (DOOR_REST_Y - 0.25) * stageH;
  const rightEdge = (1.25 - DOOR_REST_Y) * stageH;

  // Scales faster than the span now that the wedges are wider and the span is
  // shorter, so the copy inside doesn't shrink with it.
  const thickness = gsap.utils.clamp(44, 76, width * 0.072);
  const fontSize = thickness * 0.55;
  /**
   * Half waves across the span; each one is a visible crest or trough. Must
   * stay a whole number — that is what puts sin() at exactly zero on both ends
   * and so pins the ribbon to the wedge corners.
   */
  const humps = Math.round(gsap.utils.clamp(3, 8, width / 165));

  // Centre line at each end, offset half a thickness inward so it is the ribbon
  // *edges* that meet the wedge corners.
  const startY = leftEdge + thickness / 2;
  const endY = rightEdge - thickness / 2;
  const slope = (endY - startY) / width;

  /**
   * Deliberately gentle: held to 15–25px so the crests read clearly without
   * overwhelming the copy riding on them. The second term is a safety ceiling
   * rather than the usual driver — a sine's steepest slope is A·humps·π/width,
   * and past roughly 40° the glyphs (which rotate with the path) begin pushing
   * out through the ribbon's edges. It only binds on a narrow phone span, where
   * the humps are short enough that even 15px would tilt too hard.
   */
  const amplitude = Math.min(
    gsap.utils.clamp(15, 25, thickness * 0.42),
    (Math.max(0, 0.85 - Math.abs(slope)) * width) / (humps * Math.PI),
  );

  /**
   * Solved rather than assumed. Because the baseline tilts, the wave's true
   * extremes are NOT `min/max(startY, endY) ± amplitude` — a sine peak lands
   * where the baseline has already risen part way, so that guess leaves dead
   * space in the box and makes `height` (and so the LEAP_GAP measured from it)
   * lie about where the ribbon really ends.
   *
   * c'(x) = slope − A·ω·cos(ωx), so the turning points are wherever
   * cos(ωx) = slope/(A·ω). Checking those plus the two ends gives the exact
   * extent — a sampled scan would undershoot it by a fraction of a pixel and
   * clip the tip of the sharpest crest.
   */
  const omega = (humps * Math.PI) / width;
  const centreAt = (x: number) =>
    startY + slope * x - amplitude * Math.sin(omega * x);
  const turningPoints = [0, width];
  const ratio = amplitude * omega === 0 ? 2 : slope / (amplitude * omega);
  if (Math.abs(ratio) <= 1) {
    const base = Math.acos(ratio);
    for (const phase of [base, -base]) {
      for (let n = 0; n <= humps + 1; n++) {
        const x = (phase + 2 * Math.PI * n) / omega;
        if (x > width) break;
        if (x >= 0) turningPoints.push(x);
      }
    }
  }
  const centres = turningPoints.map(centreAt);
  const top = Math.min(...centres) - thickness / 2;
  const bottom = Math.max(...centres) + thickness / 2;

  if (process.env.NODE_ENV !== "production") {
    // The end-alignment guarantee, asserted rather than trusted. It rests on
    // `humps` being a whole number (so the sine is exactly zero at both ends)
    // and on startY/endY staying derived from the wedge edges. Break either and
    // this says so, instead of it surfacing as a hairline notch on screen that
    // only shows up at some viewport sizes.
    const endsOnAxis = Math.abs(Math.sin(omega * width)) < 1e-9;
    const leftFlush = Math.abs(centreAt(0) - thickness / 2 - leftEdge) < 1e-6;
    const rightFlush =
      Math.abs(centreAt(width) + thickness / 2 - rightEdge) < 1e-6;
    if (!endsOnAxis || !leftFlush || !rightFlush) {
      console.error(
        "[HeroNarrative] the ribbon's ends no longer meet the door wedges. " +
        "`humps` must stay a whole number, and startY/endY must stay derived " +
        "from the wedge edges.",
        { humps, endsOnAxis, leftFlush, rightFlush },
      );
    }
  }

  return {
    inset,
    width,
    thickness,
    fontSize,
    humps,
    amplitude,
    slope,
    startY,
    endY,
    top,
    height: bottom - top,
    /**
     * Drops the baseline below the centre line so the copy's visual mass, not
     * its baseline, rides the wave. Done in the path to avoid `dy` on a
     * textPath, which browsers disagree about.
     */
    baselineShift: fontSize * 0.3,
  };
}

type BandGeometry = ReturnType<typeof bandGeometry>;

/** The centre line at x, in the band's own coordinates. */
function waveY(g: BandGeometry, x: number) {
  return (
    g.startY -
    g.top +
    g.slope * x -
    g.amplitude * Math.sin((g.humps * Math.PI * x) / g.width)
  );
}

/** dy/dx of the same, so each emitted cubic gets the exact tangent. */
function waveSlope(g: BandGeometry, x: number) {
  return (
    g.slope -
    ((g.amplitude * g.humps * Math.PI) / g.width) *
    Math.cos((g.humps * Math.PI * x) / g.width)
  );
}

/**
 * One traversal of the wave as Hermite-matched cubics. `yOffset` shifts the
 * whole run, which is how both edges of the ribbon come from a single wave, and
 * `reverse` walks it back right-to-left to close the outline — retracing the
 * *same* curve rather than mirroring it, so the edges stay parallel and the
 * ribbon holds one thickness throughout.
 */
function waveRun(g: BandGeometry, yOffset: number, reverse: boolean) {
  const n = g.humps * SAMPLES_PER_HUMP;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = ((reverse ? n - i : i) / n) * g.width;
    const x1 = ((reverse ? n - i - 1 : i + 1) / n) * g.width;
    // Hermite → Bézier: control points a third of the run along each tangent.
    const d = (x1 - x0) / 3;
    parts.push(
      `C ${x0 + d} ${waveY(g, x0) + yOffset + waveSlope(g, x0) * d} ${x1 - d} ${waveY(g, x1) + yOffset - waveSlope(g, x1) * d} ${x1} ${waveY(g, x1) + yOffset}`,
    );
  }
  return parts.join(" ");
}

/** The invisible line the copy rides along. */
const bandTextPath = (g: BandGeometry) =>
  `M 0 ${waveY(g, 0) + g.baselineShift} ${waveRun(g, g.baselineShift, false)}`;

/**
 * The ribbon: the same wave offset up and down by half its thickness. Its two
 * straight end caps sit at x=0 and x=width, and because of how startY/endY were
 * chosen they land flush against the wedges' corners.
 */
const bandOutlinePath = (g: BandGeometry) => {
  const half = g.thickness / 2;
  return [
    `M 0 ${waveY(g, 0) - half}`,
    waveRun(g, -half, false),
    `L ${g.width} ${waveY(g, g.width) + half}`,
    waveRun(g, half, true),
    "Z",
  ].join(" ");
};

/**
 * Slim orange ribbon spanning the gap between the doors, with the copy running
 * along its wave and marqueeing right-to-left forever.
 *
 * The copy sits on an SVG textPath rather than being split into positioned
 * spans, which is what tilts each character tangent to the wave, and it makes
 * containment structural instead of a padding calculation: a glyph that ran
 * past either end of the path simply isn't rendered.
 */
function WavyBand({ g, animate }: { g: BandGeometry; animate: boolean }) {
  const textPathRef = useRef<SVGTextPathElement>(null);
  // Sanitised: useId's output contains colons, which are legal in an id but
  // awkward in a URL fragment.
  const pathId = `band-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Enough repetitions to overfill the path, so there is still copy arriving at
  // the right-hand end after a full repetition has scrolled off the left.
  const repeats = Math.max(
    2,
    Math.ceil(g.width / (WAVE_TEXT.length * g.fontSize * 0.55)) + 2,
  );

  useEffect(() => {
    const textPath = textPathRef.current;
    if (!animate || !textPath || !repeats) return;

    let tween: ReturnType<typeof gsap.to> | null = null;
    let cancelled = false;

    // Measure only once the webfont has settled: a fallback-font measurement
    // would make the loop length wrong and put a visible jump in every repeat.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const oneRepeat = textPath.getComputedTextLength() / repeats;
      if (!oneRepeat) return;
      // Shifting by exactly one repetition lands on an identical-looking frame,
      // so a plain linear repeat loops seamlessly instead of snapping back.
      tween = gsap.to(textPath, {
        attr: { startOffset: -oneRepeat },
        duration: oneRepeat / MARQUEE_SPEED,
        ease: "none",
        repeat: -1,
      });
    });

    return () => {
      cancelled = true;
      tween?.revert();
    };
  }, [animate, repeats, g.width, g.fontSize]);

  return (
    <>
      {/* The copy is repeated to fill the ribbon, so it is announced once here
          and the drawing itself is hidden from assistive tech. */}
      <span className="sr-only">{WAVE_TEXT}</span>
      <svg
        aria-hidden
        className="block w-full"
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <path id={pathId} d={bandTextPath(g)} fill="none" />
        </defs>
        <path d={bandOutlinePath(g)} fill="var(--color-accent)" />
        <text fill="#ffffff" fontSize={g.fontSize} fontWeight={500}>
          <textPath ref={textPathRef} href={`#${pathId}`} startOffset={0}>
            {`${WAVE_TEXT}${WAVE_TEXT_GAP}`.repeat(repeats)}
          </textPath>
        </text>
      </svg>
    </>
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
  <p className="text-[20px] leading-[1.3] font-normal text-ink md:text-[52px]">
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
 *  0.40–0.50  the wavy orange ribbon draws itself in from left to right (a
 *             clip, not a fade), bridging the two resting wedges so ribbon and
 *             doors read as one continuous form. Kept to a tenth of the pin so
 *             a single scroll completes it.
 *  0.53–0.63  "until you make the leap" fades in below the ribbon.
 *  0.63–1.00  hold — nothing scroll-driven moves. The ribbon's copy marquees
 *             along the wave on its own timeline and keeps going regardless.
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
  // The ribbon's placement is pinned to the door wedges' corners, so it needs
  // the stage's real size — both axes — not just its own width.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setStageBox({ w: el.offsetWidth, h: el.offsetHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const band =
    stageBox.w > 0 && stageBox.h > 0
      ? bandGeometry(stageBox.w, stageBox.h)
      : null;

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

          // --- Phase 4: the ribbon draws itself in, left to right (0.40–0.50) ---
          // A clip rather than a fade, so it reads as the wave travelling
          // across the gap. Deliberately a tight window — a tenth of the pin,
          // ~60vh — so one continuous scroll takes it from nothing to full
          // width instead of needing several.
          const drawP = gsap.utils.clamp(0, 1, (raw - 0.4) / 0.1);
          gsap.set(wavyRef.current, {
            clipPath: `inset(0 ${(1 - drawP) * 100}% 0 0)`,
          });

          // --- Phase 5: the closing line follows it (0.53 – 0.63) ---
          gsap.set(leapRef.current, {
            opacity: gsap.utils.clamp(0, 1, (raw - 0.53) / 0.1),
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

          {reducedMotion && (
            /* Nothing animates here, so the opening copy — which the scrolled
               version fades out — has to live somewhere it won't collide with
               the ribbon, which is pinned to the wedges in both modes. */
            <div className="absolute inset-x-8 top-[10%] z-20 text-center md:inset-x-16">
              {GAP_COPY}
            </div>
          )}

          {!reducedMotion && (
            <div
              ref={contentRef}
              className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-8 text-center opacity-0"
            >
              {GAP_COPY}
            </div>
          )}

          {band && (
            <>
              {/* Placed at the geometry's own `top`, not centred, because its
                ends have to meet the wedge corners exactly. The clip is what
                draws it in left-to-right on scroll; reduced motion just shows
                it whole. */}
              <div
                ref={wavyRef}
                className="pointer-events-none absolute z-20"
                style={{
                  left: BAND_INSET,
                  right: BAND_INSET,
                  top: band.top,
                  clipPath: reducedMotion ? undefined : "inset(0 100% 0 0)",
                }}
              >
                <WavyBand g={band} animate={!reducedMotion} />
              </div>

              <div
                ref={leapRef}
                className="pointer-events-none absolute z-20 text-center"
                style={{
                  left: BAND_INSET,
                  right: BAND_INSET,
                  top: band.top + band.height + LEAP_GAP,
                  opacity: reducedMotion ? 1 : 0,
                }}
              >
                {LEAP_COPY}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
