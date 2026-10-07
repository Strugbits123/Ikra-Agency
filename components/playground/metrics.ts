/**
 * Every measured figure the playground's layout is built from, and the `fluid()` that turns
 * each one into a `clamp()`.
 *
 * A sixth module rather than numbers scattered through the layers, for the reason
 * `study/metrics.ts` exists: the only thing anyone will want to check about a figure here is
 * what it measured, and a `clamp()` written out as a Tailwind bracket string at its call site
 * buries exactly that. This is also why sizes arrive as inline styles rather than classes.
 *
 * The reference is one viewport — 1904 × 913, the browser area above the taskbar in
 * `hero-playground.mp4` — so a fixed-px transcription would only be right at that width.
 * `fluid(min, ref, max)` restates a measured pixel figure as its own share of 1904, floored
 * and capped: at the reference width every value is exactly what was measured, and away from
 * it the page scales rather than breaking.
 *
 * Type sizes were solved rather than eyeballed, the same method `study/metrics.ts` uses —
 * measure a line's ink width and divide by the exact advance-width sum of its string taken
 * from the TTF. Three independent lines of body copy return 23.96, 23.88 and 24.15, so 24px;
 * the cap height of its "A" (17px against the font's 0.714 cap) agrees at 23.8.
 */

const REF_W = 1904;

export const fluid = (minPx: number, refPx: number, maxPx: number) =>
  `clamp(${minPx}px, ${((refPx / REF_W) * 100).toFixed(4)}vw, ${maxPx}px)`;

/**
 * The body copy: 24px on a 38px line pitch, both measured to the pixel across ten
 * consecutive lines. 1.583 rather than a round 1.6 because the pitch is what was measured and
 * the size is what was solved — stating the ratio keeps the two consistent at every width.
 */
export const BODY = fluid(16, 24, 28);
export const BODY_LEADING = 38 / 24;

/**
 * The footnote under the rule: 20px on a 26px pitch. A genuinely different size, not the body
 * at a smaller scale — solving its two lines against their advance widths returns 20.1 and
 * 20.8, against 24 for every line above it.
 */
export const NOTE = fluid(13, 20, 23);
export const NOTE_LEADING = 26 / 20;

/**
 * The blank line between the two paragraphs: measured 77px between the line *tops* either
 * side of it, i.e. exactly two pitches, so one empty line. In em of the body, so it tracks
 * the type rather than needing its own clamp.
 */
export const PARA_GAP_EM = 38 / 24;

/**
 * The rule under the copy, and the air either side of it. The rule sits 28px below the last
 * paragraph's line box and the footnote starts 40px under the rule — measured at y = 617,
 * 645 and 685.
 *
 * RULE_WIDTH is the one deliberate raggedness in the block: the rule stops at 82% of the
 * column (measured 968 → 1620 in a block running 969 → 1760) rather than reaching its right
 * edge. Squaring it up is the change to avoid — it is the same device the case-study pull
 * quote uses, where two columns leave 14% of the measure standing so the block reads as
 * placed rather than justified.
 */
export const RULE_TOP_EM = 28 / 24;
export const RULE_BOTTOM_EM = 40 / 24;
export const RULE_WIDTH = "82%";

/**
 * The copy column, as fractions of the viewport width. Two edges rather than a width and an
 * offset, because the two are established completely differently.
 *
 * **The left edge is measured**: every line of the block starts at x = 969. It is also the
 * edge that matters, since it is what keeps the column clear of the river — which reaches
 * x = 1046 at its widest and crosses the column's own top-left corner by design.
 *
 * **The right edge is solved, not measured**, and the difference is worth knowing before
 * anyone "corrects" it. The longest line's ink ends at 1760, but ink is a floor on the box,
 * not the box: the column is wherever it is between that and the point where one more word
 * would have fitted. What pins it is the reference's *line breaks* — take its seven lines,
 * sum their advance widths from the TTF at 24px, and the column has to be at least 796.3
 * (or "That's" drops off the first line) and under 814.3 (or "lead" joins the sixth). 805 is
 * the middle of that 18px window, i.e. a 130px right gutter.
 *
 * A first pass read the gutter as 144 — the page's own, and the number the left one suggests
 * — which gives a 791px column: five pixels under the floor, and the whole first paragraph
 * re-wraps.
 */
export const COPY_LEFT_PCT = (969 / REF_W) * 100;
export const COPY_RIGHT_PCT = ((REF_W - (969 + 805)) / REF_W) * 100;

/**
 * The widest measure the copy is allowed where there is no right-hand half to put it in —
 * i.e. wherever the river is the narrow one, which is every phone and every tablet held
 * upright. There the copy is not on the stage at all: it sits in its own band under it
 * (`PlaygroundCopyBand`), white with the copy in black, as the client asked — the first
 * viewport is the footage and the ribbon, the second is the words. In em, so it tracks the
 * type rather than the viewport.
 *
 * 42em is about 75 characters, the top of the usual comfortable range. It binds on a tablet,
 * where the full width would set 90 to the line; on a phone the gutters bind first and this
 * does nothing. The reference gives no figure for it — it has no narrow layout.
 */
export const COPY_NARROW_MEASURE = "42em";

/**
 * The header lockup. The wordmark's ink starts at x = 70 and y = 18 and runs 130px wide; the
 * descriptor under it is 17px on a line height of exactly 1, which looks far too large
 * written down and is right on screen — the same figure, and the same surprise, as the
 * case-study masthead's.
 *
 * The wordmark is the accent, not white: at 2× the crop it is plainly `--color-accent`, and
 * only the two-line descriptor beneath it is white.
 */
export const MARK_WIDTH = fluid(88, 130, 152);
export const MARK_META = fluid(12, 17, 20);
export const HEADER_GUTTER = fluid(24, 70, 82);
export const HEADER_TOP = fluid(16, 18, 22);
