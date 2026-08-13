import { gsap } from "@/lib/gsap";
import { DOOR_PANEL_W, DOOR_REST_X, DOOR_REST_Y } from "./doors";

/**
 * The ribbon's geometry and its two SVG paths. Everything here is derived from the
 * stage's measured size, so the wave re-solves on resize rather than being tuned
 * per breakpoint.
 */

/**
 * The ribbon draws in and closes in the same direction, right-to-left, so its whole
 * life is one sweep of a single wipe position: −1 undrawn (pinched at the right), 0
 * fully drawn, +1 closed (pinched at the left).
 *
 * One number rather than three named states, and that is what makes the wave
 * interruptible without a glitch. As three states it was three tweens between fixed
 * clip strings, and a scroll fast enough to cross the draw and close marks inside the
 * draw's own 0.9s killed a half-drawn wave and sent it to the *opposite* pinch — so it
 * jumped across the screen instead of carrying on. Along one axis there is nothing to
 * jump to: a target crossed mid-flight just retargets the sweep, and the wave keeps
 * travelling the way it was already going, faster.
 */
export const bandClip = (w: number) =>
  `inset(0% ${(Math.max(0, w) * 100).toFixed(3)}% 0% ${(Math.max(0, -w) * 100).toFixed(3)}%)`;

export const BAND_UNDRAWN = -1;
export const BAND_FULL = 0;
export const BAND_CLOSED = 1;
/** The markup's starting state, so the ribbon is not painted before it is cued. */
export const BAND_CLIP_UNDRAWN = bandClip(BAND_UNDRAWN);

/** Gap between the ribbon's box and the closing line beneath it, in px. */
export const LEAP_GAP = 56;
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
export function bandGeometry(stageW: number, stageH: number) {
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

export type BandGeometry = ReturnType<typeof bandGeometry>;

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
export const bandTextPath = (g: BandGeometry) =>
  `M 0 ${waveY(g, 0) + g.baselineShift} ${waveRun(g, g.baselineShift, false)}`;

/** The ribbon: the same wave offset up and down by half its thickness. */
export const bandOutlinePath = (g: BandGeometry) => {
  const half = g.thickness / 2;
  return [
    `M 0 ${waveY(g, 0) - half}`,
    waveRun(g, -half, false),
    `L ${g.width} ${waveY(g, g.width) + half}`,
    waveRun(g, half, true),
    "Z",
  ].join(" ");
};
