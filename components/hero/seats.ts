import { gsap } from "@/lib/gsap";

/**
 * The centre seat every line on the stage passes through, and the three ways of
 * sitting in it: the gap copy's (stackSeat), the lead line's arrival with the
 * doors (leadSeat), and the closing line's recession (leapSeat).
 *
 * All three return a plain object for `gsap.set`. The −50s are folded into
 * xPercent/yPercent because driving either at all would overwrite a class-based
 * translate, so GSAP has to own both halves of the centring.
 */

/**
 * The two ends of that travel, deliberately not mirror images: a line settles in
 * from just below, barely smaller and barely soft, and leaves by climbing further
 * away while shrinking and blurring out. Every line *leaves* that way, the lead
 * line included; only its arrival is different.
 *
 * `y` is a fraction of the viewport height, not of the element, so every line
 * travels the same distance despite them not being the same height.
 *
 * These end states govern how much has to happen in the window, which is the one
 * lever here that changes how it *looks* rather than its pace. Keep the exit's
 * terms in proportion: at scale 0.45 it was collapsing nearly three times as far as
 * the arrival's 0.82 → 1, one term running away with the whole gesture. At 0.70,
 * blur eased back to match, every term sits in a 2.2–2.8× band against the arrival.
 */
export const STACK_IN_END = { y: 0.08, scale: 0.82, blur: 3 };
const STACK_OUT_END = { y: -0.12, scale: 0.7, blur: 4 };

/**
 * `sine.inOut` at both ends, and both used to be a `power1` half-curve pointing
 * the wrong way: `power1.out` leaves at *twice* the average rate and then creeps,
 * so a line lunged out of nothing and crawled the rest — and widening the window
 * only made the crawl longer, never the lunge gentler. `power1.in` was the same
 * fault mirrored on the exit, which left travelling flat out at the moment it
 * vanished. `sine.inOut` starts and ends at zero velocity, crossing at a peak of
 * only 1.57× the average, so nothing is ever already at full speed. The asymmetry
 * that matters was never in the eases — it is in the end states above.
 */
export const STACK_IN = gsap.parseEase("sine.inOut");
export const STACK_OUT = gsap.parseEase("sine.inOut");

/**
 * How much of the lead line's growth is spent fading up. It grows out of a literal
 * point, so without this it arrives as a speck on the orange; a fade across the
 * first slice of the growth resolves it out of the surface instead.
 *
 * Sized in growth and not in scroll, which is what has kept it right through the
 * opening becoming fully cued: the doors carry the line the whole way now, and 0.18
 * of the growth is very nearly the whole of the crack (see DOOR_AJAR), so the line
 * resolves out of the orange on the first scroll and does its growing on the second.
 */
const GROW_FADE = 0.18;

/**
 * One line's state in that seat. `away` is the single travel axis — 1 waiting
 * below, 0 seated, −1 gone above — and its sign picks which end is being travelled
 * to, which is the only place the arriving/leaving asymmetry lives.
 */
export function stackSeat(viewportH: number, inP: number, outP: number) {
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
 * The lead line's seat. It grows out of the point the doors part from, on the
 * *aperture's* progress rather than a window of its own, so the two are one gesture
 * and land together by construction.
 *
 * That progress is deliberately uneased: the panels travel linearly, so the gap
 * widens linearly and the line's width is linear in `growP` — the copy fills the
 * same fraction of the opening at every frame and reaches full size on the frame
 * the panels stop. Any ease would put the text ahead of or behind the doors, which
 * is the one thing this is for.
 *
 * Only the arrival is written here; the exit is stackSeat's, from fully seated. The
 * two meet exactly — growth finished with outP 0 is scale 1, y 0, opacity 1 and no
 * filter in both — so the handover is a continuation, not a switch.
 *
 * `growP` multiplies into that exit rather than being dropped at it. Handing
 * straight to `stackSeat(viewportH, 1, outP)` asserts the line is fully grown, so
 * an early exit snapped it to full size in one frame and climbed away, appearing to
 * burst out of a gap that was still opening. The copy's origin makes that almost
 * unreachable (see COPY_SQUEEZE_MAX); this is the backstop, at the cost of a
 * multiply by 1.
 */
export function leadSeat(viewportH: number, growP: number, outP: number) {
  if (outP > 0) {
    const seat = stackSeat(viewportH, 1, outP);
    return { ...seat, scale: seat.scale * growP };
  }
  return {
    xPercent: -50,
    yPercent: -50,
    y: 0,
    scale: growP,
    opacity: gsap.utils.clamp(0, 1, growP / GROW_FADE),
    // No blur on this arrival, unlike the others': theirs is carried for a 35vh
    // beat, this one would be carried for the whole door opening, and a filter
    // costs subpixel antialiasing for every frame it is on.
    filter: "none",
  };
}

/**
 * The closing line's own seat. It arrives exactly as the gap copy does, but leaves
 * by *receding*: opacity holds at 1 and the scale runs to zero, with no rise and no
 * blur, so it reads as being drawn back through the gap the doors are closing rather
 * than dissolving where it stands.
 *
 * The recession must be linear in the raw scroll ramp, which is why this cannot
 * reuse STACK_OUT: the line is as wide as the gap it sits in and the panels are
 * closing on it at a known rate, so anything slower than linear leaves its ends
 * hanging over the orange — and `text-accent` is the panels' own colour, so those
 * words would vanish while the ink half stayed visible at full opacity. Linear beats
 * them everywhere: the line's width falls by 0.42·p of the viewport against the
 * gap's 0.30·p.
 */
export function leapSeat(viewportH: number, inP: number, outP: number) {
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
