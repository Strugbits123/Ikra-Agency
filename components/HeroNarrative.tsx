"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
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

/**
 * The rectangular hole in the orange, expressed as an inset clip on the box the
 * footage sits in: p=0 is fully open, p=1 is sealed.
 *
 * Driving the *window* rather than the box's scale is the whole point. The
 * footage never moves and never changes size — it stays exactly as it opened,
 * and the orange closes over it until the surface is unbroken.
 *
 * The close is horizontal only: the two vertical edges travel inward while the
 * hole keeps its full height the whole way, so it narrows to a tall slit and
 * then to nothing rather than contracting towards its centre. At p=1 the left
 * and right insets are 50% each, i.e. zero width, so it seals outright instead
 * of pinching down to a sliver that needs an opacity dissolve to hide.
 */
const holeClip = (p: number) => {
  const edge = (p * 50).toFixed(3);
  return `inset(0% ${edge}% 0% ${edge}%)`;
};

/**
 * How far the hero stays pinned, in vh of actual scrolling. Every phase is
 * expressed in vh of this rather than as a bare 0–1 fraction, so the timeline
 * reads as scroll the user can feel — and so dead scroll is obvious: the last
 * phase ends at 417vh, and everything past that is pinned screen where
 * scrolling does nothing at all. Keep the two numbers close.
 *
 * The section is this plus the one viewport the pinned stage itself occupies,
 * because the pin runs `top top` → `bottom bottom`: progress 0→1 covers
 * `height − 100vh`, not the whole height.
 */
const PIN_VH = 444;
const SECTION_VH = PIN_VH + 100;

/**
 * The gap copy is a stack: both lines share one seat at the centre of the
 * stage, and the second knocks the first out of it on its way in. At either end
 * of a line's travel it is shrunk to STACK_SCALE, blurred by STACK_BLUR and
 * fully transparent, so the two lines read as one column of type moving through
 * a fixed point.
 *
 * The two distances are deliberately different. A line rises STACK_RISE% of its
 * own height to reach the seat — far enough down that it is clearly travelling
 * up into frame rather than materialising just below where it lands — but only
 * clears STACK_EXIT% on the way out, where the shrink and blur are doing most
 * of the work and a long throw would just read as the line being flung. Give
 * the rise a proportionally longer scroll window than the exit, or the extra
 * distance turns into extra speed instead of extra presence.
 *
 * Arrivals ease out and exits ease in (the same pairing the reference uses), so
 * a line decelerates into the seat and accelerates away from it instead of
 * crossing at a constant rate.
 */
const STACK_RISE = 280;
const STACK_EXIT = 120;
const STACK_SCALE = 0.3;
const STACK_BLUR = 6;
const STACK_IN = gsap.parseEase("power1.out");
const STACK_OUT = gsap.parseEase("power1.in");

/**
 * Where the heading goes once the second line claims the seat: up out of the
 * way and smaller, but still on screen and still perfectly readable. It is
 * being demoted, not evicted — the two statements belong together, so the pair
 * ends up reading as one composition rather than as two slides.
 *
 * The shift has to clear the second line's full height, not just its own: both
 * are measured from the same seat centre, so anything less than about −100%
 * leaves the heading's descenders sitting in the second line's first row.
 */
const HEAD_SHIFT_Y = -110;
const HEAD_SHIFT_SCALE = 0.68;

/**
 * How far the doors get before the copy above them has finished leaving. Tying
 * the exit to the doors rather than to a vh window of its own is what keeps the
 * two events one gesture: the copy is carried off *by* the orange breaking
 * apart, and cannot drift out of step with it if either is ever retimed.
 */
const COPY_EXIT_AT_DOOR = 0.7;

/**
 * One line's state in that stack. `inP` carries it up into the seat from below,
 * `outP` carries it on up and out, and `seatedScale`/`seatedY` describe where it
 * rests in between — which is the only thing the two lines differ on, and what
 * lets the heading be demoted to a smaller seat above the centre instead of
 * having to leave to make room.
 *
 * `away` is the single position axis — +1 waiting below, 0 seated, −1 gone
 * above — so a line that is halfway in and a line that is halfway out are
 * described by the same expression rather than by two mirrored branches. Its
 * sign is also what picks the distance, which is the only place the asymmetry
 * between rising in and clearing out lives.
 *
 * The −50 centring is folded into `yPercent` on purpose: driving `yPercent` at
 * all would overwrite a class-based translate the first time it ran, so GSAP
 * has to own both halves of the value.
 */
function stackSeat(
  seatedScale: number,
  seatedY: number,
  inP: number,
  outP: number,
) {
  const away = 1 - inP - outP;
  const seated = 1 - Math.abs(away);
  const blur = STACK_BLUR * (1 - seated);
  return {
    xPercent: -50,
    // The travel is measured from wherever the line is seated, so a line that
    // has been demoted upward leaves from there rather than snapping back to
    // the centre first.
    yPercent: -50 + seatedY + (away > 0 ? STACK_RISE : STACK_EXIT) * away,
    scale: gsap.utils.interpolate(STACK_SCALE, seatedScale, seated),
    opacity: seated,
    // Dropped entirely once the line is seated rather than left at blur(0):
    // any filter at all routes the text through a separate rasterisation that
    // loses subpixel antialiasing, so a nominally zero blur still renders the
    // copy softer than the rest of the page for the whole time it is readable.
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

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

/**
 * `overlay` stacks the two lines in the same seat at the centre of the stage,
 * one on top of the other, which is what lets the second take the first's place
 * rather than sit beneath it. Laying them out is left entirely to GSAP — see
 * `stackSeat` — since the animation drives `yPercent` and would overwrite any
 * translate-based centring the classes tried to apply.
 *
 * Without it the two simply stack in normal flow, which is the reduced-motion
 * rendering: no GSAP touches them there, so they need to be readable as they
 * are, and nothing may depend on a transform ever being written.
 */
function GapCopy({
  overlay = false,
  headRef,
  subRef,
}: {
  overlay?: boolean;
  headRef?: Ref<HTMLParagraphElement>;
  subRef?: Ref<HTMLParagraphElement>;
}) {
  const seat = overlay
    ? "absolute top-1/2 left-1/2 w-full px-8 text-center"
    : "";
  return (
    <>
      <p
        ref={headRef}
        className={`${seat} text-[45px] leading-[1.15] font-medium text-ink md:text-[94.6px]`}
      >
        growth creates a gap
      </p>
      <p
        ref={subRef}
        className={`${seat} ${overlay ? "" : "mt-5"} max-w-2xl text-[22px] leading-[1.3] font-light text-ink/80 md:text-[35.6px]`}
      >
        between who you&apos;ve become and how the world sees you
      </p>
    </>
  );
}

/**
 * Deliberately wider than the gap it is centred in, and `whitespace-nowrap` so
 * it stays one line and overhangs rather than wrapping into a stack. The
 * overhang is the point: at this height the bottom-left wedge is still orange,
 * so the opening "un" runs onto it and the line reads as crossing the whole
 * composition instead of being boxed inside the gap.
 */
const LEAP_COPY = (
  <p className="text-[26px] leading-[1.3] font-normal whitespace-nowrap text-ink md:text-[82px]">
    until you <span className="font-bold text-accent">make the leap</span>
  </p>
);

/**
 * One continuous pinned sequence — no seam between "hero" and "reveal"
 * because there is no second section: it's all one sticky stage and one
 * scrubbed ScrollTrigger, so scrolling back up reverses every phase.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH):
 *    0–110vh  the rectangular hole the footage is seen through narrows shut.
 *             The footage itself never moves or resizes, and the hole keeps
 *             its full height throughout — only its two vertical edges travel
 *             inward, so it closes to a tall slit and then to nothing. The hero
 *             headline fades on the very same driver, so it is completely gone
 *             at the instant the hole seals: one event, not two.
 *  110–130vh  empty. Both the footage and the opening headline are gone and
 *             nothing has replaced them yet, so the screen is one unbroken
 *             orange surface carrying no copy at all. A short, deliberate beat
 *             — long enough to land as a clean break between the two
 *             statements, short enough not to read as the page having stalled.
 *  130–158vh  "growth creates a gap" grows into place as it fades up on that
 *             orange, ink on orange, taking the seat at the centre of the
 *             stage that both lines of this copy share.
 *  158–184vh  it holds there, for about as long as the blank beat that preceded
 *             it, so the pauses on either side of its arrival match.
 *  184–220vh  the second line rises out of the bottom of the frame and takes
 *             the seat, while the heading steps up and shrinks to make room
 *             instead of being pushed off — it stays on screen and readable, so
 *             the two statements end up standing together. One window, both
 *             lines moving, so it reads as a handoff. The longest window here,
 *             because the rise covers STACK_RISE, well over twice STACK_EXIT.
 *  220–252vh  both hold, the pair readable together.
 *  252–305vh  the two leave as one — driven by the doors below rather than by a
 *             window of their own, so the copy is carried off *by* the orange
 *             breaking apart and cannot drift out of step with it. Gone by the
 *             time the doors are COPY_EXIT_AT_DOOR of the way open.
 *  252–327vh  the doors open diagonally, exactly as they always did (right
 *             up-and-right, left down-and-left), but stop partway instead of
 *             leaving — orange wedges stay in the bottom-left and top-right
 *             corners for good.
 *  302–352vh  the wavy orange ribbon draws itself in from right to left (a
 *             clip, not a fade), bridging the two resting wedges so ribbon and
 *             doors read as one continuous form. Kept to 50vh so a single
 *             scroll completes it.
 *  367–417vh  "until you make the leap" fades in below the ribbon.
 *  417–444vh  hold — nothing scroll-driven moves, so scrolling here does
 *             nothing but wait. Deliberately short; the ribbon's copy marquees
 *             along the wave on its own timeline and keeps going regardless.
 *
 * Then the pin releases and DefinitionSection takes over. The 100vh handoff
 * between the two pins is snapped — see the `handoff` trigger in that file.
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
  const gapHeadRef = useRef<HTMLParagraphElement>(null);
  const gapSubRef = useRef<HTMLParagraphElement>(null);
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

  // Load sequence (plays once, not scroll-driven): the hole opens up over the
  // footage, then the headline fades in. Opening the *window* rather than
  // scaling the box is the same move the scroll phase reverses, so the footage
  // is at its final size from the very first frame either way.
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
      // Only the clip window is animated here, never a transform, so the
      // Tailwind translate classes keep doing the centering untouched.
      gsap.set(box, { clipPath: holeClip(1) });
      gsap.set(headline, { opacity: 0, y: 16 });

      gsap
        .timeline({
          delay: 0.2,
          onComplete: () => {
            introDoneRef.current = true;
          },
        })
        .to(box, { clipPath: holeClip(0), duration: 0.9, ease: "power3.out" })
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

          // Progress as real scroll distance through the pin, in vh, so each
          // phase below reads as "from here to here" in scroll the user can
          // feel, and retiming one cannot silently shift the rest.
          const vh = self.progress * PIN_VH;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;

          // --- Phase 1: the hole narrows shut over the footage (0 – 110vh) ---
          // The box is not scaled and not moved: what closes is the window it
          // is seen through, and only in width — the hole holds its full height
          // the whole way, so the footage keeps its size and position while the
          // orange behind eats into it from the left and right edges. A
          // clip costs no layout work, needs no re-measuring across resizes,
          // and picks up exactly where the entrance timeline's open left off.
          const shrinkP = gsap.utils.clamp(0, 1, vh / 110);
          gsap.set(box, { clipPath: holeClip(shrinkP) });

          // The headline rides that same driver rather than a window of its
          // own, so the two are synced by construction: the copy is completely
          // gone at the exact moment the hole seals.
          gsap.set(headlineRef.current, { opacity: 1 - shrinkP });

          // The logo ends up sitting over the revealed background, so it goes
          // ink → white as the hole seals — well before the doors part. (This
          // used to be driven by the clip passing behind the logo, which can't
          // happen now that the clip never moves.)
          gsap.set(logoRef.current, {
            backgroundColor: gsap.utils.interpolate(
              "#390303",
              "#ffffff",
              gsap.utils.clamp(0, 1, (vh - 90) / 50),
            ),
          });

          // --- Phase 2: blank orange (110 – 130vh) — nothing is on screen but
          // the sealed surface itself. There is no code for it: it exists
          // because the phase before finished at 110 and the one after does not
          // begin until 130, and it stays empty only as long as that gap.

          // --- Phase 3: the gap copy runs through the seat (130 – 305vh) ---
          // Both lines share one seat at the centre of the stage (see
          // stackSeat). The heading takes it first and is then demoted rather
          // than displaced: it steps up and shrinks to make room, stays
          // readable, and the two end up on screen together as one composition.
          // Each arrival holds long enough to be read — the holds are as much
          // of the sequence as the moves are.
          //
          // 130–158  the heading grows into place, still the plain grow-and-fade
          //          it always was: it is the first thing in the seat, so it has
          //          nothing to displace and does not need the travel.
          // 158–184  it holds. Roughly the length of the blank beat before it,
          //          so the pause on either side of its arrival matches.
          // 184–220  the second line rises out of the bottom of the frame into
          //          the seat while the heading steps up and back out of its
          //          way. One window, both lines moving, so it reads as a
          //          handoff. Longer than the exit because the rise covers
          //          STACK_RISE rather than STACK_EXIT, and the extra distance
          //          should buy presence rather than speed.
          // 220–252  both hold, the pair readable together.
          // 252–305  they leave as one, on the doors rather than on a window of
          //          their own — gone by the time the orange is
          //          COPY_EXIT_AT_DOOR broken apart beneath them.
          const headP = gsap.utils.clamp(0, 1, (vh - 130) / 28);
          const handoff = gsap.utils.clamp(0, 1, (vh - 184) / 36);

          // Computed here rather than down in the doors' own phase, because the
          // copy's exit is driven by it.
          const doorP = gsap.utils.clamp(0, 1, (vh - 252) / 75);
          const exitP = STACK_OUT(
            gsap.utils.clamp(0, 1, doorP / COPY_EXIT_AT_DOOR),
          );

          gsap.set(
            gapHeadRef.current,
            // inP=1 throughout: it arrived by growing in place rather than by
            // rising, so scroll only ever demotes it and then takes it out.
            stackSeat(
              (0.8 + 0.2 * headP) *
                gsap.utils.interpolate(1, HEAD_SHIFT_SCALE, handoff),
              HEAD_SHIFT_Y * handoff,
              1,
              exitP,
            ),
          );
          gsap.set(gapSubRef.current, stackSeat(1, 0, STACK_IN(handoff), exitP));

          // The container carries only the initial fade-up, on the heading's
          // window. Both lines leave under their own power, so there is no
          // fade-out here to fight them — and holding the fade-in at this level
          // is still what stops either line showing before the first onUpdate
          // has had a chance to seat them.
          gsap.set(contentRef.current, { opacity: headP });

          // --- Phase 4: doors open diagonally, then stop (252 – 327vh) ---
          // The original motion, unchanged in character: each panel slides out
          // while drifting vertically, with the drift finishing ahead of the
          // slide (hence `drift` running on doorP/0.7). The only difference is
          // where it ends — at DOOR_REST_*, so both panels stay on screen as
          // corner wedges instead of carrying on out of frame. `doorP` itself
          // is computed up in phase 3, which needs it to drive the copy's exit.
          const drift = gsap.utils.clamp(0, 1, doorP / 0.7);
          gsap.set(panelLeftRef.current, {
            x: -doorP * W * DOOR_REST_X,
            y: drift * H * DOOR_REST_Y,
          });
          gsap.set(panelRightRef.current, {
            x: doorP * W * DOOR_REST_X,
            y: -drift * H * DOOR_REST_Y,
          });

          // --- Phase 5: the ribbon draws itself in, right to left (302–352vh) ---
          // A clip rather than a fade, so it reads as the wave travelling
          // across the gap. It grows out of the top-right wedge towards the
          // bottom-left one, which is the same direction the copy runs along
          // it. Deliberately a tight window — 50vh — so one continuous scroll
          // takes it from nothing to full width instead of needing several.
          const drawP = gsap.utils.clamp(0, 1, (vh - 302) / 50);
          gsap.set(wavyRef.current, {
            clipPath: `inset(0 0 0 ${(1 - drawP) * 100}%)`,
          });

          // --- Phase 6: the closing line follows it (367 – 417vh) ---
          gsap.set(leapRef.current, {
            opacity: gsap.utils.clamp(0, 1, (vh - 367) / 50),
          });

          // --- Phase 7: hold (417 – 444vh) — nothing scroll-driven changes,
          // so this is pinned screen where scrolling does nothing. Kept to
          // roughly half a screen: enough of a beat to read the finished
          // composition, short enough that it never reads as being stuck.
          // The ribbon's marquee carries on under its own timeline.
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
      style={{ height: reducedMotion ? "100vh" : `${SECTION_VH}vh` }}
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

          {/* The footage, seen through a rectangular hole in the orange. The
            box never moves or resizes — only its clip does, narrowing over a
            still image of fixed size until nothing is left but the closed
            doors behind it, so the screen simply "becomes orange". Starting
            sealed (rather than with a `scale-0` class) is what keeps it from
            flashing before the entrance animation opens it. */}
          <div
            ref={videoBoxRef}
            className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-75 min-w-35 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            style={{ clipPath: holeClip(1) }}
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
              <GapCopy overlay headRef={gapHeadRef} subRef={gapSubRef} />
            </div>
          )}

          {band && (
            <>
              {/* Placed at the geometry's own `top`, not centred, because its
                ends have to meet the wedge corners exactly. The clip is what
                draws it in right-to-left on scroll; reduced motion just shows
                it whole. */}
              <div
                ref={wavyRef}
                className="pointer-events-none absolute z-20"
                style={{
                  left: BAND_INSET,
                  right: BAND_INSET,
                  top: band.top,
                  clipPath: reducedMotion ? undefined : "inset(0 0 0 100%)",
                }}
              >
                <WavyBand g={band} animate={!reducedMotion} />
              </div>

              {/* Centred on the stage itself rather than boxed inside the
                band's inset, because this line is deliberately wider than that
                gap. Sized to its own content and pulled back half its width,
                so its midpoint is the screen's midpoint at any font size and
                the overhang is always even on both sides — a fixed box with
                centred text distributes overflow far less predictably, which
                is what made it drift right as the type grew. GSAP only ever
                writes `opacity` here, so the translate survives. */}
              <div
                ref={leapRef}
                className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 text-center"
                style={{
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
