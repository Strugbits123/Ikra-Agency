import { gsap } from "@/lib/gsap";

/**
 * The playground section's timeline, in vh of actual scrolling through the pin — the same
 * convention as `hero/timeline.ts` and `definition/timeline.ts`. The pin runs
 * `top top → bottom bottom`, so progress 0→1 covers `height − 100vh`, which is why
 * `sectionVh` is `pinVh` + 100 and why multiplying progress by the *section* height would
 * overstate real scroll.
 *
 * Three beats, and the first of them is read straight off the reference recording rather than
 * designed:
 *
 *   0–85vh     the copy climbs from below the fold toward the centre of the screen, stopping
 *              CLIMB_TRAVEL_FRAC of the way there, and the header leaves over the last
 *              stretch of that. Nothing else moves: the river is measured stationary in the
 *              viewport across the whole reference clip.
 *   85–115vh   the assembled composition holds, still, so that it exists as a state the
 *              reader arrives at rather than as a single frame in passing — see HOLD_VH.
 *   115vh      the pin releases and the section scrolls away as an ordinary adjacent block,
 *              uncovering what follows. Verified as plain flow: through the release the
 *              stage's bottom edge and the next section's top edge are the same number on
 *              every frame, so nothing overlaps and nothing is covered.
 *
 * The release being an ordinary scroll rather than another phase is the recording's own
 * behaviour, and it is checkable in it: once the copy parks, the section's bottom edge and
 * the copy's rule move together at a fixed 222px offset for the rest of the clip — i.e. one
 * rigid layer leaving, not a second animation. (The clip itself never scrolls past this
 * section — the river fills all 78 frames of it — so it says nothing about the hand-off, and
 * the figures above are this build's, not transcriptions.)
 */

/**
 * **How far the copy actually climbs, as a share of the whole distance from the fold to
 * centred.** 1 is the original: the block ends centred, the reference's own composition.
 *
 * This is the section's one shape knob, and it exists because the full climb read as too long
 * a haul — the block now stops short of centre and the section hands off to an ordinary
 * scroll rather than carrying it the rest of the way.
 *
 * **0.81 is measured off a supplied screenshot of where the copy should come to rest**, not
 * chosen: in an 882px viewport the block is 411px (46.6vh) and its top edge rests 40.5% down,
 * leaving 12.9vh of room under it — a travel of 59.5vh against a full 73.3vh. A first pass at
 * 0.25 was tried and rejected on sight, and the reason is the floor this value sits above:
 * the block is only *wholly* visible from about 0.64 up, and at 0.25 two-thirds of the
 * paragraph hung below the fold. Anything under ~0.64 cuts the copy off, which is what the
 * assertion at the foot of this file checks against the real measured block rather than
 * against that estimate.
 *
 * The headroom is worth knowing before retuning: at 0.81 the block stays fully visible up to
 * a block height of ~68vh, so ordinary reflow is covered and only an extreme short-wide
 * window would trip the assertion.
 */
export const CLIMB_TRAVEL_FRAC = 0.81;

/**
 * The span a *full* climb is spread over — the transcribed figure, kept whole so the rate
 * below is stated against the composition it was measured from.
 *
 * The copy's full travel is `(viewportHeight + blockHeight) / 2` — from just under the fold
 * to centred — which is ~74vh at the reference's own viewport, so over this span the block
 * crosses at about 0.7× the page's own rate. That is the figure that matters: a block that
 * moves at or above page speed reads as being carried off rather than climbing, which is the
 * floor `DICT_VH` is held against in DefinitionSection for the same reason.
 */
const CLIMB_FULL_VH = 105;

/**
 * How long the assembled composition holds before the pin releases — i.e. how much scroll sits
 * between the copy arriving at the centre and the section starting to leave.
 *
 * **It cannot be zero, and that it was is what made the section read as being taken over by the
 * one below it.** With `HOLD_VH = 0` the climb and the pin end on the same scroll offset, so the
 * copy's arrival and the section's departure are the same instant *by construction*: there is no
 * scroll position at which the finished composition exists. Measured through one continuous flick
 * at 1440x900, the last frame before the release had the copy at 314 against a resting 289 and
 * the next frame had the whole stage 81px up and climbing — the reader sees the copy rise, and
 * then sees it swept off the top with the gray coming up behind it, which is not a section
 * scrolling out, it is a section being removed mid-gesture.
 *
 * So this is the beat the section is actually for, and it is sized from the reader rather than
 * chosen: at an ordinary reading scroll of ~800px/s, 30vh of a 900px window is 270px, i.e. about
 * a third of a second with the composition assembled and still. That is the shortest dwell that
 * registers as an arrival. Below about 15 it is back to a flicker; above about 45 the stillness
 * starts to read as the page having stopped responding.
 *
 * Two earlier passes cut this to 10 and then to 0 chasing exactly the complaint it causes when
 * absent, on the theory that the frozen stretch was the problem. It was not — see the note on
 * `scrub` in ./sequence, which is where the real fault was, and which had to be fixed first for
 * any value here to behave predictably. A hold under a lagged clock is spent on catch-up rather
 * than on the composition, which is why removing it twice changed nothing the reader could see.
 *
 * It remains the one knob for the hand-off to whatever follows: raising it delays that vh for vh.
 */
export const HOLD_VH = 30;

/**
 * Every length that follows from the travel.
 *
 * The span is **derived** from the fraction rather than stated: a shorter travel over the same
 * span would not be a shorter climb, it would be the same climb slowed down — at 0.25 the block
 * drifted at 0.18× the page's rate, which reads as barely moving. Scaling the span with the
 * travel holds the ~0.7× crossing rate at every fraction, so the copy keeps its speed and what
 * changes is how soon the section is done with the reader. It follows that the pin shortens
 * too, and that is the point: the pin ends when the climb does (plus HOLD_VH).
 *
 * One object rather than loose constants because `sectionVh` is the section's CSS height and
 * `pinVh` is what the sequence converts progress against — if those two were stated apart the
 * climb could be scaled against a height the section does not have.
 *
 * **These are the wide layout's figures, and the wide layout is the only one that scrolls.**
 * Where the river is the narrow one (every phone, every upright tablet) nothing here applies:
 * the stage is a single unpinned viewport and the copy is a plain band under it — see
 * `PlaygroundNarrative`. There is no narrow climb to tune.
 */
export const CLIMB = (() => {
  const travelFrac = CLIMB_TRAVEL_FRAC;
  const climbVh = CLIMB_FULL_VH * travelFrac;
  const pinVh = climbVh + HOLD_VH;
  return { travelFrac, climbVh, pinVh, sectionVh: pinVh + 100 };
})();


/**
 * The header leaves with the copy, over this window of the climb. It does not sit still — the
 * reference's lockup clears the top edge as the copy arrives and comes back as the copy
 * descends.
 *
 * **What is measured is the position, and only the position.** Tracking the descriptor's top
 * edge against the copy's rule at 30fps: the lockup holds at y = 18 while the copy climbs from
 * 851 to 797, then clears the top while the copy moves a further 36px. Converting those two
 * rule positions to the copy's own progress puts the move at **0.75 → 0.80** of the climb. The
 * end here is 0.85 rather than 0.80 because 0.80 is where the lockup's *top* left the screen,
 * not where its last pixel did.
 *
 * **The speed it appears to move at is not measurable from the recording, and it is worth
 * being explicit about why.** The reference's header is *cued* — a fixed-duration tween, ~0.2s
 * in both directions, and coming back up it keeps arriving for a sixth of a second after the
 * copy has already parked. A cued move's velocity against a scrubbed one is just the reader's
 * scroll speed, so its apparent ratio to the copy is whatever that happened to be: the same
 * recording gives **2.1×** going down and **5.4×** coming up. There is no design figure there
 * to reproduce.
 *
 * So this is scrubbed off the same clock as the copy, which preserves the one thing that is a
 * design figure and makes the two a single coupled gesture that cannot drift. A second clock
 * over one shared moment is this repo's most expensive recurring bug — the hero's wash, its
 * door close, DefinitionSection's wordmark slide, each drifting by exactly the reader's speed.
 */
export const HEADER_EXIT = [0.75, 0.85] as const;

/**
 * Soft at both ends. Unlike the climb this rides on, the header genuinely does start and stop
 * — it is still at 0.75 and still again by 0.85 — so it is the case an ease is actually for.
 */
export const HEADER_EXIT_EASE = gsap.parseEase("sine.inOut");

/**
 * **Linear, and not eased** — which is the opposite of what it shipped as, and the reason is
 * worth keeping.
 *
 * `sine.inOut` is the obvious choice for a move that starts and stops, and it is wrong for one
 * that hands over. Measured across the last 240px of scroll before the release, it moved the
 * copy 25, 19, 13, 6, 0.5, 0 px — it decelerates to a standstill *inside* the pin, so the last
 * stretch of the climb is a second dead zone on top of whatever HOLD_VH is. Linear moves it a
 * steady 26px per 40px of scroll right up to the hand-off, where the stage takes over at 40 —
 * so the reader sees continuous motion that speeds up slightly into the release, never a stop
 * followed by a jump.
 *
 * There is no abruptness to ease away, because nothing here actually stops: the copy does not
 * come to rest and then wait, it reaches the centre exactly as the section begins to leave.
 * `DefinitionSection`'s own climb is linear for the same reason.
 *
 * At this span the copy crosses at about 0.7× the page's own rate, which is what makes it read
 * as climbing rather than as being carried — see CLIMB.
 */
export const CLIMB_EASE = gsap.parseEase("none");

/**
 * How fast the copy travels along the river, in px per second, and in which direction.
 *
 * Measured, not chosen: the ribbon's three largest ink blobs repeat at a 400px pitch along
 * the path, and tracking that pitch across two frames two seconds apart puts it 40px further
 * *upstream* — toward the top-right, against the river's own flow, which is what the copy
 * says. `hero/WavyBand.tsx` runs at 55 px/s, but its glyphs are half the size; per em this
 * one is about a third of that speed, and it reads as a drift rather than a marquee.
 */
export const MARQUEE_SPEED = 20;

/**
 * The copy that rides the river, and the gap between repetitions.
 *
 * The marker is **U+25BA, "black right-pointing pointer", and not U+25B6 — and the difference
 * is an iPhone.** U+25B6 has an emoji presentation (it is the ▶️ key on every emoji keyboard),
 * and when a font has no glyph for it iOS falls back to Apple Color Emoji: the ribbon's
 * marker rendered as a blue-and-white play button on the client's phone, where every desktop
 * browser drew a flat black triangle. U+FE0E (the text-presentation selector) is the textbook
 * answer and is not reliable inside SVG `<textPath>` across engines; U+25BA sidesteps it, since
 * it has no emoji form at all and falls back to the same symbol fonts on every platform.
 *
 * Worth knowing before editing it again: the Zalando variable font has no glyph for either
 * (checked against the file's own cmap), so it renders from the platform fallback, and the
 * measured 400px pitch at a 46px type size only closes if that fallback's advance is about
 * 0.6em. A different marker will shift the pitch; nothing breaks, the repeats simply sit
 * closer or further apart.
 */
export const RIVER_TEXT = "Work Upstream";
export const RIVER_MARKER = "►";
/**
 * The gap either side of the marker. A non-breaking space rather than an ordinary one,
 * because SVG collapses runs of ordinary whitespace — and built from its code point rather
 * than pasted in, since a literal U+00A0 in source is invisible to whoever edits this next.
 */
export const RIVER_GAP = String.fromCharCode(0x00a0);

if (process.env.NODE_ENV !== "production") {
  // The climb has to be slower than the page it is scrolling against, or it reads as being
  // swept off rather than rising. Worst case is the tallest block on the shortest viewport
  // the wide layout reaches — a landscape tablet — where a block can reach roughly 0.8H:
  // travel is (H + block)/2 scaled by the fraction, with the span scaled along with it, so
  // the ratio is invariant under the knob and this only binds if CLIMB_FULL_VH is cut.
  const worstTravelVh = ((1 + 0.8) / 2) * 100 * CLIMB.travelFrac;
  if (worstTravelVh > CLIMB.climbVh) {
    console.error(
      `[Playground] the copy would travel ${worstTravelVh.toFixed(0)}vh over a ` +
      `${CLIMB.climbVh.toFixed(1)}vh span, i.e. faster than the page scrolls, and would ` +
      "read as being carried off rather than climbing. Raise CLIMB_FULL_VH, or lower " +
      "CLIMB_TRAVEL_FRAC.",
    );
  }
}
