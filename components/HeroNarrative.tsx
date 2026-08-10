"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import Logo from "./Logo";

// The footage behind the doors. /img/hero-bg.jpg stays underneath it as the base
// layer rather than being replaced, and this is fetched on an idle callback.
const BACKGROUND_VIDEO_SRC: string | null = "/video/waves.mp4";
/** How long to wait for an idle moment before fetching the footage anyway, in ms. */
const BACKGROUND_VIDEO_IDLE_TIMEOUT = 2500;
// How far the doors must be open before the footage is worth decoding. Just
// inside the ~0.28 where the overlapping panels first clear each other.
const BACKGROUND_VISIBLE_AT_DOOR = 0.25;

/**
 * Where the doors come to rest, as fractions of the viewport: they stop here
 * instead of leaving frame, parking as orange wedges in the bottom-left and
 * top-right corners. DOOR_REST_X is the one knob for how much orange stays.
 *
 * The panels are 58% wide each, so closed they overlap by 16% of the screen and
 * a gap only appears once doorP passes 8/29 ≈ 0.28 — "the doors are moving" and
 * "the doors are visibly opening" are different moments, and the copy is cued
 * off the second (see GAP_LINES).
 */
const DOOR_PANEL_W = 0.58;
const DOOR_REST_X = 0.29;
const DOOR_REST_Y = 0.73;

// Derived from the doors rather than restated, so the two cannot drift apart.
// Tucks 2px under each panel so no rounding can show a hairline between them.
const BAND_INSET = `calc(${((DOOR_PANEL_W - DOOR_REST_X) * 100).toFixed(2)}% - 2px)`;

const WAVE_TEXT = "holding your business back";
// Non-breaking on purpose: SVG collapses runs of ordinary whitespace.
const WAVE_TEXT_GAP = "\u00a0\u00a0\u00a0";
/** How fast the copy travels right-to-left along the ribbon, in px per second. */
const MARQUEE_SPEED = 55;

/**
 * The rectangular hole in the orange: p=0 is fully open, p=1 is sealed. Driving
 * the window rather than the box's scale keeps the footage still. Horizontal
 * only — the hole holds its full height and narrows to nothing.
 */
const holeClip = (p: number) => {
  const edge = (p * 50).toFixed(3);
  return `inset(0% ${edge}% 0% ${edge}%)`;
};

/**
 * The timeline, in vh of actual scrolling through the pin. Written as a chain of
 * derivations rather than a list of numbers, so retiming any beat carries the
 * rest along instead of quietly opening a gap or an overlap.
 */

/** The hole over the footage narrows shut, and the headline fades with it. */
const SHRINK_VH = 110;
/** Blank orange: no footage, no copy, nothing but the sealed surface. */
const BLANK_VH = 20;
// The doors, and the sequence's spine — the gap copy plays entirely over them,
// so this window is sized by what the copy needs (see GAP_LINES) and by nothing
// else. It grew from 175 when the copy went from two lines to three: the doors'
// path and resting position are untouched, they simply take more scroll to walk
// it, because there is now half again as much to read on the way.
const DOOR_AT = SHRINK_VH + BLANK_VH;
const DOOR_VH = 235;
const DOOR_END = DOOR_AT + DOOR_VH;

/**
 * The ribbon's draw-in is the one thing here that is NOT scrubbed: crossing
 * either end of the span fires a timed tween that runs to completion, so
 * stopping mid-scroll can never leave half a wave on screen.
 *
 * BAND_LEAD_VH is dead scroll between the doors coming to rest and the wave
 * starting, and it is what keeps the wave and the gap copy off each other's
 * screen. Because both tweens run on their own clock, a fast scroll can cross a
 * cue while one is still playing — and scrolling *up*, the close is racing the
 * second gap line back on. This margin is the guarantee, so it has to stay at
 * least as long as BAND_HIDE_SECONDS takes to scroll through.
 */
const BAND_LEAD_VH = 25;
const BAND_DRAW_AT = DOOR_END + BAND_LEAD_VH;
const BAND_HOLD_VH = 60;
const BAND_CLOSE_AT = BAND_DRAW_AT + BAND_HOLD_VH;
const BAND_DRAW_SECONDS = 0.9;
const BAND_HIDE_SECONDS = 0.5;

// The closing line takes the space the ribbon just vacated. The 35vh gap past the
// ribbon's cue guarantees the wave has gone before the line arrives, since the
// close is a timed tween and the cue can be crossed at speed. Sized against
// BAND_HIDE_SECONDS, so it grows if the close is slowed further.
const LEAP_AT = BAND_CLOSE_AT + 35;
const LEAP_IN_VH = 32;
const LEAP_HOLD_VH = 38;

// The doors close as soon as the line has finished holding, retracing their
// opening exactly because they run on the same progress value scaled back to
// zero. Quicker than the opening, which had the gap copy to carry.
const DOOR_CLOSE_AT = LEAP_AT + LEAP_IN_VH + LEAP_HOLD_VH;
const DOOR_CLOSE_VH = 125;

// The doorP below which the panels overlap and the stage reads as unbroken
// orange: they are DOOR_PANEL_W wide each, so their 16% overlap covers the gap
// before they have finished travelling. Closing, that lands at 72% of the way.
const DOOR_SEALED_AT = (2 * DOOR_PANEL_W - 1) / (2 * DOOR_REST_X);

// The line leaves *with* the doors rather than before them, receding as the orange
// closes in (see leapSeat). Sized so its scale reaches zero exactly as the panels
// meet — past that it would be shrinking against a surface already sealed.
const LEAP_OUT_AT = DOOR_CLOSE_AT;
const LEAP_OUT_VH = DOOR_CLOSE_VH * (1 - DOOR_SEALED_AT);

/**
 * The instant the panels meet and the stage reads as one unbroken orange
 * surface. Derived, not picked: the panels are DOOR_PANEL_W wide each, so they
 * cover the screen well before they have finished travelling (DOOR_SEALED_AT),
 * and the closing line's recession is already sized to land exactly here — so
 * the two share one number by construction rather than by being kept in sync.
 */
const SEALED_AT = LEAP_OUT_AT + LEAP_OUT_VH;

/**
 * The stage turning over from orange to the next section's gray, in one move.
 *
 * Everything after SEALED_AT is door travel nobody can see — the panels are
 * still moving, but under a surface with no edges left in it — and that used to
 * leave ~60vh of flat orange with nothing happening on it. Stopping anywhere in
 * there read as the page having run out. This is that stretch spent on the one
 * transition it was always leading to instead.
 *
 * Not scrubbed, on the same footing as the ribbon (see BAND_DRAW_AT): crossing
 * the cue fires a timed tween that runs to completion on its own clock, so the
 * turn-over is one continuous move at one speed whatever the scroll that
 * triggered it happened to be doing — and no stopping place anywhere in the
 * section can leave the stage sitting half orange and half gray. Scrubbing it
 * made the wash a readout of scroll velocity instead of a transition.
 *
 * GRAY_LEAD_VH is sealed-orange scroll between the panels meeting and the cue,
 * and it exists for the *upward* pass: the fade-out and the doors parting are
 * otherwise both keyed to the same instant, so they would race. It only has to
 * outlast GRAY_HIDE_SECONDS, and it is forgiving if it ever doesn't — the panels
 * overlap by 16% of the screen, so just past the seal the gap they open is a
 * sliver rather than a reveal.
 */
const GRAY_LEAD_VH = 15;
const GRAY_AT = SEALED_AT + GRAY_LEAD_VH;
/** Scroll the wash is given to play out in, before the pin's own hold begins. */
const GRAY_HOLD_VH = 35;
const GRAY_SECONDS = 1.3;
const GRAY_HIDE_SECONDS = 0.55;

/** Pinned screen past the last phase, where nothing scroll-driven moves. */
const HOLD_VH = 15;

// The pin plus the viewport the pinned stage occupies: the pin runs `top top` →
// `bottom bottom`, so progress 0→1 covers `height − 100vh`.
//
// Taken from whichever of the two closing phases finishes last, so the hold is
// always a hold: picking the door close alone would end the pin while the wash
// was still playing, which for a tween on its own clock means it would be cut
// off rather than merely hurried.
const PIN_VH =
  Math.max(DOOR_CLOSE_AT + DOOR_CLOSE_VH, GRAY_AT + GRAY_HOLD_VH) + HOLD_VH;
const SECTION_VH = PIN_VH + 100;

/** 0 before the span, 1 after it, linear in between. */
const ramp = (p: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (p - from) / (to - from));

/**
 * Both lines of the gap copy pass through one seat at the centre of the stage.
 * The two ends of that travel are deliberately not mirror images: a line settles
 * into the seat from just below, barely smaller and barely soft, and leaves by
 * climbing away while shrinking hard and blurring out.
 *
 * `y` is a fraction of the viewport height, not of the element, so both lines
 * travel the same distance despite the second being twice as tall.
 */
const STACK_IN_END = { y: 0.08, scale: 0.82, blur: 3 };
const STACK_OUT_END = { y: -0.12, scale: 0.45, blur: 6 };
const STACK_IN = gsap.parseEase("power1.out");
const STACK_OUT = gsap.parseEase("power1.in");

/**
 * The gap copy: three lines that each climb through the same centre seat, one at
 * a time. Words and timing are one table on purpose — they were two parallel
 * lists, which is an invitation to add a line without a window or retime a
 * window against the wrong words.
 *
 * `in`/`out` are fractions of the *door opening*, not of the pin, because the
 * copy is a consequence of the orange parting and has to stay pinned to it
 * however DOOR_VH is retuned.
 *
 * Nothing before 26%, since the panels are only clear of each other at
 * DOOR_SEALED_AT (~28%) and anything earlier fades up over unbroken orange. The
 * last window runs to exactly 100% — the doors coming to rest — which it can
 * because BAND_LEAD_VH puts dead scroll between the copy and the wave, so the
 * copy owns the whole opening and the two never share the screen either way.
 *
 * Every line gets the same shape, which is the point: each arrival is the
 * longest beat it has (the eye is waiting for it, and a fast scroll used to make
 * it pop in), each hold is the shortest, and each exit overlaps the next
 * arrival by half its length so a handover reads as one unhurried gesture rather
 * than a swap. Three lines in the window two used to have is what DOOR_VH was
 * lengthened for — at the old 175vh these arrivals came out at ~25vh each,
 * which is exactly the pop the timing was widened to remove.
 */
const GAP_LINES = [
  { text: "growth creates a gap", in: [0.26, 0.4], out: [0.45, 0.53] },
  { text: "between who you've become", in: [0.49, 0.64], out: [0.68, 0.76] },
  { text: "how the world sees you", in: [0.72, 0.87], out: [0.92, 1.0] },
] as const;

/**
 * One line's state in that seat. `away` is the single travel axis — 1 waiting
 * below, 0 seated, −1 gone above — and its sign picks which end is being
 * travelled to, which is the only place the arriving/leaving asymmetry lives.
 *
 * The −50s are folded into xPercent/yPercent because driving either at all would
 * overwrite a class-based translate, so GSAP has to own both halves.
 */
function stackSeat(viewportH: number, inP: number, outP: number) {
  const away = 1 - inP - outP;
  const seated = 1 - Math.abs(away);
  const end = away > 0 ? STACK_IN_END : STACK_OUT_END;
  const blur = end.blur * (1 - seated);
  return {
    xPercent: -50,
    yPercent: -50,
    y: end.y * viewportH * Math.abs(away),
    scale: gsap.utils.interpolate(end.scale, 1, seated),
    opacity: seated,
    // Dropped entirely once seated rather than left at blur(0): any filter at
    // all costs subpixel antialiasing for the whole time the copy is readable.
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

/**
 * The closing line's own seat. It arrives exactly as the gap copy does — fading
 * up from just below the seat, barely smaller — but it leaves by *receding*: the
 * opacity holds at 1 and the scale runs all the way to zero, with no rise and no
 * blur, so it reads as being drawn back through the gap the doors are closing
 * rather than dissolving where it stands.
 *
 * The recession has to be linear in the raw scroll ramp, which is why this cannot
 * reuse STACK_OUT (power1.in): the line is as wide as the gap it sits in, and the
 * panels are closing on it at a known rate, so anything that shrinks slower than
 * linear leaves its ends hanging over the orange. That matters more than it
 * sounds — `text-accent` is the panels' own colour, so those words would vanish
 * against them while the ink half stayed visible, at full opacity now that
 * nothing fades. Linear beats the panels everywhere: the line's width falls by
 * 0.42·p of the viewport against the gap's 0.30·p, so it is inside the gap for
 * every frame of the close and reaches nothing exactly as they meet.
 */
function leapSeat(viewportH: number, inP: number, outP: number) {
  const arriving = 1 - inP;
  const blur = STACK_IN_END.blur * arriving;
  return {
    xPercent: -50,
    yPercent: -50,
    y: STACK_IN_END.y * viewportH * arriving,
    scale: gsap.utils.interpolate(STACK_IN_END.scale, 1, inP) * (1 - outP),
    opacity: inP,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

/**
 * The ribbon draws in and closes in the same direction, right-to-left, which
 * pinches the clip at opposite ends — so a closed ribbon is parked at the wrong
 * end to open from and has to be moved back first (see `drawBand`).
 */
const BAND_CLIP_UNDRAWN = "inset(0% 0% 0% 100%)";
const BAND_CLIP_FULL = "inset(0% 0% 0% 0%)";
const BAND_CLIP_CLOSED = "inset(0% 100% 0% 0%)";

/** Gap between the ribbon's box and the closing line beneath it, in px. */
const LEAP_GAP = 56;
/** Cubics emitted per half wave. Three tracks a sine to well under a pixel. */
const SAMPLES_PER_HUMP = 3;

/**
 * Everything about the ribbon, derived from the stage it sits on.
 *
 * Both ends must land exactly on the door wedges' inner corners. That works
 * because the centre line is a straight baseline between those two anchor points
 * plus a sine: sin() is zero at both ends for any whole number of half waves, so
 * amplitude and hump count are free to be tuned without reopening a gap.
 */
function bandGeometry(stageW: number, stageH: number) {
  // Matches BAND_INSET, so the ribbon tucks 2px under each wedge horizontally.
  const inset = (DOOR_PANEL_W - DOOR_REST_X) * stageW - 2;
  const width = stageW - inset * 2;

  // The wedges' horizontal edges. The left wedge exists only *below* its top
  // edge and the right only *above* its bottom edge, which is why the ends have
  // to be pinned rather than merely overlapped.
  const leftEdge = (DOOR_REST_Y - 0.25) * stageH;
  const rightEdge = (1.25 - DOOR_REST_Y) * stageH;

  // Scales faster than the span, so the copy inside doesn't shrink with it.
  const thickness = gsap.utils.clamp(44, 76, width * 0.072);
  const fontSize = thickness * 0.55;
  // Half waves across the span. Must stay a whole number — that is what puts
  // sin() at exactly zero on both ends and pins the ribbon to the wedges.
  const humps = Math.round(gsap.utils.clamp(3, 8, width / 165));

  // Offset half a thickness inward so it is the ribbon *edges* that meet the
  // wedge corners.
  const startY = leftEdge + thickness / 2;
  const endY = rightEdge - thickness / 2;
  const slope = (endY - startY) / width;

  // Held to 15–25px for a gentle wave. The second term is a safety ceiling:
  // glyphs rotate with the path, so past roughly 40° they push out through the
  // ribbon's edges. It only binds on a narrow phone span.
  const amplitude = Math.min(
    gsap.utils.clamp(15, 25, thickness * 0.42),
    (Math.max(0, 0.85 - Math.abs(slope)) * width) / (humps * Math.PI),
  );

  // Solved, not sampled. The baseline tilts, so the extremes are not
  // `min/max(startY, endY) ± amplitude`: c'(x) = slope − A·ω·cos(ωx), so the
  // turning points are wherever cos(ωx) = slope/(A·ω). A sampled scan
  // undershoots by a fraction of a pixel and clips the sharpest crest.
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
    // The end-alignment guarantee, asserted rather than trusted — otherwise a
    // break surfaces as a hairline notch at only some viewport sizes.
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
    // Drops the baseline so the copy's visual mass rides the wave. Done in the
    // path to avoid `dy` on a textPath, which browsers disagree about.
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
 * One traversal of the wave as Hermite-matched cubics. `yOffset` shifts the whole
 * run, which is how both edges come from a single wave, and `reverse` retraces
 * the *same* curve so the edges stay parallel and the thickness stays constant.
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

/** The ribbon: the same wave offset up and down by half its thickness. */
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
 * Slim orange ribbon spanning the gap between the doors, with the copy
 * marqueeing right-to-left along its wave forever.
 *
 * The copy rides an SVG textPath rather than positioned spans, which is what
 * tilts each character tangent to the wave and makes containment structural: a
 * glyph past either end simply isn't rendered.
 */
function WavyBand({ g, animate }: { g: BandGeometry; animate: boolean }) {
  const textPathRef = useRef<SVGTextPathElement>(null);
  // Sanitised: useId's output contains colons, awkward in a URL fragment.
  const pathId = `band-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Enough repetitions to overfill the path, so copy is still arriving at the
  // right-hand end after a full repetition has scrolled off the left.
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
    // makes the loop length wrong and puts a visible jump in every repeat.
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

/**
 * `overlay` stacks every line in the same seat at the centre of the stage, so
 * each takes the last one's place rather than sitting beneath it. Positioning is
 * left entirely to GSAP (see `stackSeat`), which drives `yPercent` and would
 * overwrite any translate-based centring from the classes.
 *
 * Without it they stack in normal flow, which is the reduced-motion rendering:
 * no GSAP touches them there, so nothing may depend on a transform being
 * written — hence the flow-only `mt-5` between them.
 *
 * `lineRefs` is filled in line order, so index `i` here is index `i` in
 * GAP_LINES and the element being driven always matches the window driving it.
 */
function GapCopy({
  overlay = false,
  lineRefs,
}: {
  overlay?: boolean;
  lineRefs?: { current: (HTMLParagraphElement | null)[] };
}) {
  // One class string for all of them: they are parts of one statement in the
  // same seat, so any difference in size or weight reads as a replacement rather
  // than the sentence carrying on. The max-width only fixes where the longest
  // line wraps; GSAP centres on the element's own width, so it stays centred.
  const line = `w-full max-w-[1500px] text-[40px] leading-[1.15] font-medium text-ink md:text-[60px]`;
  const seat = overlay
    ? "absolute top-1/2 left-1/2 px-8 text-center"
    : "";
  return (
    <>
      {GAP_LINES.map(({ text }, i) => (
        <p
          key={text}
          ref={
            lineRefs
              ? (el) => {
                lineRefs.current[i] = el;
              }
              : undefined
          }
          className={`${seat} ${overlay || i === 0 ? "" : "mt-5"} ${line}`}
        >
          {text}
        </p>
      ))}
    </>
  );
}

// How many ems wide the closing line is, so its size can be solved from the span
// between the wedges rather than picked — widen the wedges and the line shrinks
// to suit.
//
// Not a guess: summing the advance widths in
// public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf gives 4.494em for
// "until you " and 7.009em for "make the leap", so 11.50em at weight 400. The
// bold run renders at 700 and the font ships HVAR, so its advances are wider
// than that — 14 leaves room for the bold run being up to ~12% wider *and* still
// clears the span at every width from 768px up. Keep it above ~12.4 if the
// wording changes.
const LEAP_EMS = 14;

// `whitespace-nowrap` because the size is solved for this width; wrapping would
// only ever mean the fit is wrong.
//
// Deliberately carries NO font-size of its own. It used to say
// `text-3xl md:text-[60px]`, which silently overrode the size the container
// solves and pinned the line to a flat 60px — 741px wide, against a span that is
// 609px at 1440 and 542px at 1280, so the ends sat on top of the wedges on every
// laptop. `text-accent` words over accent-coloured orange simply disappear, which
// is why the overlap has to be structurally impossible rather than merely
// unlikely: the only size here is the one derived from the span (see LEAP_EMS).
const LEAP_COPY = (
  <p className="leading-[1.3] font-normal whitespace-nowrap text-ink">
    until you <span className="font-bold text-accent">make the leap</span>
  </p>
);

/**
 * One continuous pinned sequence — one stage, one scrubbed ScrollTrigger, so
 * scrolling back up reverses every phase.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH):
 *    0–110vh  the rectangular hole the footage is seen through narrows shut.
 *             The footage never moves or resizes. The headline fades on the same
 *             driver, so it is gone at the instant the hole seals.
 *  110–130vh  empty — one unbroken orange surface, a clean break between the two
 *             statements.
 *  130–365vh  the doors open diagonally (right up-and-right, left down-and-left)
 *             and stop partway, leaving wedges in the bottom-left and top-right
 *             corners for good. The gap copy plays over them — three lines
 *             through one centre seat, their beats being fractions of this
 *             window (see GAP_LINES):
 *              +0–26%  no copy — the panels overlap until 28%, so there is
 *                      nothing to see yet.
 *             +26–40%  "growth creates a gap" fades up into the seat, slowly —
 *                      this is the beat a fast scroll used to rush.
 *             +40–45%  it holds while the orange keeps parting.
 *             +45–53%  it climbs away, shrinking and blurring out.
 *             +49–64%  "between who you've become" rises into the same seat as
 *                      the first leaves it — the overlap is what makes an
 *                      exchange one gesture rather than a swap.
 *             +64–68%  it holds.
 *             +68–76%  it climbs away.
 *             +72–87%  "how the world sees you" rises in behind it, on exactly
 *                      the same overlap.
 *             +87–92%  it holds.
 *            +92–100%  it climbs away, clearing the stage as the doors stop.
 *  365–390vh  dead scroll, so the copy is gone before the wave starts and the
 *             wave is gone before the copy comes back (see BAND_LEAD_VH).
 *  390–450vh  the wavy ribbon draws in right-to-left (a clip, not a fade),
 *             bridging the two wedges, then closes the same way round. Neither
 *             half is scroll-driven — see BAND_DRAW_AT.
 *  485–517vh  "until you make the leap" fades up into the space the ribbon
 *             vacated, at the same seat and sized to the same span.
 *  517–555vh  it holds.
 *  555–680vh  the doors close, retracing their opening exactly. The line recedes
 *             across the first 91vh of that — scaling to nothing at full opacity,
 *             never fading — and reaches zero exactly as the panels meet
 *             (~646vh), so it goes back through the gap rather than dissolving.
 *     ~646vh  the panels meet: from here the stage is one unbroken orange
 *             surface and the rest of their travel has no visible edges in it.
 *      661vh  the sealed orange washes over to the next section's gray. Cued
 *             here rather than at the doors' stop for that reason — waiting
 *             would shorten the flat-orange stall instead of removing it. Not
 *             scrolled through: crossing the cue fires a timed tween that runs
 *             to completion, like the ribbon, so it is one continuous move at
 *             one speed and no stopping place can leave it half done. The 15vh
 *             of lead is margin for the reverse (see GRAY_LEAD_VH).
 *  696–711vh  a short hold on flat gray before the pin releases. Gray and not
 *             orange is the point: the stage now scrolls away into a section of
 *             its own colour, so there is no seam left to hide.
 *
 * Then DefinitionSection takes over. Its own gradient strip still covers this
 * seam and is left in place, but it now has nothing to do: it fades gray over
 * gray, and is only still worth keeping as cover if these timings ever move.
 *
 * Layering (back to front): the background still with the footage over it, the
 * wavy band, the doors, the hero copy, the gray wash, then the header. The band
 * sits *under* the doors deliberately — both are the same orange, but it means a
 * ribbon caught mid-close is swallowed by the returning panels instead of
 * floating over them. The wash sits over the copy and under the header for the
 * same kind of reason: everything it covers is already gone by the time it
 * arrives, and the one thing that isn't is the wordmark.
 */
export default function HeroNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gapLineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const wavyRef = useRef<HTMLDivElement>(null);
  const leapRef = useRef<HTMLDivElement>(null);
  const grayRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const bgCoveredRef = useRef(false);
  const clipVideoRef = useRef<HTMLVideoElement>(null);
  const clipSealedRef = useRef(false);
  const introDoneRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Null until the browser has a spare moment (see the effect below);
  // `bgPlaying` then fades the footage over the still once it has frames.
  const [bgSrc, setBgSrc] = useState<string | null>(null);
  const [bgPlaying, setBgPlaying] = useState(false);
  // The ribbon is pinned to the wedges' corners, so it needs both axes of the
  // stage's real size, not just its width.
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

  /**
   * Fetch the background footage once the browser is idle. Nothing behind the
   * doors is visible for the first SHRINK_VH + BLANK_VH of the pin plus a
   * quarter of the door window, so loading it with the page would only put
   * several megabytes up against the assets that are actually on screen.
   *
   * Skipped under reduced motion, where the doors start parked open and
   * autoplaying footage would be unrequested motion on arrival.
   */
  useEffect(() => {
    if (!mounted || reducedMotion || !BACKGROUND_VIDEO_SRC) return;
    const start = () => setBgSrc(BACKGROUND_VIDEO_SRC);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, {
        timeout: BACKGROUND_VIDEO_IDLE_TIMEOUT,
      });
      return () => window.cancelIdleCallback(id);
    }
    // Safari has no requestIdleCallback; a plain timeout is close enough for
    // something with this much slack.
    const id = window.setTimeout(start, 1200);
    return () => window.clearTimeout(id);
  }, [mounted, reducedMotion]);

  // Load sequence (plays once, not scroll-driven): the hole opens up over the
  // footage, then the headline fades in.
  useEffect(() => {
    if (!mounted) return;
    const box = videoBoxRef.current;
    const headline = headlineRef.current;
    const logo = logoRef.current;
    if (!box || !headline || !logo) return;

    if (reducedMotion) {
      // No ScrollTrigger runs in this mode, so only the clip and the hero
      // headline — which exist purely to be animated — are hidden here. The
      // centre copy renders as a plain static column instead (see the JSX).
      // The logo stays visible: it's the page header, not an animated aside.
      gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0 });
      gsap.set(box, { opacity: 0 });
      introDoneRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      // The clip window starts fully *open* and is not animated here — only
      // opacity is, exactly as for the logo below. This used to animate the
      // hole shut→open, and that reveal is what made the footage read as
      // arriving abruptly no matter how the opacity was tuned: a mask edge
      // travelling across the picture is a wipe, and a wipe cannot be eased
      // into a fade. The hole is the scroll phase's to drive (see Phase 1),
      // which already expects it fully open at scroll 0.
      //
      // Neither of these touches a transform, so the Tailwind translate
      // classes keep doing the centering untouched.
      gsap.set(box, { clipPath: holeClip(0), opacity: 0 });
      // The header logo, same treatment: it would otherwise render at full
      // opacity on the very first frame, before anything else has appeared.
      gsap.set(logo, { opacity: 0 });
      // GSAP owns the headline's centring and the classes deliberately don't:
      // the first transform GSAP writes replaces the whole inline transform, so
      // a class-based `-translate-y-1/2` would be wiped the instant `y` is
      // touched, dropping the line half its height as it fades in.
      gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0, y: 16 });

      let cancelled = false;
      // Held until the webfont has settled. `display: swap` means the first
      // paint is in the fallback face, and fading in across that metrics change
      // is the other half of the flicker. Waiting costs a few ms and the swap
      // happens while the headline is still fully transparent.
      document.fonts.ready.then(() => {
        if (cancelled) return;
        ctx.add(() => {
          // Three plain opacity fades on absolute start times. The footage gets
          // the same treatment as the logo — nothing but opacity, on the same
          // ease — just over a slightly longer run, since it is a far larger
          // area of the screen to resolve.
          gsap
            .timeline({
              delay: 0.2,
              onComplete: () => {
                introDoneRef.current = true;
              },
            })
            .to(box, { opacity: 1, duration: 1.1, ease: "power2.out" }, 0)
            .to(logo, { opacity: 1, duration: 0.8, ease: "power2.out" }, 0.1)
            .to(
              headline,
              { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
              0.5,
            );
        });
      });

      return () => {
        cancelled = true;
      };
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
      // The ribbon's draw-in, kept off the scrub entirely (see BAND_DRAW_AT).
      // `shown` is the latched state, so crossing the cue fires the tween once
      // rather than restarting it on every scroll event past it.
      let shown = false;
      let bandTween: gsap.core.Tween | null = null;
      function drawBand(show: boolean) {
        const el = wavyRef.current;
        // Bailing before the latch flips matters: the ribbon only mounts once
        // the stage has been measured, so an early cue is retried, not swallowed.
        if (!el || show === shown) return;
        shown = show;
        const midFlight = bandTween?.isActive() ?? false;
        bandTween?.kill();
        // A finished close leaves the clip pinched at the opposite end from
        // undrawn (see BAND_CLIP_*), so it has to be moved back before it can
        // draw again — safe only because nothing is on screen then. `midFlight`
        // catches a close still running, where the draw instead reverses out of
        // wherever it got to.
        if (show && !midFlight) gsap.set(el, { clipPath: BAND_CLIP_UNDRAWN });
        bandTween = gsap.to(el, {
          clipPath: show ? BAND_CLIP_FULL : BAND_CLIP_CLOSED,
          duration: show ? BAND_DRAW_SECONDS : BAND_HIDE_SECONDS,
          ease: show ? "power2.out" : "power2.in",
          overwrite: "auto",
        });
      }

      // The orange→gray turn-over, latched the same way (see GRAY_AT).
      //
      // Simpler than the ribbon in one respect: the hidden state *is* opacity 0,
      // so there is no parked-at-the-wrong-end problem to undo first and no
      // `midFlight` case — a reversal just tweens back from wherever it reached.
      //
      // `sine.inOut` both ways: this is a full-screen change of colour, so it
      // has to leave and arrive at zero velocity or the turn-over announces
      // itself at one end. The reverse is faster because it is racing the doors
      // parting underneath it (see GRAY_LEAD_VH), not because it should feel
      // different.
      let grayShown = false;
      let grayTween: gsap.core.Tween | null = null;
      function washGray(show: boolean) {
        const el = grayRef.current;
        if (!el || show === grayShown) return;
        grayShown = show;
        grayTween?.kill();
        grayTween = gsap.to(el, {
          opacity: show ? 1 : 0,
          duration: show ? GRAY_SECONDS : GRAY_HIDE_SECONDS,
          ease: "sine.inOut",
          overwrite: "auto",
        });
      }

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        // CSS `sticky` does not work here: ScrollSmoother fakes scrolling with a
        // transform on #smooth-content, and `sticky` never engages without a
        // real scrolling ancestor. GSAP's pin sets position:fixed via JS.
        pin: stageRef.current,
        pinSpacing: false,
        onUpdate(self) {
          // ScrollTrigger fires an onUpdate at creation; without this guard it
          // would snap the clip straight to its resting size and cut the
          // entrance animation short.
          if (!introDoneRef.current) return;

          // Progress as real scroll distance through the pin, in vh, so each
          // phase reads as "from here to here" in scroll the user can feel.
          const vh = self.progress * PIN_VH;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;

          // --- Phase 1: the hole narrows shut over the footage (0 – 110vh) ---
          // The box is neither scaled nor moved — only the window it is seen
          // through closes, and only in width. A clip costs no layout work, and
          // this owns it outright: the load timeline animates opacity only and
          // leaves the hole open, so shrinkP = 0 here is already the state the
          // entrance faded up into.
          const shrinkP = ramp(vh, [0, SHRINK_VH]);
          gsap.set(box, { clipPath: holeClip(shrinkP) });

          // Same driver rather than a window of its own, so the copy is gone at
          // the exact moment the hole seals.
          gsap.set(headlineRef.current, { opacity: 1 - shrinkP });

          // Nothing of this footage is on screen for the remaining five-plus
          // viewports of the pin. Latched on a ref rather than the element's own
          // `paused`, since play() is asynchronous.
          const clip = clipVideoRef.current;
          if (clip) {
            const sealed = shrinkP >= 1;
            if (sealed !== clipSealedRef.current) {
              clipSealedRef.current = sealed;
              if (sealed) clip.pause();
              else void clip.play().catch(() => { });
            }
          }

          // The logo would end up over the revealed background, so this took it
          // ink → white straddling the seal — a change of surface rather than a
          // third event queued behind the other two. Disabled for now: the logo
          // stays ink for the whole scroll. Uncomment to restore the color swap.
          // gsap.set(logoRef.current, {
          //   backgroundColor: gsap.utils.interpolate(
          //     "#390303",
          //     "#ffffff",
          //     ramp(vh, [SHRINK_VH - 20, SHRINK_VH + 30]),
          //   ),
          // });

          // --- Phase 2: blank orange (110 – 130vh) — no code, it exists because
          // the phase before ended at SHRINK_VH and the next begins at DOOR_AT.

          // --- Phase 3: the doors, and the copy that plays over them ---
          // `doorP` is the spine of everything to 365vh: the panels move on it,
          // and every copy beat is a fraction of it (GAP_LINES), so the two can
          // never drift out of step however the window is retuned.
          const doorP = ramp(vh, [DOOR_AT, DOOR_END]);

          // Every line climbs through the same centre seat, each rising into it
          // as the one before leaves upward (see stackSeat). Driven straight off
          // GAP_LINES rather than line by line, so the choreography is identical
          // across all of them by construction — there is no per-line code left
          // for a third line to be accidentally left out of.
          for (let i = 0; i < GAP_LINES.length; i++) {
            gsap.set(
              gapLineRefs.current[i],
              stackSeat(
                H,
                STACK_IN(ramp(doorP, GAP_LINES[i].in)),
                STACK_OUT(ramp(doorP, GAP_LINES[i].out)),
              ),
            );
          }

          // Each line owns its own opacity, so the container's only job is to
          // stay hidden until the first onUpdate has seated them.
          gsap.set(contentRef.current, { opacity: 1 });

          // The panels, opening on doorP (130 – 305vh) and closing again at the
          // end (487 – 612vh). Each slides out while drifting vertically, the
          // drift finishing ahead of the slide (hence `/0.7`).
          //
          // The close is not a second animation: `doorNow` is the opening's own
          // progress scaled back to zero, so the panels retrace the exact path
          // they came out on. Note the copy rides `doorP`, not this — it must
          // stay gone while the doors return, not play itself backwards.
          const closeP = ramp(vh, [DOOR_CLOSE_AT, DOOR_CLOSE_AT + DOOR_CLOSE_VH]);
          const doorNow = doorP * (1 - closeP);
          const drift = gsap.utils.clamp(0, 1, doorNow / 0.7);
          gsap.set(panelLeftRef.current, {
            x: -doorNow * W * DOOR_REST_X,
            y: drift * H * DOOR_REST_Y,
          });
          gsap.set(panelRightRef.current, {
            x: doorNow * W * DOOR_REST_X,
            y: -drift * H * DOOR_REST_Y,
          });

          // A 1080p decode is not free, so the footage only runs while some of
          // it can be seen — which covers both ends of the sequence. Latched on
          // a ref because play() is asynchronous: `paused` would still read true
          // on the next frame and this would call play() every frame until it
          // resolved.
          const bg = bgVideoRef.current;
          if (bg) {
            const covered = doorNow < BACKGROUND_VISIBLE_AT_DOOR;
            if (covered !== bgCoveredRef.current) {
              bgCoveredRef.current = covered;
              if (covered) bg.pause();
              // Rejects if the browser declines to autoplay, which is not
              // something to act on: the still underneath is the fallback.
              else void bg.play().catch(() => { });
            }
          }

          // --- Phase 4: the ribbon draws in, holds, and clears (330 – 390vh) ---
          // Not scrubbed: each end of the span fires a tween that runs to
          // completion on its own clock, so the wedges are always at rest before
          // it starts and it can never be left frozen half-drawn. Expressed as a
          // span so it behaves the same crossed either way.
          drawBand(vh >= BAND_DRAW_AT && vh < BAND_CLOSE_AT);

          // --- Phase 5: the closing line takes its place (425 – 585vh) ---
          // Seated where the ribbon was, not below it, so the wave resolves into
          // the words. It arrives like the gap copy but recedes instead of fading
          // (see leapSeat), scaling to nothing across the door close so it reads
          // as going back through the gap the panels are shutting.
          //
          // The exit takes the raw ramp deliberately — no STACK_OUT. The eased
          // version holds the line near full size early, which is exactly when
          // the panels are already advancing on it.
          gsap.set(
            leapRef.current,
            leapSeat(
              H,
              STACK_IN(ramp(vh, [LEAP_AT, LEAP_AT + LEAP_IN_VH])),
              ramp(vh, [LEAP_OUT_AT, LEAP_OUT_AT + LEAP_OUT_VH]),
            ),
          );

          // --- Phase 6: the doors close (555 – 680vh), driven above ---

          // --- Phase 7: orange turns over to gray (fires at 661vh) ---
          // Cued just past SEALED_AT rather than off the door close, because the
          // panels seal 34vh before they stop moving and all of that is travel
          // with no visible edges in it — waiting for the doors to finish would
          // shorten the flat-orange stall instead of removing it.
          //
          // Not scrubbed: crossing this threshold in either direction fires a
          // tween that runs to completion (see washGray). A threshold and not a
          // span like the ribbon's, because nothing past it ever takes the gray
          // back off — the pin's own end is the only upper bound it needs.
          //
          // A gray layer over the top rather than a background-colour tween: the
          // orange is painted by three separate elements here (the section and
          // both panels), and one layer over them is a single number instead of
          // three that have to agree.
          washGray(vh >= GRAY_AT);

          // --- Phase 8: a short hold on flat gray — already the next section's
          // colour, so the pin releasing is invisible.
        },
      });

      return () => {
        // Created inside onUpdate, so the context never collected them.
        bandTween?.kill();
        grayTween?.kill();
        trigger.kill();
      };
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
      style={{ height: reducedMotion ? "100vh" : `${SECTION_VH}vh` }}
    >
      {/* Portaled out because `position: fixed` does not work inside
          ScrollSmoother's transformed #smooth-content. */}
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

      {/* GSAP pins this element directly (see the ScrollTrigger above); CSS
          `sticky` does not work here. `relative` still gives next/image `fill`
          something to resolve against before pinning kicks in. */}
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden">
        <div className="relative h-full w-full">
          {/* Background reveal, uncovered once the doors move. The still and the
            footage are layered rather than swapped: the still covers the stretch
            before the idle callback fires, the reduced-motion path, and an
            outright playback failure.

            No `priority`, and no `poster` on the video either — both would
            preload for a first frame that cannot be seen for a viewport of
            scrolling, and the poster once pointed at this same 5184px source. */}
          <Image
            src="/img/hero-bg.jpg"
            alt="Misty coastal cliffs at dawn"
            fill
            className="object-cover"
            sizes="100vw"
          />

          {bgSrc && (
            <video
              ref={bgVideoRef}
              // Fades over the still on its first frame rather than cutting,
              // which matters for a visitor arriving at a restored scroll
              // position with the doors already open.
              className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700 ${bgPlaying ? "opacity-100" : "opacity-0"
                }`}
              src={bgSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              // Decorative: the still below carries the alt text.
              aria-hidden
              onPlaying={() => setBgPlaying(true)}
            />
          )}

          {/* Orange doors. Oversized so the closed state fully overlaps and the
            diagonal drift never exposes a panel's short edge. In reduced motion
            they render already parked — the same offsets in vw/vh, since there
            is no ScrollTrigger to drive them. */}
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

          {/* The footage, seen through a rectangular hole in the orange. The box
            never moves or resizes — only its clip does, and only on scroll.
            Starts fully open but transparent, so the entrance is a plain fade
            (see the load timeline) and nothing flashes before it runs; opacity
            rather than a `scale-0` class because GSAP must not have to write a
            transform here, which would wipe the translate-centering. */}
          <div
            ref={videoBoxRef}
            className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-75 min-w-35 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            style={{ clipPath: holeClip(0), opacity: 0 }}
          >
            {/* Not /video/section2.mp4, which is kept alongside as the master:
              that is 1920×1080 and 18.5MB, and this box is at most 300px wide,
              so `object-cover` was discarding ~80% of every decoded frame. This
              is the same footage pre-cropped to the strip that shows, centred
              where object-cover already centred it, at 480×1080 and 3.53MB.

              `poster` is a plain URL, so it bypasses next/image and is served at
              whatever size it is on disk. It is now the video's own first frame
              at 36KB, so the handoff to playback is invisible. */}
            <video
              ref={clipVideoRef}
              className="absolute inset-0 h-full w-full object-cover"
              src="/video/section2-vertical.mp4"
              poster="/img/section2-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>

          {/* The turn-over from orange to the next section's gray (see Phase 7).
            Above the panels and everything they carry, but deliberately below
            the header: the wordmark survives into the gray rather than being
            painted out along with the orange.

            Nothing but GSAP ever raises it, so it stays at opacity 0 under
            reduced motion — where the doors are parked open over the footage and
            a gray screen would be plainly wrong. */}
          <div
            ref={grayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[25] bg-gray opacity-0"
          />

          <header className="absolute top-0 left-0 z-30 w-full px-8 py-8 md:px-16">
            <Logo
              ref={logoRef}
              className="w-[90px] md:w-[120px]"
              color="var(--color-ink)"
            />
          </header>

          {/* No translate-centring classes on purpose: GSAP animates `y` here
            and owns xPercent/yPercent instead, in both motion modes. Safe to
            leave uncentred for the frame before that runs because `opacity-0`
            starts it hidden. */}
          <p
            ref={headlineRef}
            className="absolute top-1/2 left-1/2 z-30 w-full max-w-5xl px-8 text-center text-[32px] leading-[1.3] font-light text-white/80 opacity-0 md:text-[52px] lg:max-w-[1300px] lg:text-[68px]"
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
            /* Nothing animates here, so the opening copy has to live where it
               won't collide with the ribbon, which is pinned to the wedges in
               both modes. */
            <div className="absolute inset-x-8 top-[10%] z-20 text-center md:inset-x-16">
              <GapCopy />
            </div>
          )}

          {!reducedMotion && (
            /* No flex column and no padding of its own: both lines are seated
               absolutely at its centre and carry their own gutters, so the one
               arriving lands exactly where the one leaving sat. */
            <div
              ref={contentRef}
              className="pointer-events-none absolute inset-0 z-30 opacity-0"
            >
              <GapCopy overlay lineRefs={gapLineRefs} />
            </div>
          )}

          {band && (
            <>
              {/* Placed at the geometry's own `top`, not centred, because its
                ends have to meet the wedge corners exactly.

                Sits *below* the doors (z-5 against z-10), which changes nothing
                about the finished composition but does mean panels sliding back
                in on an upward scroll cover a ribbon that is still closing
                rather than leaving it on top of the orange. */}
              <div
                ref={wavyRef}
                className="pointer-events-none absolute z-[5]"
                style={{
                  left: BAND_INSET,
                  right: BAND_INSET,
                  top: band.top,
                  clipPath: reducedMotion ? undefined : BAND_CLIP_UNDRAWN,
                }}
              >
                <WavyBand g={band} animate={!reducedMotion} />
              </div>

              {/* Centred on the stage rather than boxed inside the band's inset:
                sized to its own content and pulled back half its width, so its
                midpoint is the screen's at any font size. Being unboxed is what
                keeps any overhang even rather than all on one side — it is not a
                licence to overhang, which is what the old note here read as, and
                what the hardcoded 60px it excused actually did.

                On the ribbon's centre line, since it takes over that space once
                the ribbon clears — and sized to the span between the wedges (see
                LEAP_EMS) so it sits between them, with 26–64px of clearance a
                side from 768px up. The clamp's floor still overflows below ~700px,
                where the span is far too narrow to fit this many words at any
                readable size; that is the one place the overhang is accepted.

                Translate-centring is GSAP's here (xPercent, from leapSeat), not
                the class list's. Reduced motion has no GSAP, so it keeps the
                class and stays below the band — where it must be, since the
                ribbon is drawn in full there and never clears. */}
              <div
                ref={leapRef}
                className={`pointer-events-none absolute left-1/2 z-20 text-center ${reducedMotion ? "-translate-x-1/2" : ""
                  }`}
                style={{
                  top: reducedMotion
                    ? band.top + band.height + LEAP_GAP
                    : band.top + band.height / 2,
                  fontSize: gsap.utils.clamp(26, 82, band.width / LEAP_EMS),
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
