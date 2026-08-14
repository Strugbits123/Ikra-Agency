import { gsap } from "@/lib/gsap";
import { DOOR_SEALED_AT } from "./doors";

/**
 * The hero's timeline, in vh of actual scrolling through the pin.
 *
 * Written as a chain of derivations rather than a list of numbers, so retiming
 * any beat carries the rest along instead of quietly opening a gap or an overlap.
 *
 * The copy is scrubbed; four beats are *cues* — the opening, the ribbon, the doors'
 * close and the orange→gray wash. Crossing a cue starts a move that plays to completion
 * on its own clock, so it costs no designed scroll distance, cannot be left
 * half-finished by stopping, and runs at the same speed however fast the wheel was
 * turned. Marked "(cue)" below.
 *
 * The trouble with a cue, and the thing this file has been rewritten around three times,
 * is that it costs an *unknown* amount of real scroll — the reader keeps moving while it
 * plays — so it lands at a mark that depends on their speed, and anything measured from
 * that landing inherits it. An unbounded landing at the front of the section is what
 * made the gap copy come apart on a fast scroll.
 *
 * The three cues in the tail are safe because nothing is keyed to a mark behind them.
 * The opening is safe for a different reason, and it is the one idea worth carrying out
 * of here: it has a **scroll floor** under it. The move may run ahead of the scroll and
 * never behind it, so the landing is bounded by DOOR_OPEN_AT even though its timing is
 * not — one scroll of any size plays the whole thing on the clock, and the copy below
 * still starts from a fixed number. See OPEN_VH.
 *
 * The rule for anything added here: a cue at the front needs a floor, or the beats
 * behind it need to not exist.
 *
 * Phases (see PIN_VH):
 *      1vh     (cue) the whole opening, and the whole of the first scroll however
 *              small it is: 1.5s of one continuous eased path with no resting place
 *              anywhere inside it. The panels travel across all of it, though the
 *              first 41% is invisible because they are still overlapped; the hole
 *              the footage is seen through closes across exactly that stretch, so
 *              the footage hands straight over from the shrinking hole to the
 *              widening gap with no bare orange between them (SEAL_OVERSHOOT). The
 *              footage never moves or resizes, and the headline fades on the hole's
 *              driver so it is gone at the instant the hole shuts. Then the doors
 *              carry on opening diagonally and stop partway across the screen,
 *              leaving wedges in the bottom-left and top-right corners for good.
 *              "growth creates a gap" is not played *over* this — it *is* this,
 *              growing out of the centre point the panels part from with its width
 *              locked to the gap's in constant proportion (see leadSeat), so it
 *              reaches full size on the frame the panels stop.
 *   ≤53vh      where that lands, which depends on how far the reader travelled
 *              during the 1.5s: ~17vh at a reading pace, 53 at a flick. 53 is the
 *              ceiling and not a preference — past it the scroll floor has taken
 *              over and the doors are open regardless (see OPEN_VH). Everything
 *              below is written against the ceiling, so none of it moves.
 *   53–65vh    the line holds at full size, doors at rest, nothing else moving —
 *              longer than 12vh for anyone whose doors landed early (LEAD_HOLD_VH).
 *   65–95vh    it climbs away, shrinking and blurring out — an ordinary exit.
 *   80–125vh   "between who you've become" rises into the seat as the lead line
 *              leaves it; the overlap is what makes an exchange one gesture rather
 *              than a swap. 45vh of arrival — about one scroll gesture (COPY_IN_VH).
 *  125–133vh   it holds.
 *  133–163vh   it climbs away.
 *  148–193vh   "how the world sees you" rises in behind it, on the same overlap.
 *  193–201vh   it holds.
 *  201–231vh   it climbs away, clearing the stage — and from 0.7 of the way through
 *              that exit the wave is already coming in under it (BAND_DRAW_AT).
 *  222–282vh   (cue, both ends) the wavy ribbon draws in right-to-left (a clip,
 *              not a fade), bridging the two wedges, then closes the same way
 *              round — see BAND_DRAW_AT.
 *  282–314vh   "until you make the leap" fades up into the space the ribbon is
 *              vacating, at the same seat and sized to the same span — beginning on
 *              the very instant the wave starts to close, so the wedges are never
 *              bare between them (see LEAP_AT).
 *  314–352vh   it holds.
 *     352vh    (cue) the doors close over 0.95s, retracing their opening exactly, and
 *              the third scroll is the whole of it. The line recedes on the same
 *              progress, scaling to nothing at full opacity and never fading,
 *              reaching zero exactly as the panels meet — 72% of the way through the
 *              close, since closing retraces the opening (see CLOSE_SEALED_P). The
 *              remaining 28% is the identical flat orange rectangle every frame.
 *              the scroll floor under that close, so it is complete at a fixed mark
 *              however fast the reader goes (CLOSE_VH). Not the close's length —
 *              below the crossover it plays at its own speed inside this.
 *              (cue) the moment the panels meet, the sealed orange washes over to
 *              the next section's gray, off the close's progress rather than a mark
 *              of its own so nothing can open a flat-orange stall between the two.
 *  369–373vh   the last 4vh of the pin, and all that is left of it. The wash
 *              is playing, DefinitionSection's veil is fading in over it to the
 *              same gray, and its statement is resolving below the fold — all
 *              three cued off this one instant (see HERO_GRAY_TAIL_VH). The pin
 *              then releases and that section's top edge, statement first, comes
 *              up from the bottom of the screen while the gray is still arriving.
 *              There is no flat-gray hold left between the two.
 */

/**
 * Why the opening is scrubbed, and what that costs.
 *
 * It was cued for two versions: crossing 8vh fired one 1.6s move that sealed the hole
 * and cracked the doors, and a second mark fired a 0.9s swing. That is a better *door* —
 * one gesture, one speed, never parked half open — and it is what broke everything
 * behind it, for a reason worth stating plainly.
 *
 * A cue costs no *designed* scroll but consumes real scroll, because the reader keeps
 * moving while it plays. So the doors came to rest wherever 2.5 seconds of scrolling
 * happened to reach: 52vh at a reading pace, 119vh at an ordinary one, 327vh on a fast
 * scroll — out of a 342vh section. Everything after the doors is measured from where
 * they stop, so the gap copy had 290vh of room, or 223, or 15. It was compressed to fit
 * (1.3× / 2.7× / 3.3×), and past the cap on that compression it had to *start before the
 * doors stopped* — which is the visible fault: the lead line's exit ramp running while
 * the aperture was still scaling it up, and the two lines behind it flashing past. Three
 * different sequences out of one section, decided by the wheel.
 *
 * Scrubbing the legs fixed all of that — the doors rested at DOOR_OPEN_AT at every
 * speed, so the copy played at 1.00× whether the reader crawled or flicked — and it
 * could not deliver the beat this section is actually built on. A scrubbed span is a
 * *distance*; how long it takes is the reader's business. So it was tried at 20vh, which
 * was a quarter of a second and jerky, and at 34vh, which looked right at 0.7s and was
 * three vh longer than a wheel notch could carry — one scroll sealed the video, barely
 * moved the doors, and left a blank orange screen. There is no length that does both: no
 * span a door can visibly swing across fits inside 11vh.
 *
 * So the opening is timed again, and the floor is what makes that safe this time. The
 * clock gives "one scroll opens it" for a gesture of any size; the floor caps the
 * landing at DOOR_OPEN_AT so the copy below still starts from a fixed number, which is
 * the whole of what the cued versions got wrong. Both properties, and the only thing
 * paid for them is that DOOR_OPEN_AT is a *ceiling* rather than a rest position, so
 * LEAD_HOLD_VH carries the slack for readers whose doors landed early.
 */

/**
 * Where the opening is cued: the first scroll of any size, and the whole of it.
 *
 * From 1 rather than 0 so the first pixel of scroll does not already have the footage
 * closing — the entrance has only just finished fading it in.
 */
export const SEAL_AT = 1;

/**
 * How long the whole opening takes when the reader is not outrunning it, and how that
 * is split between the two legs.
 *
 * A pure distance cannot do this job, which is what the two attempts before this one
 * established. The opening was scrubbed across 20vh and then 34vh; the first was quick
 * and jerky, and the second — long enough to look right at 0.7s — left a wheel notch
 * short of finishing it, so one scroll sealed the video and barely moved the doors and
 * the reader was looking at a blank orange screen. There is no length that fixes both:
 * a notch is ~11vh, and no span a door can visibly swing across fits inside one.
 *
 * So it is timed. Crossing SEAL_AT starts a move that plays to completion on its own
 * clock, which is what makes "one scroll opens it" true for a gesture of *any* size,
 * a single notch included. SEAL_FRAC splits the path: 0.42s of the video closing, then
 * 1.08s of the doors, back to back with nothing between them.
 */
export const OPEN_SECONDS = 1.5;

/**
 * How long the closing hole outlives the opening aperture, as a fraction of the path.
 *
 * The two legs used to be sequential — hole shut, *then* panels move — and that left a
 * beat of blank orange in the middle of the opening that had nothing in it at all. The
 * cause is that the panels are wider than half the screen each, so they go on
 * overlapping for the first 41% of their travel (see DOOR_SEALED_AT) and the aperture
 * does not appear until then. Sequential legs therefore mean: hole gone at 28% of the
 * path, gap appears at 58%, and 0.44s of solid orange between them.
 *
 * So they overlap instead. The panels now travel across the whole path and the hole
 * closes across the fraction of it that ends where the aperture opens — which costs
 * nothing, because a panel sliding while still overlapped is invisible, and it is the
 * same footage on both sides of the hand-over. This is the small overlap on top of that,
 * so rounding can never put a bare frame between the hole's last pixel and the gap's
 * first: for a moment the shrinking hole sits over the widening gap, both showing the
 * footage, and the eye reads one continuous opening.
 *
 * The seal's end is *solved* from DOOR_SEALED_AT and the leg's ease rather than written
 * down (see APERTURE_AT in ./sequence), so retuning either cannot silently reopen the
 * gap this closes.
 */
export const SEAL_OVERSHOOT = 0.06;
/**
 * Travelling back is *slower*, and this is the second reverse in the file that wants
 * stretching rather than shortening (see CLOSE_REVERSE_SPEED for the other).
 *
 * It was 1.5× quicker, on the usual reasoning that a beat already watched should not be
 * sat through twice. That reasoning does not hold here, because coming back up this beat
 * has not been watched — it has been watched *forwards*. Backwards it is a different
 * thing to look at: the doors swing shut and the footage grows back out of the seam, and
 * a reader scrolling up out of "growth creates a gap" is looking straight at it.
 *
 * At 1.5× the whole return played in 1.0s, and the visible part of it is shorter still —
 * the panels only separate above 41% of the path, so the doors' travel and the hole's
 * reopening share that second between them. Under an ordinary upward scroll the ceiling
 * in paintStage then took over and dragged the rest through at the reader's speed, and
 * what arrived was the video simply *there*, on orange, with no closing and no growth.
 * 0.8 makes the return 1.9s, which is slower than the opening and deliberately so: it
 * also keeps the clock ahead of the ceiling up to ~40vh/s of upward scroll, so the move
 * is a move rather than a scrub for anyone reading rather than fleeing.
 */
export const OPEN_REVERSE_SPEED = 0.8;

/**
 * The scroll floor under that move, and the reason a clock is affordable here at all.
 *
 * A cue costs no *designed* scroll but consumes real scroll, because the reader keeps
 * moving while it plays — so it lands wherever their speed happens to carry them, and
 * everything measured from that landing inherits their speed. That is what put the gap
 * copy at 1.3× / 2.7× / 3.3× and, past the cap on it, started the copy before the doors
 * had stopped. The whole fault was the *unbounded* landing.
 *
 * So the move is allowed to run ahead of the scroll and never behind it:
 *
 *     pathP = max(cued, ramp(vh, OPEN_SPAN))
 *
 * Below about 35vh/s the clock is ahead and the reader gets the full 1.5s, one gesture,
 * however small. Above it the floor takes over and the opening finishes in whatever
 * scroll is left of this span — quicker, but still one continuous eased move, and
 * bounded. Either way the doors are open by DOOR_OPEN_AT, so that is a fixed mark again
 * and every beat below it is a fixed number, exactly as when the whole opening was
 * scrubbed. Nothing downstream can be compressed, reordered or skipped.
 *
 * 74vh, up from 52, because 52 put the crossover at ~35vh/s — an ordinary firm scroll —
 * and past it the floor drags the doors through the rest of their travel at the reader's
 * speed, which is the "sometimes it snaps open" case. The same number bounds the reverse,
 * so it fixes the mirrored complaint on the way back up at the same time. It is where the
 * two costs cross. Longer, and the clock governs for faster readers
 * but LEAD_HOLD_VH has to carry more slack for the reader who opens the doors in one
 * notch at 11vh and then has to reach the copy. Shorter, and the floor binds at
 * ordinary reading speeds and the timing stops being a timing.
 */
export const OPEN_VH = 74;
export const DOOR_OPEN_AT = SEAL_AT + OPEN_VH;
export const OPEN_SPAN = [SEAL_AT, DOOR_OPEN_AT] as const;

/**
 * The doors stand at rest for a beat before the lead line begins to leave.
 *
 * 12 rather than 20 because the real hold is longer than this number for everyone
 * except the fastest readers. DOOR_OPEN_AT is the *latest* the doors can land (see
 * OPEN_VH), and one wheel notch lands them at ~11vh, so that reader holds the line for
 * ~54vh rather than 12. The slack has to sit somewhere and this is the right place for
 * it: a held full-size line of copy is something to read, where the same slack at the
 * end of the section would be a screen of flat gray.
 */
export const LEAD_HOLD_VH = 12;

/**
 * The copy after the doors. The lead line arrives *with* them and is already seated
 * when they stop, so what these buy is scroll for the two lines behind it.
 *
 * 45 is the size of one scroll gesture: a trackpad swipe covers most of a viewport
 * height, so one swipe carries a line from below the seat to settled in it. The
 * exit is two thirds of that, because a line that is leaving has the eye's
 * permission to go and one that is arriving does not. What carries the smoothness
 * at this length is the ease rather than the distance (see STACK_IN).
 *
 * Lengthening it moves the whole tail of the sequence back, since COPY_STEP_VH is
 * built from it and BAND_DRAW_AT from where the copy ends. That is intended: the
 * wave should still wait for the copy to clear.
 */
export const COPY_IN_VH = 45;
export const COPY_HOLD_VH = 8;
export const COPY_OUT_VH = 30;

/**
 * The lead line's exit, once the doors have stood at rest for a beat — and the copy
 * sequence's origin, which is now simply a number rather than something measured per
 * pass.
 *
 * The line must not begin to leave until the doors are at rest: it is still growing out
 * of the aperture until then, and the two are one gesture. That is guaranteed by
 * construction here, because the doors' rest is a fixed mark on the same clock this is
 * on (see DOOR_OPEN_AT). It used to be keyed to where they *actually* stopped, which
 * moved with scroll speed, and the arithmetic that tried to fit a full-length copy into
 * whatever scroll was left is what came out with the cues.
 */
export const LEAD_OUT_AT = DOOR_OPEN_AT + LEAD_HOLD_VH;

/**
 * Each line rises as the one before it is halfway out — the overlap is what makes
 * a handover read as one unhurried gesture rather than a swap. It is the same for
 * all three: the lead line's *exit* is an ordinary exit, and only its arrival is
 * special.
 */
const COPY_STEP_VH = COPY_IN_VH + COPY_HOLD_VH + COPY_OUT_VH / 2;

export type GapLine = {
  text: string;
  /** null on the lead line: the doors are its arrival (see leadSeat). */
  in: readonly [number, number] | null;
  out: readonly [number, number];
};

/** The nth line behind the lead, placed on that cadence. */
const follower = (text: string, n: number): GapLine => {
  const at = LEAD_OUT_AT + COPY_OUT_VH / 2 + n * COPY_STEP_VH;
  const out = at + COPY_IN_VH + COPY_HOLD_VH;
  return { text, in: [at, at + COPY_IN_VH], out: [out, out + COPY_OUT_VH] };
};

/**
 * The gap copy: three lines that each pass through the same centre seat, one at a
 * time. Words and timing are one table on purpose — they were two parallel lists,
 * which is an invitation to add a line without a window or retime a window
 * against the wrong words. A fourth line is `follower(text, 2)`.
 */
export const GAP_LINES: GapLine[] = [
  {
    text: "growth creates a gap",
    in: null,
    out: [LEAD_OUT_AT, LEAD_OUT_AT + COPY_OUT_VH],
  },
  follower("between who you've become", 0),
  follower("how the world sees you", 1),
];

const LAST_LINE = GAP_LINES[GAP_LINES.length - 1];

/** The stage is clear again: the last line has finished leaving. */
export const COPY_END = LAST_LINE.out[1];

/**
 * The ribbon's draw-in is NOT scrubbed: crossing either end of the span fires a
 * timed tween that runs to completion, so stopping mid-scroll can never leave half
 * a wave on screen.
 *
 * It is cued on the last line being *halfway out*, not on the stage being clear.
 * The two used to be separated by the line's whole 30vh exit plus 25vh of dead
 * scroll on top, held apart so a fast scroll could not cross this cue while the copy
 * was still playing — but what that bought in safety it spent on 55vh of empty
 * orange between the copy going and the wave arriving, which is the longest nothing
 * happens anywhere in the section. Overlapping them makes one gesture of it: the
 * line climbs away and the wave draws in underneath it, and because the draw is a
 * 0.9s cue against a 30vh scrub the wave is complete about where the line finishes
 * clearing.
 *
 * BAND_OVERLAP is how far into that exit, and it is 0.7 rather than the 0.5 the copy
 * hands over to *itself* on, because the exit's ease is not linear and the eye reads
 * position rather than progress. STACK_OUT is `sine.inOut`, so at the halfway mark
 * the line has travelled only ~37% of its rise and is still 62% opaque — sitting, to
 * look at, exactly where it was, in the centre the ribbon spans. That is the
 * collision. At 0.7 it has climbed ~9.5% of the viewport and dropped to ~20%, small
 * and faint and plainly on its way out, while still visibly moving — which is the
 * beat asked for: the wave starts *as the line leaves*, not as it sits.
 *
 * Measured in the same raw vh the copy is, which used not to be true and is the other
 * half of why this looked like a different beat on different scrolls: the copy ran on a
 * squeezed clock of its own, so a band cued in raw vh slid earlier against the line by
 * however much that pass had squeezed. There is one clock now (see DOOR_OPEN_AT), so
 * the overlap tuned here is the overlap at every scroll speed.
 *
 * The cost is the case that separation was for — scrolling back *up*, the ribbon's
 * 0.5s close now runs against the last line returning rather than after it. They are
 * at opposite ends of the stage and the close is the quicker of the two, so they
 * read as one reversal rather than a collision.
 */
const BAND_OVERLAP = 0.7;
export const BAND_DRAW_AT = LAST_LINE.out[0] + COPY_OUT_VH * BAND_OVERLAP;

/**
 * Where the ribbon *un*-draws on the way back up — a different mark from the one it
 * draws on coming down, and it has to be.
 *
 * A single threshold cannot serve both passes here, because the overlap it buys going
 * down is an overlap the wrong way round going up. Coming down, the line is *leaving*
 * at BAND_DRAW_AT: 21% opaque and still fading, so the wave draws in behind something
 * on its way out. Reversing across that same mark, the line is *arriving* — it starts
 * at 21% and climbs from there while the wave's 0.5s close is still running, so it
 * gains most of its opacity on top of a ribbon that has not gone yet.
 *
 * So the return is cued off the copy being clear instead, plus a lead: BAND_UP_LEAD_VH
 * is about half a second of upward scroll, which is the whole of BAND_HIDE_SECONDS.
 * The wave is therefore closing across a stretch where the last line is still fully
 * gone, and has finished by the frame that line begins to come back.
 *
 * Selected by the direction of travel, not by whether the ribbon is currently shown
 * (see the `scrollDir` ternary in paintStage). A release mark above a commit mark is
 * the inverse of hysteresis and oscillates if it is latched on state; direction is the
 * one input that is stable while the scroll is stopped. Going down, the scroll passes
 * BAND_DRAW_AT and this never comes into it, so the downward beat is untouched.
 */
const BAND_UP_LEAD_VH = 24;
export const BAND_UNDRAW_AT = LAST_LINE.out[1] + BAND_UP_LEAD_VH;
const BAND_HOLD_VH = 60;
export const BAND_CLOSE_AT = BAND_DRAW_AT + BAND_HOLD_VH;
export const BAND_DRAW_SECONDS = 0.9;
export const BAND_HIDE_SECONDS = 0.5;

/**
 * How much quicker the ribbon travels backwards along its sweep (see bandClip).
 *
 * The same reasoning as OPENING_REVERSE_SPEED and the gray wash's: going back up the
 * visitor has already seen the beat and is looking for what was before it. Here it also
 * settles a measured collision. Retreating the way it came is *correct* where the old
 * three-state version wrongly sent a reversed ribbon out of the opposite side, and it is
 * slower — 0.9s against 0.5s — so it ran further into the last line of copy coming back
 * into its seat. 2.5 with BAND_UP_LEAD_VH at 24 keeps the two apart up to 90vh/s of
 * upward scroll, against 25vh/s before either existed.
 *
 * In family with the wash, which reverses at 1.3 / 0.55 ≈ 2.4× for the same reason.
 */
export const BAND_REVERSE_SPEED = 2.5;

/**
 * The closing line takes the space the ribbon just vacated — and starts taking it on
 * the same instant the ribbon starts leaving it, which is why there is no gap between
 * the two marks at all.
 *
 * It had 35vh of lead, on the reasoning that the close is a timed tween and the cue
 * can be crossed at speed, so the wave had to be guaranteed gone first. That
 * guarantee is real but it does not need distance to hold, and buying it with
 * distance left a stretch of bare orange wedges with nothing between them: the wave
 * gone, the line not yet begun.
 *
 * The two clocks do the work instead, and they lean the right way. The close is 0.5s
 * on its own clock; the arrival is 32vh of scroll through `sine.inOut`, which is at
 * its slowest exactly at the start. So half a second in — about the whole of the
 * close, at any ordinary rate — the line is only ~15% up, and it does not reach even
 * a quarter until the wave has certainly gone. Something is always in that seat, and
 * never two things at once.
 *
 * The pass back up is the case this shape gives away, the same one BAND_OVERLAP does:
 * the ribbon's 0.9s draw now runs against the line receding rather than after it.
 */
export const LEAP_AT = BAND_CLOSE_AT;
export const LEAP_IN_VH = 32;

/**
 * How much of the wave has to be gone before the closing line may take the seat, as a
 * span over "fraction of the ribbon cleared" rather than over scroll.
 *
 * The paragraph above holds at a reading pace and comes apart at speed: 32vh is 0.36s
 * at 90vh/s, so the line was fully seated while the 0.5s close was still running
 * through the same space. The two clocks lean the right way only while the scroll is
 * the slower of them, and nothing guarantees that.
 *
 * So the arrival is capped by the wave's own progress as well (see `bandClear` in
 * ./sequence), and this is the shape of that cap. A span and not a plain `1 - vis`
 * because they share one seat: a line at half strength under a wave that is half gone
 * is still two things in the same place. Shut until the ribbon is 55% cleared, fully
 * open at 90%, and the last 10% is left to the line's own ease so the two are never
 * both moving hard at once.
 */
export const BAND_CLEAR_AT = [0.55, 0.9] as const;
const LEAP_HOLD_VH = 38;

/**
 * The doors close as soon as the line has finished holding, and in one go.
 *
 * (cue) Crossing DOOR_CLOSE_AT fires a timed tween over the close's own progress,
 * so the whole return is one move at one speed whatever the wheel was doing, and no
 * stopping place can leave the stage with a gap frozen half shut. It was scrubbed
 * across 125vh once, on the reasoning that the close is the section handing itself
 * back rather than a beat of its own — but that is five or six notches to shut a door
 * the reader has already finished with, and the shut doors are the gate to the next
 * section, so grinding them closed holds up everything behind them.
 *
 * The *opening* is scrubbed and this is not, which looks like an inconsistency and is
 * the rule stated at the top of this file: a cue lands at a mark that moves with scroll
 * speed, which is ruinous where a sequence is measured from it and free at the end of
 * the section, where the only thing downstream is a wash riding this tween's own
 * progress. The asymmetry is the point rather than a leftover.
 *
 * The panels still retrace their opening exactly: `doorNow` is the opening's own
 * progress scaled back to zero (see paintStage), and only the clock under that
 * scaling has changed.
 *
 * CLOSE_VH is *not* the close's length — that is CLOSE_SECONDS. It is the scroll the
 * close is floored against, so the move is complete at a fixed mark whether the clock
 * or the reader got it there; a flick that outruns it is caught by the next section's
 * veil, which is opaque before the boundary crossing either way.
 *
 * Both numbers are floors rather than preferences, and the tail below is where any
 * shortening has to come from instead. Splitting the close over two cues and trimming
 * these to buy back scroll was tried and reverted: the second gesture arrives while
 * the first is still playing, so the panels never visibly finish — the reader sees
 * them jump the last of the way as the stage turns gray. A close that cannot be
 * watched to the end is worse than a screen of gray at the end of it.
 */
export const DOOR_CLOSE_AT = LEAP_AT + LEAP_IN_VH + LEAP_HOLD_VH;
/**
 * 1.15 rather than 0.95, and the floor under it (CLOSE_VH) is derived from it, so
 * retiming this carries the scroll window along instead of leaving the move without
 * room to finish in.
 *
 * Only 72% of this is ever watched — the panels cover the screen at CLOSE_SEALED_P and
 * every frame after that is the same flat rectangle — so the move the reader actually
 * sees is 0.72s of it, against 0.6s before. The extra is small on purpose: the fault
 * this addresses was never mostly the duration, it was that the window had shrunk below
 * it, and a close long enough to be unmistakable at 4vh of pin would have been a slow
 * one at 20.
 */
export const CLOSE_SECONDS = 1.15;

/**
 * How much slower the close runs *backwards*, when the reader comes up out of
 * DefinitionSection and the doors part again.
 *
 * Below 1 where every other reverse in this file is above it, and for a reason that is
 * the opposite of theirs. The others are beats the visitor has already watched, so
 * hurrying back past them is right. This one they have *not* watched: coming up from the
 * footer the stage is a flat gray screen, the boundary is crossed at whatever speed the
 * next section was scrolled at, and 31vh of guard is gone in a frame or two — so the
 * doors' entire re-opening is the first thing on screen and it arrives at full speed
 * from a standstill. At 0.95s it read as sudden. 1.5s is the same length as the
 * opening's own cue, which is what it is a reverse of.
 */
export const CLOSE_REVERSE_SPEED = 0.63;
/**
 * The scroll the close is floored against — the same bargain the opening makes, and
 * for the same reason (see OPEN_VH).
 *
 * This was 4, on the reasoning that a cue "plays out as the boundary crosses rather
 * than being cut off". That reasoning had a hole in it, and the hole is the veil:
 * DefinitionSection's cover is fully opaque one vh before the pin releases, so
 * anything still moving at that point does not play out as the boundary crosses, it
 * plays out *underneath* an opaque gray slab. With 4vh of window against a 1.15s move
 * the close was about a seventh done when the veil arrived at any ordinary pace, and
 * a reader had to be under 4.3vh/s to watch the doors actually meet. The gesture was
 * effectively never seen.
 *
 * A cue alone cannot fix that, because a cue costs no designed scroll and so cannot
 * hold the pin. A scrub alone cannot either — a wheel notch is ~11vh and no span the
 * panels can visibly travel across fits inside one. So the close gets what the opening
 * has: a clock with a scroll floor under it, which plays the whole designed move for
 * anyone below the crossover and compresses it continuously above, but is *complete*
 * at a fixed mark either way.
 *
 * 25 rather than the ~57 that matching the opening's crossover would give, and the
 * reason is downstream rather than here. Every vh of this span is scroll the reader
 * spends after a move that has already finished on its clock — stop just past
 * DOOR_CLOSE_AT and the doors are shut and the stage is gray with the whole span still
 * ahead. It also pushes the next section that much further below the fold at the
 * moment the wash lands, and the statement's lift has to clear the sum of the two (see
 * STATEMENT_LIFT_VH). Short is better on both counts.
 *
 * What it costs is only the crossover: at 25 the clock leads below ~22vh/s and the
 * scroll finishes the job above it. Being outrun is not a failure here — the floor
 * guarantees the panels are shut by CLOSE_END either way, which is the property that
 * matters and the one a bare cue could not give.
 */
export const CLOSE_VH = 25;
export const CLOSE_END = DOOR_CLOSE_AT + CLOSE_VH;
export const CLOSE_SPAN = [DOOR_CLOSE_AT, CLOSE_END] as const;

/**
 * How far through the close the panels meet and the stage reads as one unbroken
 * orange surface. Derived, not picked: they cover the screen well before they have
 * finished travelling (DOOR_SEALED_AT), and closing retraces the opening, so the
 * seal falls at the same fraction from the other end.
 *
 * Two things hang off it, which is why it is one number rather than two. The closing
 * line leaves *with* the doors rather than before them, receding as the orange
 * closes in (see leapSeat) and reaching zero exactly here — past this it would be
 * shrinking against a surface already sealed. And the wash to gray fires here, off
 * the close's own progress rather than off a mark in vh: the stretch between the
 * panels meeting and the colour turning over is the one place a flat-orange stall
 * can open up, and sharing the driver closes it by construction at every scroll
 * speed instead of at one.
 */
export const CLOSE_SEALED_P = 1 - DOOR_SEALED_AT;

/*
 * The wash to gray has no constants of its own any more, and that is deliberate.
 *
 * It used to be a cue like the ribbon and the close — 1.3s in, 0.8s out — on the
 * reasoning that a full-screen turn-over should be one move at one speed whatever the
 * scroll was doing. What that missed is that the wash is *on top of* the doors (z-25
 * against z-10), so its clock was racing theirs rather than accompanying it, and the
 * winner depended on the reader's speed. Coming back up it hid half the doors
 * reopening at a reading pace and all of it at 120vh/s.
 *
 * So it is scrubbed off `closeP` instead, spanning exactly CLOSE_SEALED_P → 1 — the
 * stretch where the panels are overlapped and there is nothing behind it to hide. One
 * clock cannot drift against itself: the gray is now at zero on the exact frame the
 * panels part, at every speed and in both directions. See GRAY_EASE in ./sequence.
 */

/**
 * Pinned scroll left once the wash is home — and it is not a guard, it is the window
 * the *next* section's statement arrives in. Published as HERO_GRAY_TAIL_VH, and
 * DefinitionSection derives its statement's cue from it so the two cannot drift.
 *
 * It was 1, on the reasoning that every vh here is flat gray with the next section
 * below the fold and therefore waste. That reasoning is right about the colour and
 * wrong about what is on top of it: the statement is lifted up out of its own section
 * (see STATEMENT_LIFT_VH) precisely so it can be drawn over this stretch, at z-50,
 * above the hero. This is not empty gray — it is where the paragraph rises into view.
 *
 * What it actually buys is *room*, and the ordering is enforced elsewhere. The
 * statement's presence rides the wash itself (see ./handoff), so the two are one
 * gesture whatever the reader does; this is simply the pinned scroll that keeps the
 * hero on screen long enough for that gesture to be watched rather than scrolled past.
 *
 * Together with CLOSE_VH it also fixes how far below the fold the next section sits
 * when the wash can first be complete, which is what STATEMENT_LIFT_VH has to clear —
 * there is an assertion on that pairing in ../definition/timeline. Lengthening either
 * constant pushes the statement further down and eventually past that check.
 */
const GRAY_TAIL_VH = 20;

/**
 * The pin plus the viewport the pinned stage occupies: the pin runs `top top` →
 * `bottom bottom`, so progress 0→1 covers `height − 100vh`.
 *
 * Everything past DOOR_CLOSE_AT is guard rather than choreography now that the close
 * and the wash are both cued: enough pinned scroll that an ordinary gesture cannot
 * unpin the stage mid-move, and no more.
 */
export const PIN_VH = DOOR_CLOSE_AT + CLOSE_VH + GRAY_TAIL_VH;
export const SECTION_VH = PIN_VH + 100;

/**
 * The hand-off, published for DefinitionSection: how much pinned scroll is left once
 * the close has had its guard, which is the stretch the stage spends already gray.
 *
 * That section's veil dissolves across exactly this window, so it is fully opaque on
 * the frame the boundary crossing begins — the wash finishes underneath it either
 * way, and the two never have to agree on a number by hand.
 */
export const HERO_GRAY_TAIL_VH = GRAY_TAIL_VH;

/**
 * The other hand-off: pinned scroll left from the instant the doors begin to close.
 *
 * DefinitionSection's statement is cued off this rather than off the pin's end, so it is
 * already rising while the panels are still shutting and the orange is washing to gray.
 * Cued off the end, it started ~31vh later — the whole of the close's guard — and that
 * gap is a screen of flat gray with nothing in it, which is what it is here to remove.
 */
export const HERO_CLOSE_TAIL_VH = PIN_VH - DOOR_CLOSE_AT;

/** 0 before the span, 1 after it, linear in between. */
export const ramp = (p: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (p - from) / (to - from));
