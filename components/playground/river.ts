import { gsap } from "@/lib/gsap";
import { NARROW_RIVER_MIN_FRAC } from "./metrics";

/**
 * The river — the orange ribbon that winds down the playground section.
 *
 * **No anchor in WIDE_ANCHORS has been moved.** The table is what it always was, and it was
 * never all transcription — the ridge is measured, the hump at the bottom is recovered off its
 * own unclipped top edge, and the bend linking the two is authored by an earlier build. The
 * entries say which is which; read them before treating any of it as evidence.
 *
 * What *this* build changes is where that drawing sits on the stage, how far its bottom hook
 * reaches, and the one corner in it that could not survive being seen — all in `placeWide`.
 * The tail ran a hundred pixels below the fold and surfaced again in the corner, which on
 * screen is a severed blob and was reported as one. See "Why the drawing is lifted, and what
 * that buys" over those constants.
 * The narrow drawing is not a piece of this one at all — see "Why there are two shapes" — so
 * the handful of figures that are preferences rather than measurements all sit with it, under
 * `narrowPoints`. Each says so where it stands.
 *
 * ## Where the shape comes from
 *
 * The reference recording is a 1904 × 913 viewport: the browser area above the taskbar in
 * `hero-playground.mp4`. The centreline was recovered from it by masking the accent colour,
 * filling the glyph holes, taking a distance transform and ridge-following that from a seed
 * inside the ribbon — so these anchors are the ribbon's drawn centre, not an edge.
 *
 * It was worth establishing what the shape is *not*, because both wrong answers are the
 * ones anyone would reach for first and both are cheap to re-derive:
 *
 *  - **It is not a sine along a tilted axis** — the mechanism `hero/band.ts` uses. Fitting
 *    one over the free axis angle and wavelength leaves an rms residual of **65px** against
 *    an 80px-thick ribbon, i.e. the model misses by most of the ribbon's own width.
 *  - **It is not a sine-generated (Euler) meander** either, which is the shape family a real
 *    river belongs to. Fitting `θ(s) = axis + θ0·sin(2πs/L)` to the measured heading leaves
 *    **35° rms**. It fails because the reference's wavelength *tapers* — successive
 *    half-cycles measure 620, 340, 330, 270px of arc, and the heading amplitude falls from
 *    ±80° to ±53° with them.
 *
 * So it is a drawn path, and it is transcribed rather than modelled: WIDE_ANCHORS below are
 * the ridge resampled every 60px of arc, in normalised coordinates.
 *
 * ## Why there are two shapes
 *
 * WIDE_ANCHORS are laid onto the viewport by the same *non-uniform* map a viewport-unit
 * drawing would get (x across a fixed share of the width, y across the full height), which
 * is exact at the reference's own aspect and safe across desktop ones. It is not safe at
 * phone aspect, and the failure is specific: squashing x by `a` and y by `b` scales a
 * *horizontal* apex's radius of curvature by `a²/b`. At 390 × 844 that is 0.045, so the long
 * sweeping arm across the upper third — the reference's most characteristic feature, and the
 * only stretch where its copy reads almost level — collapses from a 153px radius to 7px
 * against a 40px ribbon. That is not a tight bend, it is a self-intersection.
 *
 * A narrow screen therefore gets its own shape rather than a crop or a squash of this one —
 * the same answer `hero/doors.ts` gives to the same kind of problem. **It is also a different
 * composition, not just a different curve.** On the wide layout the river takes the left of
 * the stage and the copy the right; a phone has no right-hand half to give the copy, and the
 * first narrow build tiled a meander down the whole height and set the paragraph *over* it,
 * which was reported as the two overlapping ("the scrolling text is overlapping the text in
 * the red strip"). So the narrow layout splits the stage the other way: the copy rests on the
 * bottom gutter and the river takes whatever is left above it, sweeping from the left edge low
 * in that room to the top edge at the right — the desktop's own gesture (enters high and
 * right, leaves low and left) read in the copy's direction, in the room the copy leaves. The
 * bound it is solved against is the copy's *measured* resting top edge (`clearBelow`), so it
 * is a different river on every phone and never on the paragraph. See `narrowPoints`.
 *
 * Which of the two a viewport gets is `riverIsWide`, and it is an aspect test rather than a
 * width one — see there for the case that rules a breakpoint out.
 */

/** The reference viewport: the browser area in the recording, above the taskbar. */
const REF_W = 1904;
const REF_H = 913;

/**
 * The band of the reference viewport the river occupies, as fractions of its width — the
 * measured extremes of the drawn centreline (x 170 … 1046). WIDE_ANCHORS' first coordinate
 * is a fraction *of this band*, so the two travel together: widen the band and the whole
 * drawing widens with it.
 */
const RIVER_X0 = 170 / REF_W;
const RIVER_XW = 876 / REF_W;

/**
 * The ribbon's drawn width, measured where the path runs vertically and a scanline crosses
 * it square — 78–80px across four such stretches. It is rendered as a *stroke* rather than
 * as a solved outline (which is what `hero/band.ts` does): the reference's round caps are
 * visible at the bottom-left corner, and a stroke is the only construction that holds a
 * constant width through a bend tight enough to double back, which this path does four times.
 */
const REF_THICKNESS = 80;

/**
 * Type size as a share of the thickness. 46px on an 80px ribbon, recovered two ways that
 * agree: the "W" of a "Work" sitting on a level stretch measures 44 × 33px, which solves to
 * 46.2 against the font's 0.714 cap height and to 45.4 against its W advance.
 *
 * `hero/band.ts` uses 0.55 for the same relation, which is the same figure to within the
 * measurement.
 */
const FONT_OF_THICKNESS = 0.575;

/**
 * The ribbon's share of the stage's *height*. It is a bound, not a target — below it the
 * width's own share governs — and it binds only where the window is short for how wide it is
 * (h < 0.42w, so 1920×806 and shorter). It is a no-op at every viewport this drawing was
 * measured or checked at, the reference's 1904×913 included, where 0.10h is 91.3 against the
 * width's 80.
 *
 * It exists because the bottom hook has to clear the stage's bottom edge by half a ribbon,
 * and those two figures scale off different axes: without this the ribbon is still 92px wide
 * in a 600px-tall window, which leaves the hook 0.6px of daylight — a rounding away from the
 * flat slice the hook was placed to avoid. With it the worst case anywhere is 17px.
 */
const THICKNESS_OF_H = 0.10;

/**
 * The thickness a viewport gets, in px. The reference's own 80 at 1904 is 4.20% of the
 * width, and that share is what carries across — the clamp only binds below ~950px and
 * above ~2190px.
 *
 * The floor is not cosmetic: the ribbon's copy is the point of it, and below ~40px the
 * 23px type it carries stops being readable at arm's length.
 */
const thicknessFor = (w: number, h: number) =>
  gsap.utils.clamp(40, 92, Math.min(w * 0.042, h * THICKNESS_OF_H));

/**
 * The narrow river's thickness band — chosen rather than measured, since the reference has no
 * narrow layout to measure. 14.5% of the width (56 on a 390 phone), held between 44 and 66:
 * the floor is where the copy it carries stops being readable at arm's length, the ceiling
 * where a tablet's ribbon starts to read as a block rather than a line.
 *
 * It is also bounded by the room the river has (`bottom`, the stage above the copy): a ribbon
 * can only sweep through a strip about three times its own width — under that the two bends
 * either side of it are crushed into the edges — so a long paragraph on a short phone narrows
 * the ribbon before it crowds it. The floor still wins, which is what NARROW_RIVER_MIN_FRAC in
 * ./metrics then guards.
 */
const narrowThicknessFor = (w: number, bottom: number) =>
  gsap.utils.clamp(44, 66, Math.min(w * 0.145, bottom / 3));

/**
 * The shallowest bend in the transcribed run, in reference px — the bottom of the long
 * sweeping arm, where the path is horizontal and its radius of curvature measures 153.
 *
 * It is the bend that decides whether WIDE_ANCHORS can be used at all, and the arithmetic is
 * short enough to state: squash a curve by `a` horizontally and `b` vertically and a
 * *horizontal* apex's radius scales by `a²/b` (parametrise near the apex as
 * `y = Y − c·x²`; the squash gives `y' = bY − (bc/a²)x'²`). The two apexes go opposite ways —
 * a *vertical* one scales by `b²/a` and so only ever opens up — which is why this one alone
 * is the test.
 */
const WIDE_APEX_R = 153;

/**
 * How much of the ribbon's own width that bend has to keep as radius before the wide drawing
 * is given up on. Below 0.5 the stroke folds through itself; 1.1 leaves the bend visibly
 * open, and it is where the reference's own 1.91 has fallen to by the aspect at which the arm
 * stops reading as a sweep.
 */
const WIDE_APEX_MIN_R_OVER_T = 1.1;

/**
 * Below this the river takes the narrow sweep whatever the aspect: the wide drawing's copy
 * needs room to read along its shallow stretches, and a phone has none.
 */
export const RIVER_NARROW_MAX_W = 768;

/**
 * Whether a viewport can carry WIDE_ANCHORS.
 *
 * A width threshold alone cannot answer this, and the case that proves it is 768 × 1024 — wide
 * enough by any breakpoint, and the arm's 153px radius maps to 22px there against a 40px
 * ribbon, i.e. a hairpin folded through itself. The failure is driven by *aspect*, so that is
 * what is tested, through the measured bend rather than through a ratio standing in for it.
 *
 * The answer travels out on `riverFor`'s own `narrow`, because the layout has to make the
 * same decision: a narrow river takes the top of the stage, so the copy has to go full width
 * on the bottom gutter beneath it and take the scrim. Those cannot be left on a `md:` class
 * while this is on the aspect — the two would disagree for every tablet held upright.
 */
export function riverIsWide(w: number, h: number) {
  if (w < RIVER_NARROW_MAX_W || h <= 0) return false;
  const a = (w * RIVER_XW) / 876;
  const b = h / REF_H;
  return (
    (WIDE_APEX_R * a * a) / b >=
    WIDE_APEX_MIN_R_OVER_T * thicknessFor(w, h)
  );
}

/**
 * The drawn centreline, resampled every 60px of arc and normalised: `[u, v]` where u is a
 * fraction of the river's band (RIVER_X0 … RIVER_X0 + RIVER_XW) and v a fraction of the
 * viewport's height.
 *
 * ## The three kinds of entry below
 *
 * **The run** is the ridge itself, and it is the bulk of the list.
 *
 * **The ends of the run** are not the ridge, and that is the correction worth knowing about.
 * The ridge-follow drifts for its last few steps at either frame edge — the distance
 * transform has no ribbon beyond the frame to measure against, so it falls off and the walk
 * wanders sideways. Both ends therefore come from the row scan instead, whose midpoint *is*
 * the centreline for a straight tilted band. At the top that is x = 973/980/986/993 at
 * y = 12/24/36/48, a steady dx/dy of 0.56. At the bottom it is x = 436/446/452/458/465/472 at
 * y = 840…912, a leg running at a steady **62°** — against the **36°** the drifting ridge
 * reported for its final step. Shipping that step put a near-cusp in the bottom bend: the
 * radius swung 31px (under half the ribbon's own width) straight into a reversal, which is
 * visible as a pinch even though the anchors either side of it are right.
 *
 * **The head** continues the path out of frame, on the row scan's measured dx/dy.
 *
 * ## The tail was drawn to sit below the fold, and this build brings it up
 *
 * The paragraph above says what the tail is made of, and the distinction matters here: the
 * hump is recovered from the recording, and the bend linking it to the leg is authored. That
 * bend was placed against the one thing the recording fixes about it — no ribbon between
 * x≈285 and x≈420 on the last visible row — and **that evidence is exactly what put it below
 * the fold**.
 *
 * On screen the result reads as two shapes. Two of the ribbon's three crossings of the bottom
 * edge fall in the middle of the tail, so **230px of that edge carried no ink at all**
 * (x≈250…480 at 1920×915): the river runs off the bottom, and the hump sits in the corner as a
 * separate orange blob with nothing joining them. It was reported as exactly that — "cut off
 * and disconnected".
 *
 * So the anchors stay where they are and the *drawing* moves. RIVER_LIFT_V and the constants
 * under it bring the whole tail onto the stage. That does set the gap-in-the-last-row evidence
 * aside, since the bend is no longer below the fold at all — knowingly, and at the client's
 * asking, which is the one thing worth being explicit about before anybody treats the bend's
 * position as measured again.
 */
const WIDE_ANCHORS: readonly (readonly [number, number])[] = [
  // — head: off the top edge, on the row scan's measured dx/dy —
  [0.7831, -0.1972],
  [0.8311, -0.1205],
  [0.8733, -0.0548],
  [0.9087, 0.0],
  // — the run —
  [0.9247, 0.0263],
  [0.9483, 0.0671],
  [0.9811, 0.1244],
  [1.0029, 0.1863],
  [0.9969, 0.2506],
  [0.9632, 0.3072],
  [0.9130, 0.3508],
  [0.8564, 0.3841],
  [0.7898, 0.3957],
  [0.7225, 0.3865],
  [0.6582, 0.3641],
  [0.5965, 0.3357],
  [0.5351, 0.3068],
  [0.4711, 0.2871],
  [0.4062, 0.3040],
  [0.3823, 0.3600],
  [0.4151, 0.4165],
  [0.4634, 0.4630],
  [0.5097, 0.5112],
  [0.5407, 0.5689],
  [0.5295, 0.6318],
  [0.4823, 0.6774],
  [0.4194, 0.7023],
  [0.3553, 0.7246],
  [0.3072, 0.7689],
  // — TAIL_JOIN: the anchor the hook is scaled about, and the leg's own heading into it —
  [0.2892, 0.8317],
  [0.2951, 0.8967],
  [0.3219, 0.9595],
  [0.3447, 0.9989],
  // — tail: the linking bend below the fold (authored) …
  [0.3600, 1.0406],
  [0.3534, 1.0731],
  [0.3293, 1.0956],
  [0.2926, 1.1079],
  [0.2479, 1.1093],
  [0.1998, 1.0995],
  [0.1529, 1.0778],
  // … and the hump, off its own unclipped top edge —
  [0.1119, 1.0442],
  [0.0753, 1.0031],
  [0.0388, 0.9673],
  // — TAIL_CREST: the hump's apex, and the last turn before the river leaves the frame —
  [0.0023, 0.9562],
  // — the dive, away through the bottom-left corner —
  [-0.0342, 0.9646],
  [-0.0708, 0.9896],
  [-0.1073, 1.0302],
  [-0.1484, 1.0789],
  [-0.1941, 1.1336],
];

/**
 * ## Why the drawing is lifted, and what that buys
 *
 * The hook above needs 27.8% of the stage's height below its join, plus half a ribbon of
 * daylight under its trough, and at the reference's own placement it has 16.8% — so it hung a
 * hundred pixels past the fold and only its crest came back up, which is the severed blob in
 * the corner. The room has to come from somewhere, and there are only three places it can come
 * from. Two were tried and are wrong:
 *
 *  - **Shrinking the hook alone** needs it at 33% of its drawn size to fit under an unmoved
 *    join. At that size its crest rises 38px against an 80px ribbon — the wave is shallower
 *    than the line drawing it, so trough and crest merge into one blunt lobe.
 *  - **Compressing the run** to lift the join distorts every meander above it, and in the
 *    worst direction: a vertical squash scales a *vertical* apex's radius by b², so the arm's
 *    hairpin — already the tightest bend in the drawing, at 0.39× the ribbon's width —
 *    tightens to 0.28× at the compression needed.
 *
 * So the drawing is **translated**, which distorts nothing at all, and the top edge is what
 * pays. That is affordable for a reason specific to this drawing: `v` increases monotonically
 * from the head all the way down to the right-hand apex, so there is no turning point up there
 * for an edge to slice flat. The top edge can only ever cut the ribbon square across, which is
 * what "runs off frame" already looks like — and is what the river does at the top anyway. The
 * bottom edge is the only one that can cut a *bend*, which is the defect being removed.
 *
 * RIVER_LIFT_V is as far as that goes before the right-hand apex itself starts leaving the
 * frame; TAIL_SCALE covers the rest. At 0.90 the hook is a tenth smaller than drawn, its crest
 * still rises 1.57× the ribbon's width (the reference's own is 1.74×), and no bend anywhere in
 * the drawing is tighter than 0.90× of what the reference had at the same viewport — swept
 * over 1629 of them, 768×600 to 3840×1600, with the hook fully on screen and the ribbon
 * crossing the bottom edge exactly once at every one.
 */
const RIVER_LIFT_V = 0.16;

/** Index of the anchor the hook is scaled about — the last of the transcribed run. */
const TAIL_JOIN = 29;

/** Index of the crest — the last turn the reader sees before the river leaves the frame. */
const TAIL_CREST = 43;

/** The hook's size against its drawn one. See "Why the drawing is lifted" above. */
const TAIL_SCALE = 0.9;

/**
 * How much of the dive's horizontal travel is kept, and from which anchor past the crest it
 * starts being taken.
 *
 * Lifting the hook puts its crest 126px above the bottom edge rather than the reference's 40,
 * so the dive has three times as far to run before it leaves — and at the reference's own 50°
 * it spends that distance going *left*, reaching x≈0 and crossing the corner rather than the
 * bottom edge. A river that appears to start from the left-hand side has been reported once
 * already and is the one thing this must not do. Steepening the dive fixes it, and
 * TAIL_DIVE_FREE is what makes that free: the crest is a *horizontal* apex, so its radius is
 * the one in this drawing that collapses fastest under a horizontal squeeze (by a²/b — to
 * 0.22× the ribbon's width at 1024×768). Holding the squeeze off until the third anchor past
 * the crest leaves the crest set by its drawn neighbours alone, and the worst bend in the
 * drawing then stops moving with this figure at all. Swept: the exit lands at 4.1% of the
 * width at worst, against the reference's own 5.2%, and never through the left edge.
 */
const TAIL_DIVE_FREE = 3;
const TAIL_DIVE_SQUEEZE = 0.45;

/**
 * The crest's turn is **rounded, and that is a departure from the transcription** — the only
 * one in the drawing's shape rather than its placement.
 *
 * **The hump's apex is a corner, not a turn** — and it is one of the measured parts of the
 * drawing, so this is a change to the recording's own shape rather than to an earlier build's
 * guess. Anchors 41–46 carry a radius of 0.37–0.68× the ribbon's width where the bend either
 * side of them runs 1.1–2.2×. Below 0.5 a stroke folds through itself, so the *inner* edge of
 * that corner had a radius of about 3px on an 81px ribbon — a cusp, which draws as a long thin
 * slit rather than as the inside of a bend.
 *
 * None of that was visible before. The apex was the only part of the hump above the fold; the
 * notch under it was off screen entirely. Lifting the hook is what put it in view, and it was
 * reported there — the crest read as a pinched point rather than as a wave. So the corner is
 * replaced by a true circular arc, tangent at both ends to the spline's own heading, with the
 * radius stated in *reference px* so that it is a circle at the aspect everything else here
 * was measured at.
 *
 * **What it costs is crest height, and that is unavoidable rather than a tuning choice.** The
 * limbs meet at 109°, and a round turn of radius R between them puts the apex 0.66·R below
 * their meeting point — so a rounder crest is always a lower one. At 92 the apex drops 28px at
 * the reference viewport and the crest still stands 1.06–1.6× the ribbon's width above the
 * trough, which still reads as a wave. Past about 100 the arc leaves no straight run at all
 * before the seam, two anchors land on top of each other, and centripetal Catmull-Rom turns
 * that into the very cusp this is removing — hence the assertion on the fit below.
 *
 * TAIL_CREST_STEP is the spacing the replaced stretch is resampled at. It is not cosmetic: the
 * whole stretch is resampled at *one* spacing precisely so that no sample lands a pixel from a
 * tangent point, because the spline's weights divide by the chord across each anchor.
 */
const TAIL_CREST_R = 92;
const TAIL_CREST_FROM = 40;
const TAIL_CREST_TO = 47;
const TAIL_CREST_STEP = 12;

/**
 * How far past the fold the dive is carried, in fractions of the height. The last transcribed
 * anchor sits *above* the bottom edge once the hook is lifted, so without this the river would
 * stop inside the frame on a round cap; the extension continues it on its own final heading
 * until it is clear.
 */
const TAIL_EXIT_V = 1.16;

/**
 * How much deeper the curve dips than its deepest anchor, in fractions of the height —
 * measured off the sampled spline, since the trough's true extreme falls between two anchors
 * rather than on one. It only exists so the clearance assertion below is held against the
 * curve rather than against the table.
 */
const TAIL_TROUGH_OVERSHOOT_V = 0.001;

/**
 * Replace the corner between two anchors with a circular arc of TAIL_CREST_R reference px,
 * tangent at both ends to the heading the spline already has there. Mutates `P`.
 *
 * Returns the tangent length the arc needed and the room there was for it, which is what the
 * assertion below checks: the two are what decide whether this rounds the corner or replaces
 * it with a worse one.
 */
function roundCrest(P: (readonly [number, number])[]) {
  const toRef = ([u, v]: readonly [number, number]) =>
    [(RIVER_X0 + u * RIVER_XW) * REF_W, v * REF_H] as const;
  const fromRef = ([x, y]: readonly [number, number]) =>
    [(x / REF_W - RIVER_X0) / RIVER_XW, y / REF_H] as const;
  const unit = ([x, y]: readonly [number, number]) => {
    const m = Math.hypot(x, y) || 1;
    return [x / m, y / m] as const;
  };

  const pIn = toRef(P[TAIL_CREST_FROM]);
  const pOut = toRef(P[TAIL_CREST_TO]);
  // The limbs' directions are the spline's own tangents at the two seams — the chord *across*
  // each anchor, which is what Catmull-Rom uses. Taking the chord arriving at the anchor
  // instead leaves the arc 5° off the curve it grafts onto, and the seam then tightens by more
  // than the corner gains.
  const before = toRef(P[TAIL_CREST_FROM - 1]);
  const after = toRef(P[TAIL_CREST_FROM + 1]);
  const dIn = unit([after[0] - before[0], after[1] - before[1]]);
  const outBefore = toRef(P[TAIL_CREST_TO - 1]);
  const outAfter = toRef(P[TAIL_CREST_TO + 1]);
  const dOut = unit([outAfter[0] - outBefore[0], outAfter[1] - outBefore[1]]);

  // Where the two limbs, extended, would meet.
  const den = dIn[0] * dOut[1] - dIn[1] * dOut[0];
  const along =
    ((pOut[0] - pIn[0]) * dOut[1] - (pOut[1] - pIn[1]) * dOut[0]) / den;
  const meet = [pIn[0] + along * dIn[0], pIn[1] + along * dIn[1]] as const;

  // The tangent length a radius of TAIL_CREST_R needs either side of that meeting point.
  const half =
    Math.acos(
      Math.max(-1, Math.min(1, -(dIn[0] * dOut[0] + dIn[1] * dOut[1]))),
    ) / 2;
  const tangent = TAIL_CREST_R / Math.tan(half);
  const reach = Math.hypot(meet[0] - pIn[0], meet[1] - pIn[1]);
  const t1 = [meet[0] - tangent * dIn[0], meet[1] - tangent * dIn[1]] as const;
  const t2 = [meet[0] + tangent * dOut[0], meet[1] + tangent * dOut[1]] as const;

  // The centre is TAIL_CREST_R off the incoming limb, on whichever side is also that far from
  // the outgoing one.
  const centres = (
    [
      [dIn[1], -dIn[0]],
      [-dIn[1], dIn[0]],
    ] as const
  ).map(
    (n) =>
      [t1[0] + TAIL_CREST_R * n[0], t1[1] + TAIL_CREST_R * n[1]] as const,
  );
  const offOut = (c: readonly [number, number]) =>
    Math.abs(
      Math.abs((c[0] - pOut[0]) * dOut[1] - (c[1] - pOut[1]) * dOut[0]) -
        TAIL_CREST_R,
    );
  const centre = offOut(centres[0]) < offOut(centres[1]) ? centres[0] : centres[1];

  const from = Math.atan2(t1[1] - centre[1], t1[0] - centre[0]);
  let sweep = Math.atan2(t2[1] - centre[1], t2[0] - centre[0]) - from;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;

  // Straight in, arc, straight out — as one dense polyline, resampled at one even spacing.
  const dense: (readonly [number, number])[] = [];
  const push = (q: readonly [number, number]) => {
    const last = dense[dense.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-9) dense.push(q);
  };
  const lineIn = Math.hypot(t1[0] - pIn[0], t1[1] - pIn[1]);
  const lineOut = Math.hypot(pOut[0] - t2[0], pOut[1] - t2[1]);
  for (let q = 0; q <= lineIn; q += 2)
    push([pIn[0] + q * dIn[0], pIn[1] + q * dIn[1]]);
  const arcLen = Math.max(1e-6, Math.abs(sweep) * TAIL_CREST_R);
  for (let q = 0; q <= arcLen; q += 2) {
    const ang = from + (sweep * q) / arcLen;
    push([
      centre[0] + TAIL_CREST_R * Math.cos(ang),
      centre[1] + TAIL_CREST_R * Math.sin(ang),
    ]);
  }
  for (let q = 0; q <= lineOut; q += 2)
    push([t2[0] + q * dOut[0], t2[1] + q * dOut[1]]);
  push(pOut);

  const cum = [0];
  for (let q = 1; q < dense.length; q++)
    cum.push(
      cum[q - 1] +
        Math.hypot(dense[q][0] - dense[q - 1][0], dense[q][1] - dense[q - 1][1]),
    );
  const total = cum[cum.length - 1];
  const steps = Math.max(2, Math.round(total / TAIL_CREST_STEP));
  const replaced: (readonly [number, number])[] = [];
  for (let q = 1; q < steps; q++) {
    // Interior points only: the two seam anchors are already in the list.
    const want = (total * q) / steps;
    let k = 1;
    while (k < cum.length - 1 && cum[k] < want) k++;
    const f = (want - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
    replaced.push(
      fromRef([
        dense[k - 1][0] + f * (dense[k][0] - dense[k - 1][0]),
        dense[k - 1][1] + f * (dense[k][1] - dense[k - 1][1]),
      ]),
    );
  }
  P.splice(
    TAIL_CREST_FROM + 1,
    TAIL_CREST_TO - TAIL_CREST_FROM - 1,
    ...replaced,
  );
  return { tangent, reach, apexV: (centre[1] - TAIL_CREST_R) / REF_H };
}

/**
 * WIDE_ANCHORS as this build places them: the transcription lifted clear of the bottom edge,
 * its hook scaled about the join and its dive steepened past the crest. Still normalised, in
 * the same `[u, v]` the table is written in, so nothing downstream knows this happened.
 */
function placeWide() {
  const join = WIDE_ANCHORS[TAIL_JOIN];
  const lift = (u: number, v: number) => [u, v - RIVER_LIFT_V] as const;
  const out: (readonly [number, number])[] = [];

  // The run, carried through exactly as measured.
  for (let i = 0; i <= TAIL_JOIN; i++) out.push(lift(...WIDE_ANCHORS[i]));

  // The bowl, scaled about the join — the one anchor it shares with the run, so the leg into
  // it keeps the heading it was drawn with and the join stays a join rather than a corner.
  for (let i = TAIL_JOIN + 1; i <= TAIL_CREST; i++) {
    out.push(
      lift(
        join[0] + TAIL_SCALE * (WIDE_ANCHORS[i][0] - join[0]),
        join[1] + TAIL_SCALE * (WIDE_ANCHORS[i][1] - join[1]),
      ),
    );
  }

  // The dive, walked step by step so the squeeze can start partway down it rather than at the
  // crest — see TAIL_DIVE_FREE.
  for (let i = TAIL_CREST + 1; i < WIDE_ANCHORS.length; i++) {
    const squeeze = i - TAIL_CREST < TAIL_DIVE_FREE ? 1 : TAIL_DIVE_SQUEEZE;
    const prev = out[out.length - 1];
    out.push([
      prev[0] + TAIL_SCALE * squeeze * (WIDE_ANCHORS[i][0] - WIDE_ANCHORS[i - 1][0]),
      prev[1] + TAIL_SCALE * (WIDE_ANCHORS[i][1] - WIDE_ANCHORS[i - 1][1]),
    ]);
  }

  // The crest's corner, rounded — the one change to the drawing's own shape. It happens before
  // the extension below because it must not touch the dive's final heading, which is what that
  // extension is carried out on.
  const crest = roundCrest(out);

  // And on past the fold on its own final heading, so the ribbon leaves the frame rather than
  // stopping inside it on a round cap.
  const tail = out[out.length - 1];
  const step = [
    tail[0] - out[out.length - 2][0],
    tail[1] - out[out.length - 2][1],
  ] as const;
  while (out[out.length - 1][1] < TAIL_EXIT_V) {
    const tip = out[out.length - 1];
    out.push([tip[0] + step[0], tip[1] + step[1]]);
  }
  return { points: out as readonly (readonly [number, number])[], crest };
}

const PLACED = placeWide();
const WIDE_PLACED = PLACED.points;

/**
 * ## The narrow river: a sweep across the room above the copy
 *
 * None of this is transcription — the reference has no narrow layout — so every figure here is
 * a preference and says so. The construction is `hero/band.ts`'s, which the head of this file
 * rejects *for the wide drawing* (a tilted sine misses the measured meander by most of a
 * ribbon's width) and which is right here for the opposite reason: there is nothing to miss,
 * and a sine on a tilted baseline is the one shape whose endpoints, amplitude and bend count
 * can each be retuned without moving the others.
 *
 * The baseline runs from the **left edge, at the bottom of the river's room**, to the **top
 * edge, NARROW_EXIT_U of the way across** — "from the left bottom edge to the right top", the
 * brief's own words. A whole number of half-waves (`humps`) rides on it as a *cosine*, phased
 * so the exit is a crest: the wave is at an extremum at both ends, where its slope is zero, so
 * the path leaves each end **parallel to the baseline** and the bleed past it is a straight
 * run with no kink. That phase is load-bearing rather than cosmetic. The first build used a
 * sine (zero at both ends, the hero band's construction) and carried it on into the bleed,
 * and the half-wave *after* the exit bulges back down toward the screen — on a 352 × 568 phone
 * the ribbon re-entered at the top-right corner and left through the right edge, which reads
 * as the river starting from the side. A crest at the exit puts the ribbon a whole amplitude
 * above the top edge as it goes, and a straight bleed can only carry on away. The entry is a
 * crest too when `humps` is even and a trough when it is odd; either way the path is carried
 * on past both ends — at least NARROW_BLEED_OF_T ribbons, and further until the centreline is
 * a whole ribbon clear of the frame — so that no round cap can come onto the screen under a
 * resize or a collapsing address bar. "Further until clear" is not belt-and-braces: on a phone
 * held sideways with a long paragraph (736 × 568, the copy taking 65% of it) the baseline runs
 * at ~16°, and two ribbons of run along it rises only 31px against the 33 the ribbon needs to
 * leave the top edge — the cap sat on the edge.
 *
 * **The bound is enforced after the fact, not assumed.** The lowest ink on screen is measured
 * off the sampled points — as the stroke's own discs, so the few samples just past the left
 * edge whose ink reaches back onto the screen are counted at the height that ink actually
 * reaches — and the whole drawing is shifted so that ink sits *exactly* on `bottom`: up if the
 * construction crossed it, down if it left room (a crest at the entry starts the ribbon a whole
 * amplitude above the baseline, and the room it leaves is the copy's air doubled). The gap to
 * the copy is therefore the one stated in ./metrics at every width, never a function of the
 * hump count, the amplitude or which end is a trough.
 *
 * NARROW_EXIT_U: where the baseline leaves through the top edge, as a fraction of the width.
 * 0.82 rather than the corner — the wide drawing's head leaves at ~0.9 of its band, and
 * leaving *through the corner* reads as the river starting from the side of the screen, which
 * the wide drawing's dive goes to some trouble to avoid (see TAIL_DIVE_SQUEEZE).
 *
 * NARROW_AMPLITUDE_OF_T: the sine's amplitude as a share of the thickness. 0.6 is where the
 * ribbon reads as a river rather than a straight band without the glyphs on it tilting past
 * the ~40° the hero's ribbon holds itself to — at two humps on a phone the path turns 22° off
 * its baseline at the steepest, and the baseline itself runs at ~45°.
 *
 * NARROW_HUMP_PITCH_OF_T: how long one half-wave is, in ribbons — the knob for how many bends
 * the sweep has. At 4.5 a 390 × 844 phone with a 45vh block gets two, an upright tablet three;
 * one is held as the floor so a very short room is still a curve, four as the ceiling so a
 * tall one does not become a zigzag.
 */
const NARROW_EXIT_U = 0.82;
const NARROW_AMPLITUDE_OF_T = 0.6;
const NARROW_HUMP_PITCH_OF_T = 4.5;
const NARROW_BLEED_OF_T = 2;

export type RiverGeometry = {
  narrow: boolean;
  /** Stroke width, px. */
  thickness: number;
  fontSize: number;
  /**
   * The centreline, in viewport px, ordered **downstream-to-upstream** — from the
   * bottom-left end to the top-right one. That direction is the copy's reading direction in
   * the reference (its glyphs read toward the top right, and the marquee carries them that
   * way), and an SVG textPath has no way to run against its path.
   */
  points: readonly (readonly [number, number])[];
  /** The same, as a cubic-Bézier `d`. Both the stroke and the textPath use it. */
  d: string;
};

/**
 * Catmull-Rom through the anchors, emitted as the Bézier form of the same curve.
 *
 * **Centripetal** (α = ½), not the uniform form. Uniform Catmull-Rom gives every anchor a
 * handle one sixth of the chord across it whatever the spacing either side, so a short segment
 * next to a long one overshoots; centripetal weights each handle by the square root of its own
 * segment's length, which is the standard result that it cannot cusp or self-intersect at any
 * spacing. The anchors here are evenly spaced through the transcribed run (60px of arc) but
 * not across the authored tail (29–47px), so that guarantee is worth having.
 *
 * It is insurance rather than a fix, and worth saying which: the pinch that was visible in the
 * bottom bend was a bad *anchor*, not a bad parameterisation — the ridge's drifted final step
 * (see WIDE_ANCHORS). With that step corrected the two forms measure the same, worst curvature
 * jump 0.0043 either way. Centripetal costs nothing for the guarantee: with equal segments the
 * formula reduces to exactly the uniform one.
 *
 * The ends extrapolate a reflected phantom anchor rather than duplicating the endpoint. A
 * duplicate has zero length, which the weights divide by.
 */
function smoothPath(points: readonly (readonly [number, number])[]) {
  if (points.length < 2) return "";
  const parts = [`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const p0 = points[i - 1] ?? ([2 * p1[0] - p2[0], 2 * p1[1] - p2[1]] as const);
    const p3 =
      points[i + 2] ?? ([2 * p2[0] - p1[0], 2 * p2[1] - p1[1]] as const);

    // Each segment's length to the power α = ½. Floored so a pair of coincident anchors
    // degrades to a straight join rather than a division by zero.
    const w = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const d1 = w(p0, p1);
    const d2 = w(p1, p2);
    const d3 = w(p2, p3);

    const c1 = (k: 0 | 1) =>
      (d1 * d1 * p2[k] -
        d2 * d2 * p0[k] +
        (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) /
      (3 * d1 * (d1 + d2));
    const c2 = (k: 0 | 1) =>
      (d3 * d3 * p1[k] -
        d2 * d2 * p3[k] +
        (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) /
      (3 * d3 * (d3 + d2));

    parts.push(
      `C ${c1(0).toFixed(2)} ${c1(1).toFixed(2)} ${c2(0).toFixed(2)} ${c2(1).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
    );
  }
  return parts.join(" ");
}

/** The placed drawing laid onto a viewport: a share of the width across, the full height down. */
function widePoints(w: number, h: number) {
  return WIDE_PLACED.map(
    ([u, v]) => [(RIVER_X0 + u * RIVER_XW) * w, v * h] as const,
  );
}

/**
 * The sweep, in viewport px, ordered **bottom-left to top-right** — which is already the
 * downstream-to-upstream order RiverGeometry.points asks for, so unlike the wide drawing this
 * is not reversed by the caller. `bottom` is the lowest y the ink may reach; see the docblock
 * above for the construction.
 */
function narrowPoints(w: number, bottom: number, thickness: number) {
  const half = thickness / 2;
  // The baseline: in at the left edge with the ribbon's lower edge on the bound, out through
  // the top edge with its centreline on it.
  const ax = 0;
  const ay = bottom - half;
  const bx = NARROW_EXIT_U * w;
  const by = 0;
  const L = Math.hypot(bx - ax, by - ay);
  const d = [(bx - ax) / L, (by - ay) / L] as const;
  // The normal that points *up* (toward −y) — the side the room is on.
  const n = d[1] <= 0 ? ([d[1], -d[0]] as const) : ([-d[1], d[0]] as const);

  const amplitude = NARROW_AMPLITUDE_OF_T * thickness;
  const humps = gsap.utils.clamp(
    1,
    4,
    Math.round(L / (NARROW_HUMP_PITCH_OF_T * thickness)),
  );
  const bleed = (NARROW_BLEED_OF_T * thickness) / L;
  // Dense enough that the spline through the samples is the wave: ten per half-wave, and no
  // coarser than 30px.
  const step = Math.min(30 / L, 1 / (humps * 10));

  // A crest at the exit (t = 1), whatever the hump count — see the docblock above. Outside
  // [0, 1] the wave is held at its end value, which is what makes the bleed a straight run.
  const wave = (t: number) =>
    amplitude * Math.cos(Math.PI * humps * (1 - gsap.utils.clamp(0, 1, t)));
  const at = (t: number): readonly [number, number] => {
    const a = wave(t);
    return [ax + t * L * d[0] + a * n[0], ay + t * L * d[1] + a * n[1]];
  };

  // The run on screen, then each end carried on until it is clear of the frame — see the
  // docblock for why the minimum bleed alone is not enough. Clear means a whole ribbon past
  // the edge, measured on the axis the end leaves through, and the loops are bounded because
  // the baseline has a component along each of those axes by construction.
  const pts: (readonly [number, number])[] = [];
  for (let t = 0; t <= 1 + 1e-9; t += step) pts.push(at(t));
  for (let t = -step; t >= -bleed || pts[0][0] > -thickness; t -= step) {
    pts.unshift(at(t));
  }
  for (
    let t = 1 + step;
    t <= 1 + bleed || pts[pts.length - 1][1] > -thickness;
    t += step
  ) {
    pts.push(at(t));
  }

  // Place the drawing against the bound rather than trusting the construction: the lowest ink
  // on screen lands exactly on `bottom`. The ink around a sample is a disc of radius `half`; a
  // sample just past the left edge still puts the part of its disc that is on screen at
  // `y + sqrt(half² − x²)`, which is why the window is `[-half, w]` and not `[0, w]`.
  let lowest = -Infinity;
  for (const [x, y] of pts) {
    if (x < -half || x > w) continue;
    const reach = x < 0 ? Math.sqrt(half * half - x * x) : half;
    lowest = Math.max(lowest, y + reach);
  }
  const shift = lowest - bottom;
  return pts.map(([x, y]) => [x, y - shift] as const);
}

/**
 * Everything about the river at one viewport size. Pure — it reads no DOM and holds no
 * state, so the caller can memoise it against the measured stage.
 *
 * `clearBelow` is the lowest y the **narrow** river's ink may reach — the copy's resting top
 * edge less a line of air, measured by the component (see `PlaygroundNarrative`). The wide
 * drawing ignores it: there the copy takes the right-hand half and the river the left, and the
 * two already cross only at the copy's top-left corner by design. Omitted, the narrow river is
 * given the whole stage, which is the one commit before the copy has been measured.
 *
 * It is floored at NARROW_RIVER_MIN_FRAC of the stage, because a bound is only useful while
 * there is a river to bound: under that the copy is taller than the room allows and the two
 * overlap over the lowest bend, with the scrim under the copy as the backstop. That is reported
 * in dev rather than hidden — it means the CMS copy has outgrown the phone it is on.
 */
export function riverFor(
  w: number,
  h: number,
  clearBelow?: number,
): RiverGeometry {
  const narrow = !riverIsWide(w, h);

  const floor = NARROW_RIVER_MIN_FRAC * h;
  const bottom = Math.max(floor, Math.min(h, clearBelow ?? h));
  if (process.env.NODE_ENV !== "production" && narrow && clearBelow !== undefined && clearBelow < floor) {
    console.error(
      `[Playground] the copy leaves the river ${Math.round(clearBelow)}px of a ${h}px stage ` +
      `at ${w}×${h}, under the ${Math.round(floor)}px floor, so the two overlap over the ` +
      "river's lowest bend. The copy has outgrown this viewport: shorten it, or lower " +
      "NARROW_RIVER_MIN_FRAC if the overlap is acceptable.",
    );
  }

  const thickness = narrow ? narrowThicknessFor(w, bottom) : thicknessFor(w, h);

  // The wide drawing is transcribed top-down and reversed once, here, so every consumer sees
  // one direction — see RiverGeometry.points. The sweep is built in that direction already.
  const points = narrow
    ? narrowPoints(w, bottom, thickness)
    : [...widePoints(w, h)].reverse();

  return {
    narrow,
    thickness,
    fontSize: thickness * FONT_OF_THICKNESS,
    points,
    d: smoothPath(points),
  };
}

if (process.env.NODE_ENV !== "production") {
  // The transcription's guarantee, and note it is asserted against WIDE_ANCHORS rather than
  // against the placed drawing: the table is the measurement, and the placement is allowed to
  // move it. Both extremes of the measured run are checked, since between them the anchors are
  // simply carried through.
  const apex = WIDE_ANCHORS.reduce((a, b) => (b[0] > a[0] ? b : a));
  const apexPx = [
    (RIVER_X0 + apex[0] * RIVER_XW) * REF_W,
    apex[1] * REF_H,
  ];
  const ref = riverFor(REF_W, REF_H);
  if (
    Math.abs(apexPx[0] - 1048.5) > 1 ||
    Math.abs(apexPx[1] - 170.1) > 1 ||
    Math.abs(ref.thickness - REF_THICKNESS) > 0.5
  ) {
    console.error(
      "[Playground] the river no longer reproduces the reference at 1904×913 — " +
      "RIVER_X0/RIVER_XW or WIDE_ANCHORS have drifted from the measurement.",
      { apex: apexPx, thickness: ref.thickness },
    );
  }

  // The hook's guarantee: the whole of it stays on screen. The ribbon reaches `thickness / 2`
  // either side of its centreline, so the trough has that much to clear the stage's bottom
  // edge by. Swept rather than spot-checked because the two figures scale off different axes —
  // the ribbon off the width, the trough off the height — so the worst case is a short *wide*
  // window. A negative margin here is the hook being sliced flat along the bottom edge, which
  // is the defect the placement exists to remove.
  // Sliced to TAIL_CREST_FROM rather than to TAIL_CREST: roundCrest splices a different number
  // of anchors in than it takes out, so every index past it has moved. The trough sits well
  // before that seam, so this window still holds it.
  const troughV =
    Math.max(
      ...WIDE_PLACED.slice(TAIL_JOIN, TAIL_CREST_FROM + 1).map(([, v]) => v),
    ) + TAIL_TROUGH_OVERSHOOT_V;
  let worstMargin = Infinity;
  let worstAt = "";
  for (let w = RIVER_NARROW_MAX_W; w <= 3840; w += 32) {
    // From 400 rather than 600: the ribbon has a 40px floor that the height bound cannot get
    // under, so a window short enough stops buying clearance by getting shorter and the margin
    // starts closing again. 400 is well past any window a reader will have, and it still holds.
    for (let h = 400; h <= 1600; h += 20) {
      if (!riverIsWide(w, h)) continue;
      const margin = (1 - troughV) * h - thicknessFor(w, h) / 2;
      if (margin < worstMargin) {
        worstMargin = margin;
        worstAt = `${w}x${h}`;
      }
    }
  }
  if (worstMargin < 0) {
    console.error(
      `[Playground] the river's hook hangs ${(-worstMargin).toFixed(1)}px past the stage's ` +
      `bottom edge at ${worstAt}, so it is sliced flat there rather than turning — which is ` +
      "the defect the placement was chosen to remove. Lift the drawing further (raise " +
      "RIVER_LIFT_V), shrink the hook (lower TAIL_SCALE), or narrow the ribbon.",
    );
  }

  // The exit's guarantee, and it is two claims rather than one. The ribbon has to cross the
  // bottom edge **once** — the reference crosses three times, and it is the middle two that
  // strand its crest in the corner as a separate shape — and it has to cross it *inside* the
  // frame, because a dive that reaches x = 0 first leaves through the left edge instead, which
  // reads as the river starting at the side of the screen and has been reported as such.
  //
  // Both are read off the placed anchors rather than off the curve. The chord is a good enough
  // stand-in here (the dive is all but straight where it crosses) and, unlike the curve, it
  // does not depend on the viewport at all: u and v are normalised, so the crossing's share of
  // the width is one number for every screen.
  let crossings = 0;
  let exitFrac = NaN;
  for (let i = 1; i < WIDE_PLACED.length; i++) {
    const [ua, va] = WIDE_PLACED[i - 1];
    const [ub, vb] = WIDE_PLACED[i];
    if ((va - 1) * (vb - 1) >= 0) continue;
    crossings++;
    const u = ua + ((1 - va) / (vb - va)) * (ub - ua);
    exitFrac = RIVER_X0 + u * RIVER_XW;
  }
  if (crossings !== 1 || !(exitFrac >= 0.02)) {
    console.error(
      `[Playground] the river crosses the stage's bottom edge ${crossings} time(s), at ` +
      `${(100 * exitFrac).toFixed(1)}% of the width. It has to cross exactly once, and far ` +
      "enough in that it leaves through the bottom rather than through the left edge — " +
      "TAIL_DIVE_SQUEEZE is the knob for the second (lower it to steepen the dive).",
    );
  }

  // The crest's guarantee: the arc has to fit between the two seams. `tangent` is how far
  // either side of the limbs' meeting point a TAIL_CREST_R arc has to start, and `reach` is how
  // far that point is from the incoming seam. As the two converge the straight run before the
  // arc vanishes, two resampled anchors land on top of each other, and centripetal
  // Catmull-Rom — whose weights divide by the chord across an anchor — answers that with a
  // cusp, which is a sharper corner than the one being rounded off.
  if (PLACED.crest.tangent > PLACED.crest.reach * 0.95) {
    console.error(
      `[Playground] the river's crest arc needs ${PLACED.crest.tangent.toFixed(0)}px of limb ` +
      `either side of the corner and has ${PLACED.crest.reach.toFixed(0)}px, so it is about to ` +
      "double an anchor and cusp where it should be roundest. Lower TAIL_CREST_R, or start the " +
      "round earlier (lower TAIL_CREST_FROM).",
    );
  }

  // The sweep's guarantee: no ink on screen below the bound it was given, and the ribbon in
  // through the left edge and out through the top one — never through the copy's room, and
  // never through the right edge, which would read as the river starting from the side. Swept
  // over phone and upright-tablet viewports with the copy taking a range of shares of the
  // stage, since the bound is what makes this a different river on every one of them.
  //
  // "Out through the top" is checked on the *ink*: some on-screen sample is a whole half-ribbon
  // above the top edge, and no sample whose ink is still visible is past the right edge. The
  // path's bleed beyond that is allowed to wander wherever it likes — it is off screen.
  let worstOver = -Infinity;
  let worstBoundAt = "";
  let badExit = "";
  for (let w = 320; w < RIVER_NARROW_MAX_W; w += 32) {
    for (let h = 568; h <= 1024; h += 56) {
      for (const share of [0.35, 0.5, 0.65]) {
        const bound = share * h;
        const r = riverFor(w, h, bound);
        if (!r.narrow) continue;
        const onScreen = r.points.filter(([x]) => x >= 0 && x <= w);
        const over =
          Math.max(...onScreen.map(([, y]) => y)) + r.thickness / 2 - bound;
        if (over > worstOver) {
          worstOver = over;
          worstBoundAt = `${w}×${h} @ ${share}`;
        }
        const half = r.thickness / 2;
        const entersLeft = r.points[0][0] < 0;
        const leavesTop = onScreen.some(([, y]) => y < -half);
        const neverRight = r.points.every(([x, y]) => y < -half || x <= w);
        if (!(entersLeft && leavesTop && neverRight) && !badExit) {
          badExit = `${w}×${h} @ ${share}`;
        }
      }
    }
  }
  if (worstOver > 0.5) {
    console.error(
      `[Playground] the narrow river's ink reaches ${worstOver.toFixed(1)}px below the bound ` +
      `it was given at ${worstBoundAt}, i.e. onto the copy. narrowPoints' lift is meant to make ` +
      "this impossible; check the on-screen filter there.",
    );
  }
  if (badExit) {
    console.error(
      `[Playground] the narrow river does not enter through the left edge and leave through ` +
      `the top at ${badExit}. NARROW_EXIT_U and NARROW_BLEED_OF_T are the knobs.`,
    );
  }
}
