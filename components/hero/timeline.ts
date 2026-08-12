import { gsap } from "@/lib/gsap";
import { DOOR_SEALED_AT } from "./doors";

/**
 * The hero's timeline, in vh of actual scrolling through the pin.
 *
 * Written as a chain of derivations rather than a list of numbers, so retiming
 * any beat carries the rest along instead of quietly opening a gap or an overlap.
 *
 * Mostly scrubbed, but not entirely, and the exceptions are the point of the
 * opening: six beats are *cues* rather than windows. Crossing one starts a move
 * that plays to completion on its own clock, so it costs no scroll distance,
 * cannot be left half-finished by stopping, and runs at the same speed however
 * fast the wheel was turned. Those six are the three stops of the opening, the
 * ribbon, the doors' close, and the orange→gray wash — marked "(cue)" below.
 *
 * What is left scrubbed is the copy, and only the copy: three lines passing through
 * one seat is a stretch of reading, and reading is the reader's own pace. Every
 * gesture that is a *move* — a hole shutting, doors swinging, a ribbon drawing, a
 * colour turning over — is cued, because none of them is better for being ground out
 * a notch at a time.
 *
 * Phases (see PIN_VH):
 *       8vh    (cue) one continuous 1.6s move with two things in it, and the whole
 *              of the first scroll. First the hole the footage is seen through
 *              seals over 0.9s — the footage never moves or resizes, and the
 *              headline fades on the same driver so it is gone at the instant the
 *              hole shuts. Then the doors crack open over 0.7s: diagonally, and
 *              only a fifth of the way (see DOOR_AJAR). 8vh is under one wheel
 *              notch, so one scroll buys the pair of them.
 *      14vh    (cue) the second scroll, and the whole of the doors' remaining
 *              travel: 0.9s to swing the rest of the way and stop partway across
 *              the screen, leaving wedges in the bottom-left and top-right corners
 *              for good. One gesture opens them, however far that gesture happens
 *              to carry. 14 is the *earliest* this can fire — the real mark is a
 *              notch past wherever the crack landed (see OPEN_CUE_GAP_VH).
 *              "growth creates a gap" is not played over the opening — it *is* the
 *              opening, growing out of the centre point the panels part from with
 *              its width locked to the gap's in constant proportion (see
 *              leadSeat), so it grows a fifth of the way with the crack above and
 *              the rest here, reaching full size on the frame the panels stop.
 *   14–34vh    the line holds at full size, doors at rest, nothing else moving.
 *   34–64vh    it climbs away, shrinking and blurring out — an ordinary exit. This
 *              and the two lines below are the numbers for anyone whose doors came
 *              to rest at the nominal mark; the copy sequence measures from where
 *              they actually stopped (see COPY_SQUEEZE_MAX).
 *   49–94vh    "between who you've become" rises into the seat as the lead line
 *              leaves it; the overlap is what makes an exchange one gesture rather
 *              than a swap. 45vh of arrival — about one scroll gesture (COPY_IN_VH).
 *   94–102vh   it holds.
 *  102–132vh   it climbs away.
 *  117–162vh   "how the world sees you" rises in behind it, on the same overlap.
 *  162–170vh   it holds.
 *  170–200vh   it climbs away, clearing the stage — and from 0.7 of the way through
 *              that exit the wave is already coming in under it (BAND_DRAW_AT).
 *  191–251vh   (cue, both ends) the wavy ribbon draws in right-to-left (a clip,
 *              not a fade), bridging the two wedges, then closes the same way
 *              round — see BAND_DRAW_AT.
 *  251–283vh   "until you make the leap" fades up into the space the ribbon is
 *              vacating, at the same seat and sized to the same span — beginning on
 *              the very instant the wave starts to close, so the wedges are never
 *              bare between them (see LEAP_AT).
 *  283–321vh   it holds.
 *     321vh    (cue) the doors close over 1.1s, retracing their opening exactly, and
 *              the third scroll is the whole of it. The line recedes on the same
 *              progress, scaling to nothing at full opacity and never fading,
 *              reaching zero exactly as the panels meet — 72% of the way through the
 *              close, since closing retraces the opening (see CLOSE_SEALED_P). The
 *              remaining 28% is the identical flat orange rectangle every frame.
 *  321–351vh   pinned scroll held over that close so an ordinary gesture cannot
 *              unpin the stage while the panels are still moving (DOOR_CLOSE_VH).
 *              Not the close's length — it plays at its own speed inside this.
 *              (cue) the moment the panels meet, the sealed orange washes over to
 *              the next section's gray, off the close's progress rather than a mark
 *              of its own so nothing can open a flat-orange stall between the two.
 *  351–361vh   the last 10vh of the pin, and all that is left of it. The wash
 *              is playing, DefinitionSection's veil is fading in over it to the
 *              same gray, and its statement is resolving below the fold — all
 *              three cued off this one instant (see HERO_GRAY_TAIL_VH). The pin
 *              then releases and that section's top edge, statement first, comes
 *              up from the bottom of the screen while the gray is still arriving.
 *              There is no flat-gray hold left between the two.
 */

/**
 * Why the whole opening is cued, and what that costs:
 *
 * A scrubbed phase costs scroll to play, which is right for the copy below and
 * wrong for the hole sealing — a wheel notch is ~11vh, and no window a hole can
 * visibly close across fits inside one notch (110vh and 28vh both read as "two or
 * three scrolls"). So the seal is a cue, and the doors' crack belongs inside the
 * same cued move rather than after it: the first scroll should visibly start the
 * doors, not just close the video.
 *
 * Their remaining travel was scrubbed for the same reason it no longer is. Scrubbed
 * across 70vh it was faithful to the finger, but it took five or six notches to
 * finish a gesture the first scroll had already started: the doors sat visibly
 * half-open and had to be ground the rest of the way. It is a third cue now, so the
 * second scroll swings them fully open in one move, at one speed, whatever the
 * gesture was — and the 70vh it no longer needs came off the section rather than
 * being left as dead scroll (see DOOR_OPEN_AT).
 *
 * The cost is known and accepted: two cues cannot be separated *reliably* by
 * distance. ScrollSmoother keeps delivering scroll for a second or more after the
 * gesture ends, so a hard flick's tail crosses the second mark on its own and the
 * doors run shut→open in one continuous motion, never parking at the crack. That
 * reads as fast rather than as broken — it is the same move without the pause in
 * it — and the alternative, arming the second cue only once input has settled,
 * makes the doors wait on a timer the visitor cannot see or hurry.
 * OPEN_CUE_GAP_VH is the whole of the defence, and it is sized so that an ordinary
 * scroll parks at the crack and only a flick runs the two together.
 */

/**
 * Leg 1 of the cued move: the hole seals, and the headline fades with it.
 *
 * This is where the move is cued going *down*, and only going down. Coming back
 * up it is cued wherever it actually landed, which is a different mark and has to
 * be — see `cueAt` in ./sequence.
 */
export const SEAL_AT = 8;
export const SEAL_SECONDS = 0.9;

/**
 * Leg 2 of the cued move: the doors crack open, in the same breath as the seal.
 *
 * DOOR_AJAR is how far "a little bit" is, as a fraction of the doors' full travel.
 * It has to clear DOOR_SEALED_AT (~0.276) to be visible at all — below that the
 * panels still overlap and the stage is unbroken orange — so 0.42 is really 0.2 of
 * the *aperture*, about 8% of the screen's width. Cracked open, unmistakably not
 * open.
 */
export const DOOR_AJAR = 0.42;
export const AJAR_SECONDS = 0.7;

/**
 * Leg 3: the doors swing the rest of the way, and the whole of the second scroll.
 *
 * A leg of the same path as the two above rather than a move of its own — one
 * number, one tween, no two owners of the same property — but cued *separately*,
 * because it is the second gesture and not a continuation of the first (see
 * `openCueAt` in ./sequence).
 *
 * 0.9s for the remaining 0.58 of the travel, against 0.7s for the first 0.42: a
 * shade slower per unit of ground than the crack, so the doors ease open rather
 * than snapping the moment they are released.
 */
export const OPEN_SECONDS = 0.9;

/** The three resting points of the cued opening, as positions along it. */
export const STOP_SHUT = 0;
export const STOP_AJAR = SEAL_SECONDS + AJAR_SECONDS;
export const STOP_OPEN = STOP_AJAR + OPEN_SECONDS;
/**
 * Travelling back is quicker, for the same reason the gray wash's reverse is:
 * going back up, the visitor has already seen the beat and is looking for what
 * was before it.
 */
export const OPENING_REVERSE_SPEED = 1.5;

/**
 * Where the doors' full open is cued — the *earliest* mark, not the mark.
 *
 * The real one is OPEN_CUE_GAP_VH past wherever the crack actually landed, and this
 * is only the floor under it, for a pass gentle enough that the crack lands before
 * 6vh. A fixed mark alone cannot do the job: the crack is on a clock and this is on
 * scroll, so one firm gesture reaches any fixed vh long before a 1.6s move has
 * finished, and the doors would swing while the hole was still closing.
 *
 * The lead line of the gap copy is not played *over* this leg — it *is* this leg
 * (see leadSeat), growing out of the point the panels part from and reaching full
 * size exactly as they stop.
 *
 * Because the leg is cued it costs no scroll, and everything below is written
 * against this mark rather than against a 70vh window past it — which is where the
 * section's ~78vh came off. A dynamic mark still means a dynamic rest, though, so a
 * flick that lands the crack late pushes the doors' stop past any exit ramp written
 * in absolute vh. The copy sequence therefore measures from where the doors
 * *actually* stopped (see COPY_SQUEEZE_MAX).
 */
export const DOOR_OPEN_AT = SEAL_AT + 6;

/**
 * How much scroll past the crack's landing the full open waits for.
 *
 * The one number deciding whether the doors park at the crack at all, so it is
 * sized against the gesture and nothing else: a wheel notch is ~11vh, so 8 is
 * crossed by the *next* notch and not by the residue of the one that cracked them —
 * that notch has already settled by the time the 1.6s move lands, smoothing and
 * scrub lag included. Raise it and a second scroll stops being enough; lower it and
 * the first one's tail finishes the job on its own.
 */
export const OPEN_CUE_GAP_VH = 8;

/** The doors stand at rest for a beat before the lead line begins to leave. */
export const LEAD_HOLD_VH = 20;

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
 * The lead line's exit, once the doors have stood at rest for a beat — and the
 * copy sequence's nominal origin, which is where it begins for anyone whose doors
 * came to rest at DOOR_OPEN_AT rather than somewhere past it.
 */
export const LEAD_OUT_AT = DOOR_OPEN_AT + LEAD_HOLD_VH;

/**
 * How far the copy sequence may be squeezed when it starts late.
 *
 * The lead line must not begin to leave until the doors are at rest — it is still
 * growing out of the aperture until then, and the two are one gesture — so its exit
 * is keyed to where they *actually* stopped, which differs whenever a flick carried
 * the cued legs a long way past their marks.
 *
 * Sliding the sequence back wholesale would push its tail off the end of the pin,
 * since PIN_VH is fixed at mount. So it is squeezed instead: the start moves,
 * COPY_END stays put, and every downstream beat is untouched at any scroll speed.
 * In the ordinary case the factor is 1 and nothing happens at all.
 *
 * The cap holds the invariant for doors landing as late as ~130vh, well past any
 * real gesture. Beyond that the sequence keeps its length and overlaps the tail of
 * the opening, which is harmless: the lead line's growth is carried through its exit
 * rather than discarded at it (see leadSeat), so an early exit is continuous, just
 * early.
 */
export const COPY_SQUEEZE_MAX = 0.7;

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
 * Measured against the copy's own clock and not raw scroll — see `copyVh` in
 * ./sequence. The two are the same only when the doors happen to stop at their
 * nominal mark; every other pass squeezes the copy into a shorter run of scroll, and
 * a band cued in raw vh slid earlier against the line by however much. That is why
 * this looked like a different beat on different scrolls.
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
 * one input that is stable while the scroll is stopped. Going down, `copyVh` passes
 * BAND_DRAW_AT and this never comes into it, so the downward beat is untouched.
 */
const BAND_UP_LEAD_VH = 12;
export const BAND_UNDRAW_AT = LAST_LINE.out[1] + BAND_UP_LEAD_VH;
const BAND_HOLD_VH = 60;
export const BAND_CLOSE_AT = BAND_DRAW_AT + BAND_HOLD_VH;
export const BAND_DRAW_SECONDS = 0.9;
export const BAND_HIDE_SECONDS = 0.5;

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
const LEAP_HOLD_VH = 38;

/**
 * The doors close as soon as the line has finished holding — and, like the opening,
 * in one go.
 *
 * (cue) Crossing DOOR_CLOSE_AT fires a timed tween over the close's own progress,
 * so the whole return is one move at one speed whatever the wheel was doing, and no
 * stopping place can leave the stage with a gap frozen half shut. It used to be the
 * one scrubbed part of the doors' travel, on the reasoning that the close is the
 * section handing itself back rather than a beat of its own — but 125vh is five or
 * six notches to shut a door the reader has already finished with, and the shut
 * doors are the gate to the next section, so grinding them closed holds up
 * everything behind them.
 *
 * The panels still retrace their opening exactly: `doorNow` is the opening's own
 * progress scaled back to zero (see paintStage), and only the clock under that
 * scaling has changed.
 *
 * DOOR_CLOSE_VH is *not* the close's length — that is CLOSE_SECONDS. It is pinned
 * scroll held over the close so an ordinary gesture cannot unpin the stage while the
 * panels are still moving; a flick that outruns it is caught by the next section's
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
export const CLOSE_SECONDS = 0.95;
/**
 * Sized against the *visible* part of the close, and nothing more.
 *
 * The panels cover the screen at CLOSE_SEALED_P — 72% in, about 0.68s — and every
 * frame after that is the same flat orange rectangle, so the guard only has to hold
 * the pin that far. 17vh is roughly that long at a steady scroll. The invisible
 * remainder finishes after the pin lets go, and it is not exposed by that: the next
 * section's veil is fully opaque on the frame the boundary crossing begins, so even a
 * flick that unpins mid-close has the stage covered before any of it could be seen.
 *
 * It has come down 30 → 22 → 17, and CLOSE_SECONDS 1.1 → 0.95 with it, because every
 * vh between the panels sealing and the pin releasing is blank gray with the next
 * section still behind a fixed stage. The two have to move together: shorten the
 * guard without the close and an ordinary scroll unpins while the doors are still
 * visibly travelling.
 */
export const DOOR_CLOSE_VH = 17;

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

/**
 * The stage turning over from orange to the next section's gray, in one move.
 *
 * On the same footing as the ribbon and the close: a cue fires a timed tween, so the
 * turn-over is one move at one speed whatever the scroll was doing and no stopping
 * place can leave the stage half orange and half gray.
 *
 * A wash that outruns its pinned scroll is not cut off — it is on its own clock, so
 * it keeps running after the pin lets go and always plays in full, finishing off
 * screen under DefinitionSection's veil, which is the same --color-gray and fades in
 * across this same stretch.
 */
export const GRAY_SECONDS = 1.3;
export const GRAY_HIDE_SECONDS = 0.55;

/**
 * Pinned scroll left once the close has had its guard — the whole of what remains,
 * and the only stretch of this section that can be flat gray with nothing in it.
 *
 * Deliberately shorter than the wash it covers: the wash is on its own clock and
 * finishes off screen under DefinitionSection's veil, which is the same colour, so
 * holding the pin out to meet it buys nothing and costs the reader a blank screen.
 *
 * 5, and it is the veil's whole dissolve window as well as this hold — the two are the
 * same stretch (see HERO_GRAY_TAIL_VH). That is short for a cross-fade and does not
 * matter here, because by this point the hero has already washed to `--color-gray` on
 * its own and the veil is gray fading in over gray. Its only real job is to be fully
 * opaque before the boundary crossing, which it reaches whatever the window.
 *
 * Every vh here is a vh of pinned gray with the next section still below the fold, so
 * this is as low as it goes: below 4 the release starts landing on the same frame the
 * wash is cued on, and the veil loses the window it needs to commit before the
 * crossing.
 */
const GRAY_TAIL_VH = 4;

/**
 * The pin plus the viewport the pinned stage occupies: the pin runs `top top` →
 * `bottom bottom`, so progress 0→1 covers `height − 100vh`.
 *
 * Everything past DOOR_CLOSE_AT is guard rather than choreography now that the close
 * and the wash are both cued: enough pinned scroll that an ordinary gesture cannot
 * unpin the stage mid-move, and no more.
 */
export const PIN_VH = DOOR_CLOSE_AT + DOOR_CLOSE_VH + GRAY_TAIL_VH;
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

/** 0 before the span, 1 after it, linear in between. */
export const ramp = (p: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (p - from) / (to - from));
