/**
 * The wordmark's three dots: where they sit, how big they are at both ends of the
 * flight, and the ballistics that carry them between the two.
 *
 * Everything here is pure — no DOM, no GSAP. `measure` supplies the two endpoints
 * per viewport and `planFall` solves the trajectory once; the per-frame work in
 * ./sequence is then a lookup.
 */

/**
 * Where the wordmark's three dots sit inside its own box — the tittle on the
 * "i", the terminal on the "r", and the full stop. Measured off the alpha
 * channel of public/img/logo-white.png (each is a separate connected shape in
 * it), so they are exact rather than eyeballed: `cx` and `d` are fractions of
 * the wordmark's width, `cy` a fraction of its height. The mask is `contain` and
 * the box carries the asset's own aspect ratio, so the artwork fills it exactly
 * and these map straight onto the rendered element.
 *
 * Left to right, they map onto footer columns 1, 2, 3.
 */
export const LOGO_DOTS = [
  { cx: 0.04708, cy: 0.11494, d: 0.09443 },
  { cx: 0.58527, cy: 0.45083, d: 0.09417 },
  { cx: 0.95082, cy: 0.88442, d: 0.09443 },
] as const;

/**
 * The wordmark's rendered width, and the one place it is written.
 *
 * Shared because the footer's dots are derived from it (below): the dot that lands
 * in the footer is the same dot that left the wordmark, so its size cannot be an
 * independent choice at the other end.
 */
export const MARK_WIDTH = "max(240px, min(29vw, 53vh, 520px))";

/**
 * The footer dot, and therefore the size each falling dot settles at — which is
 * exactly the size it had on the wordmark, by construction.
 *
 * It was an independent `clamp(24px, 2.4vw, 36px)`, and the dots shrank across their
 * flight to reach it: the launch scale is `logo diameter / slot size` easing to 1, so
 * a slot smaller than the wordmark's dot *is* a shrink. At 1920 that was 49px → 36px,
 * a quarter of the dot lost on the way down, which reads as the dots receding rather
 * than falling.
 *
 * Derived from MARK_WIDTH and the artwork's own dot diameter instead, so the two ends
 * agree at every viewport and the flight is a pure translation. `min`/`max` distribute
 * over a positive scalar, so this is the wordmark's dot diameter exactly, not an
 * approximation of it — and `scale0` therefore lands on 1 without being special-cased.
 *
 * The knock-on is that the footer's columns grow a little on a wide screen, since the
 * pad above each heading is bigger. Nothing needs adjusting for it: `camEnd` is
 * measured from the footer's real height, so the camera's travel follows.
 */
export const FOOTER_DOT_SIZE = `calc(${MARK_WIDTH} * ${LOGO_DOTS[0].d})`;

/**
 * Three balls of the same material thrown slightly differently, which is the
 * whole point — identical arcs read as one animation played three times.
 *
 * The solved trajectory (planFall) supplies weight and momentum. These supply
 * the imperfection around it, and each is a separate beat of the gesture:
 *
 *   `anticipate`  a few px *back* into the wordmark before letting go — the
 *                 load-up. Without it the dot is simply already moving on the
 *                 first frame, which is the single biggest tell of a tween.
 *   `kick`        a sideways shove at the moment of release, spent within the
 *                 first fifth of the flight, so the dot pops away from the mark
 *                 rather than setting off toward its column.
 *   `restitution` speed kept at each impact, so it sets both bounce height and
 *                 how quickly the dot gives up.
 *   `drift`       a sideways bow across the whole flight, in px at 1440 wide.
 *   `drag`        the exponent on its horizontal ease-out. Different per dot so
 *                 that even the lateral travel is not a shared curve.
 */
export const DOT_PHYSICS = [
  { lift: 18, restitution: 0.85, drift: 18, drag: 2.6, kick: 10, anticipate: 4 },
  { lift: 14, restitution: 0.90, drift: -13, drag: 3.1, kick: -7, anticipate: 3 },
  { lift: 20, restitution: 0.95, drift: 22, drag: 2.3, kick: 12, anticipate: 5 },
] as const;

/** How far past its slot the dot carries on the first impact, in px. */
export const DOT_PENETRATE_PX = 6;

/** Fractions of a flight: the load-up, the sideways kick, one penetration. */
export const ANT_SPAN = 0.09;
export const KICK_SPAN = 0.2;
const PEN_SPAN = 0.035;

/**
 * A single 0 → 1 → 0 bump across [0, span], squared so it leaves and returns to
 * zero with zero *slope* as well as zero value. That matters at the moment of
 * release: a plain sine starts at full speed, so the dot snapped sideways on the
 * frame it detached instead of easing out of the wordmark.
 */
export const bump = (p: number, span: number) =>
  p <= 0 || p >= span ? 0 : Math.sin(Math.PI * (p / span)) ** 2;

/**
 * Impacts before the dot is allowed to be still. Four, because at this
 * restitution the third is still worth seeing — the heights fall off as the
 * square of the ratio, so 0.55 gives roughly 30%, 9% and 3% of the drop, and
 * only the fourth is genuinely too small to notice.
 */
const DOT_BOUNCES = 2;

/** A settled tail on the end of each fall, as a fraction of its descent. */
const DOT_REST = 0.08;

export type Fall = {
  /** Upward launch speed. */
  v0: number;
  /** When it first reaches the slot. */
  land: number;
  /** Launch speed of each bounce, which is also that bounce's duration. */
  hops: number[];
  /** The whole trajectory, including the settled tail. */
  total: number;
  /** Normalized time of each impact, for the penetration pulse. */
  impacts: number[];
  /**
   * This flight's length as a share of the longest of the three, which is how
   * one gravity is imposed on all of them — assigned once all three are planned.
   */
  share: number;
  /** Net descent, in px. Negative when the slot is above the release point. */
  drop: number;
};

/**
 * Solves a dot's trajectory once, so the per-frame work is a lookup.
 *
 * Everything is in a unit system where the acceleration is 2, which makes a drop
 * from rest exactly `t²` px and keeps the algebra free of constants. `t`
 * therefore carries units of √px, and that is the useful part: a fall twice as
 * far takes √2 times as long. Handing each dot a scroll window proportional to
 * its own `total` — see the caller — is what puts all three under *one* gravity
 * instead of three, so they read as the same material rather than as three
 * separately-tuned animations. Without it the shortest fall looks like a
 * feather.
 *
 * The trajectory: rise `lift` px, fall to the slot, then DOT_BOUNCES parabolic
 * hops each keeping `restitution` of the impact speed, then rest.
 */
export function planFall(
  drop: number,
  lift: number,
  restitution: number,
): Fall {
  // Thrown up hard enough to still be coming *down* onto the slot even when the
  // slot is above the release point — which is the case on a phone, where the
  // stacked footer puts the first column higher than the wordmark. Below this
  // the descent has no real solution at all and the dot would have to climb.
  const rise = Math.max(lift, lift - drop);
  const v0 = 2 * Math.sqrt(rise);
  const impact = Math.sqrt(v0 * v0 + 4 * drop);
  const land = (v0 + impact) / 2;

  const hops: number[] = [];
  let u = impact * restitution;
  for (let k = 0; k < DOT_BOUNCES; k++) {
    hops.push(u);
    u *= restitution;
  }

  const total = land + hops.reduce((a, b) => a + b, 0) + DOT_REST * land;

  // Contact times, normalized. Only the first two are ever used — by the third
  // the dot has no energy left to squash with, and leaving the last one out is
  // also what guarantees the pulse cannot still be running at p = 1 and leave
  // the dot resting a pixel below its column.
  const impacts: number[] = [];
  let at = land;
  for (const u of hops) {
    impacts.push(at / total);
    at += u;
  }

  return { v0, land, hops, total, impacts, share: 1, drop };
}

/**
 * How far *past* the slot the dot is at time `p` — the give on impact. A ball
 * does not stop dead on contact; it carries a little way in, then comes back.
 * Halved at each successive impact, along with everything else.
 */
export function penetrationAt(f: Fall, p: number) {
  let out = 0;
  for (let k = 0; k < Math.min(2, f.impacts.length); k++) {
    const d = Math.abs(p - f.impacts[k]) / PEN_SPAN;
    if (d < 1) {
      out += DOT_PENETRATE_PX * 0.5 ** k * (1 + Math.cos(Math.PI * d)) * 0.5;
    }
  }
  return out;
}

/** How far below its release point the dot is, at progress `p` of its fall. */
export function fallAt(f: Fall, p: number) {
  const t = p * f.total;
  // The descent: thrown up at v0 against an acceleration of 2. Reaches exactly
  // `drop` at `land`, by construction.
  if (t <= f.land) return t * t - f.v0 * t;
  // Then one parabola per bounce, each leaving and returning to the slot.
  let r = t - f.land;
  for (const u of f.hops) {
    if (r < u) return f.drop - (u - r) * r;
    r -= u;
  }
  return f.drop;
}
