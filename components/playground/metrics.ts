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
 * The widest measure the column is allowed where there is no right-hand half to put it in —
 * i.e. wherever the river is the narrow one, which is every phone and every tablet held
 * upright. In em, so it tracks the type rather than the viewport.
 *
 * 42em is about 75 characters, the top of the usual comfortable range. It binds on a tablet,
 * where the full width would set 90 to the line; on a phone the gutters bind first and this
 * does nothing. The reference gives no figure for it — it has no narrow layout.
 */
export const COPY_NARROW_MEASURE = "42em";

/**
 * **Where the river is the narrow one, the copy and the river split the stage between them
 * instead of sharing it** — the copy rests on the stage's bottom gutter and the river is laid
 * across whatever is left above it, so the two never overlap. This is the mobile answer to the
 * desktop's own arrangement (river left, copy right): on a phone there is no right-hand half
 * to give the copy, so it takes the bottom instead and the river takes the top.
 *
 * The three figures below are what hold that apart. All three are plain px rather than
 * `fluid()` strings because they go into arithmetic — the copy's resting `y` in ./sequence,
 * and the bound the river is solved against in ./river — not into a style.
 *
 * COPY_BOTTOM_PAD is the gutter under the block's last line. 32 rather than the 24px side
 * gutters (`right-6 left-6` on the block) because the footnote's descenders sit on it and a
 * bottom gutter reads tighter than a side one at the same figure.
 *
 * RIVER_COPY_GAP is the daylight between the ribbon's lowest ink and the block's first line.
 * The ribbon's edge is the *solved* bound, not its centreline — ./river subtracts half the
 * thickness itself — so this is the visible gap, and 20 is about one line of air at the body
 * size on a phone.
 *
 * NARROW_RIVER_MIN_FRAC is the floor on how little of the stage the river may be left with.
 * The block's height comes from the CMS and the viewport's from the phone, and a long enough
 * paragraph on a short enough screen leaves no room above it for a ribbon to sweep through —
 * under about a third of the stage a sweep is two bends crushed into a strip. Below the floor
 * the river keeps the floor and the copy climbs up over its lowest bend, which is the one case
 * the scrim under the copy still exists for (see SCRIM_ALPHA). It is a dev assertion rather
 * than a silent fallback, so the viewport it binds at gets reported.
 */
export const COPY_BOTTOM_PAD = 32;
export const RIVER_COPY_GAP = 20;
export const NARROW_RIVER_MIN_FRAC = 0.3;

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

/**
 * How much of the field a scrim takes where the river is the narrow one, and why there is one
 * there and not above it.
 *
 * On a wide screen the copy sits in the right-hand half and crosses the river only at its own
 * top-left corner — a handful of glyphs, which is the reference's own composition. On a narrow
 * one the copy is full width, and it used to sit *over* the river: white 22px type on
 * `--color-accent` measures **3.12:1**, under the 4.5:1 it needs, and a quarter-strength black
 * scrim between the two takes that pair to **5.15:1**, and the ribbon's own black copy to
 * 4.07:1 against its 3:1 requirement (it is large text at that size). It costs the orange very
 * little — (250, 94, 60) becomes (188, 71, 45), still plainly the accent against a near-black
 * field.
 *
 * **The copy no longer sits over the river by construction** — it rests below it, see
 * COPY_BOTTOM_PAD — so on every viewport where the two fit, this buys legibility against the
 * footage alone. It is kept at the same strength for two reasons: it is still the backstop for
 * the one case where they cannot fit (NARROW_RIVER_MIN_FRAC), and it is the tone the narrow
 * layout has shipped with, so taking it out is a visible change to the whole section rather
 * than a tidy-up. Lowering or removing it is a decision for the client, not a consequence of
 * the layout.
 */
export const SCRIM_ALPHA = 0.25;
