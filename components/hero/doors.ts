/**
 * The two orange panels and the rectangular hole the footage is seen through —
 * pure geometry, no timing. The timeline (see ./timeline) derives several of its
 * marks from DOOR_SEALED_AT, so this module has to be the one that owns it.
 */

/**
 * Where the doors come to rest, as fractions of the viewport: they stop here
 * instead of leaving frame, parking as orange wedges in the bottom-left and
 * top-right corners. DOOR_REST_X is the one knob for how much orange stays.
 *
 * The panels are 58% wide each, so closed they overlap by 16% of the screen and
 * a gap only appears once doorP passes DOOR_SEALED_AT — "the doors are moving"
 * and "the doors are visibly opening" are different moments, and the lead line
 * of the copy grows on the second (see leadSeat).
 */
export const DOOR_PANEL_W = 0.58;
export const DOOR_REST_X = 0.29;
export const DOOR_REST_Y = 0.73;

/**
 * The doorP below which the panels overlap and the stage reads as unbroken
 * orange: they are DOOR_PANEL_W wide each, so their 16% overlap covers the gap
 * before they have finished travelling. Closing, that lands at 72% of the way.
 */
export const DOOR_SEALED_AT = (2 * DOOR_PANEL_W - 1) / (2 * DOOR_REST_X);

/**
 * How far past the viewport each panel extends, top and bottom, as a fraction of the
 * stage's height. The panels are oversized because the diagonal drift slides them off
 * their own short edge; this is the room that gives it.
 *
 * Owned here rather than written into the markup because three places depend on it:
 * the panel's own box, the ribbon's anchors (a wedge's inner corner is this far from
 * DOOR_REST_Y — see ./band), and DOOR_DRIFT_SAFE below.
 */
export const DOOR_PANEL_OVERHANG = 0.25;

/**
 * The panels overlap each other by an extra 2px at every position.
 *
 * Without it their inner edges merely *touch* at DOOR_SEALED_AT, and ScrollSmoother
 * scrolls by fractional pixels — so on the frame they meet, rounding can leave a
 * hairline of the footage between them, straight down the middle of a stage that is
 * supposed to read as unbroken orange.
 *
 * Each panel is anchored to its own outer edge, so this grows the inner edge inward
 * and never moves the wedge's outer boundary. BAND_INSET already tucks the ribbon 2px
 * under that edge; this makes the tuck 4px, which is the safe direction.
 */
export const DOOR_PANEL_BLEED_PX = 2;

/**
 * How far the panels have drifted vertically by the time they have slid `doorP` of
 * the way, and the exponent that keeps that from outrunning the seal.
 *
 * The drift finishes ahead of the slide — that is what makes the opening read as
 * diagonal rather than as two shutters — but it cannot finish *so* far ahead that a
 * panel's short edge climbs into frame while the two are still overlapped. In that
 * window the stage is supposed to be unbroken orange, and an exposed short edge is a
 * band of footage across the top-left and bottom-right of it.
 *
 * Linear drift did exactly that. At DOOR_SEALED_AT it reached 0.394 against a ceiling
 * of DOOR_DRIFT_SAFE = 0.342, so for doorP between 0.240 and 0.276 — sealed, solid,
 * nothing meant to be moving — a strip up to 3.8% of the viewport's height showed the
 * video. Shaping the ramp holds the drift under the ceiling until the aperture has
 * genuinely opened, and changes nothing at either end: drift is still 0 at rest and
 * still 1 by DOOR_DRIFT_FRAC, so the wedges at rest are untouched.
 */
export const DOOR_DRIFT_FRAC = 0.7;
export const DOOR_DRIFT_POW = 1.35;

/** The drift at which a panel's short edge reaches the viewport's edge. */
export const DOOR_DRIFT_SAFE = DOOR_PANEL_OVERHANG / DOOR_REST_Y;

/** The vertical drift for a given slide progress. 0 at rest, 1 by DOOR_DRIFT_FRAC. */
export const doorDrift = (doorP: number) =>
  Math.min(1, Math.max(0, doorP / DOOR_DRIFT_FRAC)) ** DOOR_DRIFT_POW;

if (process.env.NODE_ENV !== "production") {
  const atSeal = doorDrift(DOOR_SEALED_AT);
  if (atSeal > DOOR_DRIFT_SAFE) {
    console.error(
      "[hero/doors] the drift outruns the seal: at DOOR_SEALED_AT it reaches " +
      `${atSeal.toFixed(3)} against a ceiling of ${DOOR_DRIFT_SAFE.toFixed(3)}. ` +
      "A panel's short edge will show a band of footage across a stage that is " +
      "meant to be solid orange. Raise DOOR_DRIFT_POW or DOOR_PANEL_OVERHANG.",
    );
  }
}

/**
 * How far the ribbon tucks under each wedge, in px, so no rounding difference can
 * show a hairline of background between the two orange shapes.
 *
 * Was a `calc(% - 2px)` string here and is a number the ribbon's geometry carries
 * instead (see `inset` in ./band), because the percentage it was built from is no
 * longer one number — the wedges are narrower below DOOR_NARROW_MAX_W. One measured
 * figure on the geometry object cannot disagree with itself the way two derivations
 * of the same percentage could.
 */
export const BAND_TUCK_PX = 2;

/**
 * The clear span the doors leave between the wedges once they are at rest, as a
 * fraction of the viewport width.
 *
 * Not an independent number, and worth being explicit about because it reads
 * like one: a wedge is DOOR_PANEL_W − DOOR_REST_X wide and this is whatever the
 * two of them leave. There is one degree of freedom here, not two — widening the
 * gap *is* shrinking the wedges, and DOOR_REST_X is the only knob for either.
 */
export const APERTURE = 1 - 2 * (DOOR_PANEL_W - DOOR_REST_X);

/**
 * The doors solved for a chosen *aperture* rather than a chosen rest position — which
 * is the whole reason a second, wider geometry is affordable on a phone.
 *
 * Widening the gap is shrinking the wedges (see APERTURE), and doing that the obvious
 * way — raising DOOR_REST_X on its own — moves DOOR_SEALED_AT, because that is the
 * panels' overlap measured against their travel. DOOR_SEALED_AT is not a local
 * number: CLOSE_SEALED_P is derived from it, the wash to gray is spanned against
 * that, the closing line's recession is scaled by it, and ./sequence solves APERTURE_AT
 * and SEAL_END out of it against the two legs' eases. A per-breakpoint DOOR_SEALED_AT
 * would mean a per-breakpoint timeline, and there is only one timeline.
 *
 * So the seal is held fixed and the pair is solved for it. From S = (2W − 1) / 2X,
 * with W = X + wedge and aperture = 1 − 2·wedge:
 *
 *     restX = aperture / (2 · (1 − S))          panelW = restX + wedge
 *
 * Feeding it APERTURE returns DOOR_REST_X and DOOR_PANEL_W exactly — asserted below,
 * because that identity is the entire guarantee that md and up did not move. Every
 * beat in ./timeline is therefore the same number at every width; the only thing that
 * changes across the breakpoint is how much orange stays on screen.
 */
export function doorsForAperture(aperture: number) {
  const wedge = (1 - aperture) / 2;
  const restX = aperture / (2 * (1 - DOOR_SEALED_AT));
  return { aperture, wedge, restX, panelW: restX + wedge };
}

/**
 * The gap below DOOR_NARROW_MAX_W, and why a phone needs a figure of its own.
 *
 * Everything that sits in the gap is sized to the gap — the lead line of the copy
 * (see GAP_LEAD_EMS), the ribbon, and the closing line (see LEAP_EMS). At 0.42 of a
 * 390px phone the gap is 164px, and there is no readable size at which "until you
 * make the leap" fits inside 164px, so the line sat across both wedges in the panels'
 * own colour. The ribbon had the mirrored problem: three half-waves asked of a 168px
 * span, which drove the amplitude into the tilt clamp (13px against an intended
 * 15–25) and made a short fat scribble of what is supposed to be a gentle wave.
 *
 * 0.66 leaves a wedge of 0.17 — 66px on that phone, still plainly a corner of orange
 * rather than a border stripe — and takes the gap to 257px, which is room for the
 * ribbon to be a wave and for the closing line to sit inside it on two lines. This is
 * the one knob: raise it for more room and less orange, lower it for the reverse.
 */
export const NARROW_APERTURE = 0.66;

/**
 * Where the wider geometry gives way, in px of stage width. Tailwind's `md`, so the
 * doors change on the same line the type sizes and the padding already do.
 */
export const DOOR_NARROW_MAX_W = 768;

const WIDE = { ...doorsForAperture(APERTURE), narrow: false };
const NARROW = { ...doorsForAperture(NARROW_APERTURE), narrow: true };

export type DoorGeometry = typeof WIDE;

/**
 * The door geometry for a stage of this width. Everything that has to agree with the
 * wedges reads it from here — the panels' box, their travel, the ribbon's inset and
 * hump count, the closing line's size and line count — so the breakpoint is one
 * predicate rather than a number restated in five files.
 *
 * A stage of 0 is *unmeasured*, not narrow, and resolves to WIDE: the width arrives
 * from a ResizeObserver a commit after mount, and resolving it to NARROW meanwhile
 * would flash the phone geometry onto a desktop. Going the other way is invisible,
 * because at first paint the doors are shut and both geometries overlap the screen.
 */
export const doorsFor = (stageW: number): DoorGeometry =>
  stageW > 0 && stageW < DOOR_NARROW_MAX_W ? NARROW : WIDE;

if (process.env.NODE_ENV !== "production") {
  const sealOf = (g: DoorGeometry) => (2 * g.panelW - 1) / (2 * g.restX);
  for (const g of [WIDE, NARROW]) {
    if (Math.abs(sealOf(g) - DOOR_SEALED_AT) > 1e-9) {
      console.error(
        "[hero/doors] a door geometry no longer seals at DOOR_SEALED_AT: " +
        `${sealOf(g).toFixed(6)} against ${DOOR_SEALED_AT.toFixed(6)} at aperture ` +
        `${g.aperture}. ./timeline is derived from that fraction, so it is no longer ` +
        "width-independent — the wash, the closing line's recession and SEAL_END all " +
        "move. Solve the pair with doorsForAperture rather than writing one out.",
      );
    }
  }
  // The other half of it: the solver has to reproduce the written pair, or `md` and up
  // have silently moved and every figure in ./timeline's phase map is stale.
  if (
    Math.abs(WIDE.restX - DOOR_REST_X) > 1e-9 ||
    Math.abs(WIDE.panelW - DOOR_PANEL_W) > 1e-9
  ) {
    console.error(
      "[hero/doors] doorsForAperture(APERTURE) no longer returns the written pair: " +
      `restX ${WIDE.restX.toFixed(6)} vs ${DOOR_REST_X}, panelW ` +
      `${WIDE.panelW.toFixed(6)} vs ${DOOR_PANEL_W}. Wide viewports have changed.`,
    );
  }
}

/**
 * The rectangular hole in the orange: p=0 is fully open, p=1 is sealed. Driving
 * the window rather than the box's scale keeps the footage still. Horizontal
 * only — the hole holds its full height and narrows to nothing.
 *
 * At p=1 the two insets meet at exactly 50%, which is a zero-width region
 * geometrically and not reliably one on screen: the box is sized in vw, so at most
 * viewport widths it lands on a fractional pixel and the halves can round apart far
 * enough to paint a one-pixel column of the footage. That column shows *over* the
 * panels, the box being z-20 against their z-10 — a thin dark line down the middle of
 * a stage that is meant to be solid orange.
 *
 * Over-closing past 50% is the obvious fix and is not available: the hole has to
 * outlive the aperture opening (see SEAL_OVERSHOOT), and anything past ~0.3% here —
 * well under a pixel, so no use against rounding — shuts it before the gap appears
 * and puts bare orange between the two. `paintStage` hides the box outright at p=1
 * instead, which is exact and costs no timing.
 */
export const holeClip = (p: number) => {
  const edge = (p * 50).toFixed(3);
  return `inset(0% ${edge}% 0% ${edge}%)`;
};
