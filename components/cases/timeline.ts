/**
 * Every number the case studies' choreography uses. No DOM, no GSAP instances — the paint
 * in ./sequence is assembled from these against the figures ./measure reads back.
 *
 * ## Everything here was measured off the reference recording, not chosen
 *
 * The section is a pinned horizontal track: vertical scrolling translates a row of
 * equal-width cells leftwards across a held viewport. The figures below come from frame
 * analysis of the reference capture (1920×1040, ~1905px layout viewport once its scrollbar
 * is taken off), so they are transcriptions rather than taste:
 *
 *   cell pitch          952.4px  → 50.00vw  (11 independent divider-pair measurements)
 *   image width         801px    → 42.05vw  → 50vw − 2 × 4vw
 *   image aspect        801:552  → 1.451
 *   travel              1px of scroll per 1px of track, i.e. `scrollWidth − innerWidth`
 *
 * ## The only per-cell animation is the rise, and that is the whole of it
 *
 * Frame analysis ruled out everything else the previous build had. Tracking the reference's
 * artwork *within* each card frame — the tower in the first card, its "Hi, I'm Alex."
 * lettering — put it at 15.8–16.0% of the frame's width at both ends of the traverse, so
 * there is **no inner parallax**. The card frames measured 792–795px across the whole
 * traverse, so there is **no scale**. Cards leaving on the left held their caption's
 * baseline to the pixel until they were clipped, so there is **no exit fade, drift or dim**.
 *
 * What is left is a single vertical entrance per cell, and it is not a stagger of that
 * cell's lines — the caption's underline rule and the frame's top edge moved by identical
 * amounts at identical times (24px at the same frame, repeatedly), so the cell's whole
 * content block translates as one piece.
 */

/* ── the track ───────────────────────────────────────────────────────────────── */

/**
 * One cell, as a percentage of the viewport's width. Two cells fill the screen.
 *
 * Measured at 952.4px ± 0.5 against a 1905px layout viewport, i.e. exactly half. Every
 * cell is this wide — the heading and the closing call-to-action are cells too, not
 * decoration bolted either end, which is what makes the track a plain flex row and the pin
 * length a plain consequence of the project count.
 */
export const CELL_VW = 50;

/**
 * The image's inset within its cell, per side, in vw — so the image is
 * `CELL_VW − 2 × IMAGE_PAD_VW` wide. Measured at 75.75px ≈ 3.98vw, against an 801px image.
 */
export const IMAGE_PAD_VW = 4;
export const IMAGE_VW = CELL_VW - 2 * IMAGE_PAD_VW;

/**
 * The image's shape, and a ceiling on its height.
 *
 * The aspect is measured (801 × 552). The ceiling is not in the reference — it cannot be,
 * because that capture is one viewport — but without it a tall narrow window would make
 * `IMAGE_VW` taller than the screen and push the caption out of the stage. Expressed as a
 * width cap in vh so the aspect is never broken to satisfy it: see the `min()` in
 * CaseLayers.
 */
export const IMAGE_ASPECT = 1.45;
/**
 * 62, and the value is constrained from both sides rather than picked.
 *
 * The cap binds when `IMAGE_VW · W ≤ IMAGE_MAX_VH · IMAGE_ASPECT · H`, i.e. above an aspect
 * ratio of `IMAGE_MAX_VH × 0.0345`. It **must not** bind at the reference's own 1905×947
 * (aspect 2.011), or the section stops matching the recording at the very viewport it was
 * measured from — that needs > 58.3, and the first pass at 58 got this wrong, shipping an
 * image 4.6px narrow. It **must** bind on a short wide window, where 42vw of image plus its
 * caption is taller than the stage — 1920×600 wants it. 62 binds above aspect 2.14, which
 * leaves the reference untouched and holds the block at 82vh in the 1920×600 case.
 */
export const IMAGE_MAX_VH = 62;

/**
 * Empty run at the end of the track, in vw, so the closing cell can finish its own travel.
 *
 * Without it the track's right edge is the closing cell's right edge, so at full travel that
 * cell is parked at 50vw with its rise still 7% short — it never settles, and the section
 * releases on a panel that is visibly still arriving. In the reference this cannot happen
 * because its track does not end here: measured, it carries straight on into the next
 * section, whose first cell slides in from the right while the closing panel keeps moving
 * left.
 *
 * `(100 − CELL_VW) / 2` lands the closing cell dead centre at full travel — which is not an
 * invention but a frame the recording passes through (measured at x=507..1459 of 1920, centred
 * to within 2px). It mirrors the opening, where the heading cell rests against the left edge.
 */
export const TRACK_TAIL_VW = (100 - CELL_VW) / 2;

/* ── the rise ────────────────────────────────────────────────────────────────── */

/**
 * How far a cell's content starts below its resting place, as a percentage of that
 * content's own height.
 *
 * `yPercent`, not a px figure, and that is what the reference's own numbers point at: the
 * fitted rise for a card was 634px against a measured content block of 667px. Writing it as
 * a fraction of the block means the heading cell — a much shorter block — rises
 * proportionally rather than by a card's distance, which is what the capture shows it doing.
 *
 * The fit is a `power3.out` over the span below; residuals against 17 measured samples of
 * the second card were under 5px except at two points, where the frame-edge detection is
 * itself worth ±5px.
 */
export const RISE_PCT = 95;
export const RISE_EASE = "power3.out";

/**
 * Where the rise ends, as the cell's left edge measured in fractions of the viewport's
 * width. It begins when that edge is at the viewport's *right* edge, i.e. at 1.
 *
 * Measured: the second card's content reached its resting place with its cell's left edge
 * at 543px of a 1905px viewport, and was still 1px low at 696px. So the vertical component
 * of the entrance finishes well before the horizontal one does, and a card arrives on a
 * diagonal from the lower right rather than sliding in flat.
 *
 * This is also why the two cells on screen at rest need no special case: the first cell's
 * left edge is at 0 and the second's at 0.5, so the first is settled and the second sits
 * ~2.5% of its height low — which is exactly what the capture shows at the frame the pin
 * engages (measured 20px against 16.8px predicted).
 */
export const RISE_END_VW = 0.285;

/**
 * The pre-pin entrance, and the one place a stagger does exist.
 *
 * Before the pin engages the track cannot move, so the cells on screen at rest have nothing
 * to ride in on — yet the capture shows them rising anyway, driven by the section's own
 * vertical approach (the heading's rule climbed 191px while every divider held still, which
 * is only possible if the track's x was 0 throughout). So the rise reads the *lesser* of two
 * approaches, the horizontal one and this, and the section's arrival gates the whole row.
 *
 * The lag per cell is measured rather than invented: at the frame the heading's rise was
 * 0.589 through its curve, the first card's was 0.523.
 */
export const PRE_STAGGER = 0.07;

/**
 * ScrollTrigger's smoothing on the playhead, in seconds of catch-up.
 *
 * Not an ease and not a delay: the track still lands exactly where the scroll says, this
 * only takes a moment to get there. Note that a numeric scrub only does anything when the
 * trigger has an `animation` to drive — see the proxy tween in ./sequence.
 */
export const SCRUB = 1;

/* ── breakpoints ─────────────────────────────────────────────────────────────── */

/**
 * The two ranges, as `gsap.matchMedia` conditions.
 *
 * `.98` upper bounds rather than whole pixels: a fractional viewport width is ordinary once
 * browser zoom is involved, and `max-width: 767px` leaves 767.5 matching neither range —
 * which would tear down one paint and build nothing in its place.
 *
 * Below `md` the cell is a whole viewport rather than half (see CELL_VW_MOBILE), because
 * half of a 390px screen is a 195px card, which no caption fits under.
 */
export const MQ = {
  isWide: "(min-width: 768px)",
  isMobile: "(max-width: 767.98px)",
} as const;

/** One cell per screen on a phone, with a wider image inside it. */
export const CELL_VW_MOBILE = 100;
export const IMAGE_PAD_VW_MOBILE = 6;

if (process.env.NODE_ENV !== "production") {
  // Two cells must fill the screen exactly at the wide breakpoint, or the track's rhythm
  // stops being "one screen shows a card and its neighbour" and the measured rise span
  // stops meaning what it means.
  if (Math.abs(2 * CELL_VW - 100) > 1e-9) {
    console.error(
      `[CaseStudies] two cells span ${2 * CELL_VW}vw rather than the viewport. The rise ` +
      "span in RISE_END_VW was measured against a half-viewport cell.",
    );
  }

  // The rise has to be finished by the time the track runs out — otherwise the closing panel
  // is still visibly climbing as the pin releases. The tail run is what buys this, so the
  // check is really on TRACK_TAIL_VW being large enough.
  const endCellLeft = TRACK_TAIL_VW / 100; // the closing cell's left edge at full travel
  const r = Math.min(1, (1 - endCellLeft) / (1 - RISE_END_VW));
  const leftover = RISE_PCT * (1 - r) ** 3;
  if (leftover > 0.5) {
    console.error(
      `[CaseStudies] the closing cell is still ${leftover.toFixed(2)}% of its height low ` +
      "when the pin releases. Raise TRACK_TAIL_VW.",
    );
  }

  // The cap must not bind at the reference's own aspect ratio, or the layout stops matching
  // the recording at the very viewport it was measured from — see IMAGE_MAX_VH.
  //
  // The image resolves to `min(IMAGE_VW vw, IMAGE_MAX_VH · IMAGE_ASPECT vh)`, so the vw term
  // wins — which is what was measured — while
  //
  //     IMAGE_VW · (W / H) ≤ IMAGE_MAX_VH · IMAGE_ASPECT
  //
  // and the cap binds below that. The floor is derived rather than stated so it stays true if
  // the cell's padding or the image's aspect is ever retuned.
  const REFERENCE_ASPECT = 1905 / 947;
  const capFloorVh = (IMAGE_VW * REFERENCE_ASPECT) / IMAGE_ASPECT;
  if (IMAGE_MAX_VH < capFloorVh) {
    console.error(
      `[CaseStudies] IMAGE_MAX_VH=${IMAGE_MAX_VH} binds at the reference's 1905×947, so the ` +
      `image is narrower than the ${(IMAGE_VW / 100) * 1905} px measured there. Raise it ` +
      `above ${capFloorVh.toFixed(1)}.`,
    );
  }

  // The image must fit its cell with its padding intact.
  if (IMAGE_VW <= 0 || IMAGE_VW >= CELL_VW) {
    console.error(
      `[CaseStudies] IMAGE_PAD_VW leaves a ${IMAGE_VW}vw image in a ${CELL_VW}vw cell.`,
    );
  }
}
