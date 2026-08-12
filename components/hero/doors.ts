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

// Derived from the doors rather than restated, so the two cannot drift apart.
// Tucks 2px under each panel so no rounding can show a hairline between them.
export const BAND_INSET = `calc(${((DOOR_PANEL_W - DOOR_REST_X) * 100).toFixed(2)}% - 2px)`;

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
 * The rectangular hole in the orange: p=0 is fully open, p=1 is sealed. Driving
 * the window rather than the box's scale keeps the footage still. Horizontal
 * only — the hole holds its full height and narrows to nothing.
 */
export const holeClip = (p: number) => {
  const edge = (p * 50).toFixed(3);
  return `inset(0% ${edge}% 0% ${edge}%)`;
};
