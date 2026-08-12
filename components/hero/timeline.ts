import { gsap } from "@/lib/gsap";
import { DOOR_SEALED_AT } from "./doors";

/**
 * The hero's timeline, in vh of actual scrolling through the pin.
 *
 * Written as a chain of derivations rather than a list of numbers, so retiming
 * any beat carries the rest along instead of quietly opening a gap or an overlap.
 *
 * Mostly scrubbed, but not entirely, and the exceptions are the point of the
 * opening: four beats are *cues* rather than windows. Crossing one starts a move
 * that plays to completion on its own clock, so it costs no scroll distance,
 * cannot be left half-finished by stopping, and runs at the same speed however
 * fast the wheel was turned. Those four are the two stops of the opening, the
 * ribbon, and the orange→gray wash — marked "(cue)" below.
 *
 * Phases (see PIN_VH):
 *       8vh    (cue) one continuous 1.6s move with two things in it, and the whole
 *              of the first scroll. First the hole the footage is seen through
 *              seals over 0.9s — the footage never moves or resizes, and the
 *              headline fades on the same driver so it is gone at the instant the
 *              hole shuts. Then the doors crack open over 0.7s: diagonally, and
 *              only a fifth of the way (see DOOR_AJAR). 8vh is under one wheel
 *              notch, so one scroll buys the pair of them.
 *   22–92vh    the doors travel the rest of the way and stop partway across the
 *              screen, leaving wedges in the bottom-left and top-right corners for
 *              good. Scrubbed, unlike the crack before it. These two numbers are
 *              where it runs at an ordinary scroll rate; flick hard enough to
 *              outrun the 1.6s above and the whole 70vh shifts out to start
 *              wherever that move landed (see DOOR_SCRUB_VH). "growth creates a
 *              gap" is not played over the opening — it *is* the opening, growing
 *              out of the centre point the panels part from with its width locked
 *              to the gap's in constant proportion (see leadSeat), so it grows a
 *              fifth of the way with the crack above and the rest here, reaching
 *              full size on the frame the panels stop.
 *   92–112vh   the line holds at full size, doors at rest, nothing else moving.
 *  112–142vh   it climbs away, shrinking and blurring out — an ordinary exit. This
 *              and the two lines below are the numbers for anyone who did not
 *              outrun the cued move; the copy sequence measures from where the
 *              doors actually stopped (see COPY_SQUEEZE_MAX).
 *  127–172vh   "between who you've become" rises into the seat as the lead line
 *              leaves it; the overlap is what makes an exchange one gesture rather
 *              than a swap. 45vh of arrival — about one scroll gesture (COPY_IN_VH).
 *  172–180vh   it holds.
 *  180–210vh   it climbs away.
 *  195–240vh   "how the world sees you" rises in behind it, on the same overlap.
 *  240–248vh   it holds.
 *  248–278vh   it climbs away, clearing the stage.
 *  278–303vh   dead scroll, so the copy is gone before the wave starts and the
 *              wave is gone before the copy comes back (see BAND_LEAD_VH).
 *  303–363vh   (cue, both ends) the wavy ribbon draws in right-to-left (a clip,
 *              not a fade), bridging the two wedges, then closes the same way
 *              round — see BAND_DRAW_AT.
 *  398–430vh   "until you make the leap" fades up into the space the ribbon
 *              vacated, at the same seat and sized to the same span.
 *  430–468vh   it holds.
 *  468–593vh   the doors close, retracing their opening exactly — the one part of
 *              their travel that *is* scrubbed, because it is the section handing
 *              itself back rather than a beat of its own. The line recedes across
 *              the first 91vh of that, scaling to nothing at full opacity and
 *              never fading, reaching zero exactly as the panels meet (~559vh).
 *              The pin releases at 583.5, ~92% of the way through the close — see
 *              PIN_VH. Every frame from ~559 on is the same flat orange rectangle,
 *              so nothing of it is lost; the section stops waiting on it.
 *     ~559vh   the panels meet: from here the stage is one unbroken orange surface
 *              and the rest of their travel has no visible edges in it.
 *      574vh   (cue) the sealed orange washes over to the next section's gray.
 *              Cued here rather than at the doors' stop because waiting would
 *              shorten the flat-orange stall instead of removing it. The 15vh of
 *              lead is margin for the reverse (see GRAY_LEAD_VH).
 *  574–584vh   the last 10vh of the pin, and the whole of the hand-off. The wash
 *              is playing, DefinitionSection's veil is fading in over it to the
 *              same gray, and its statement is resolving below the fold — all
 *              three cued off this one instant (see HERO_GRAY_TAIL_VH). The pin
 *              then releases and that section's top edge, statement first, comes
 *              up from the bottom of the screen while the gray is still arriving.
 *              There is no flat-gray hold left between the two.
 */

/**
 * Why the opening is half cued and half scrubbed:
 *
 * A scrubbed phase costs scroll to play, which is right for the copy below and
 * wrong for the hole sealing — a wheel notch is ~11vh, and no window a hole can
 * visibly close across fits inside one notch (110vh and 28vh both read as "two or
 * three scrolls"). So the seal is a cue, and the doors' crack belongs inside the
 * same cued move rather than after it: the first scroll should visibly start the
 * doors, not just close the video.
 *
 * Their remaining travel must then be scrubbed, not a second cue. Two cues cannot
 * be separated reliably by distance — ScrollSmoother keeps delivering scroll for a
 * second or more after the gesture ends, so a flick's tail crosses the next cue on
 * its own and the doors finish opening with no input, which reads as a glitch. Any
 * gap wide enough to defeat that tail is several notches of nothing on a wheel.
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

/** The two ends of the cued move, as positions along it. */
export const STOP_SHUT = 0;
export const STOP_AJAR = SEAL_SECONDS + AJAR_SECONDS;
/**
 * Travelling back is quicker, for the same reason the gray wash's reverse is:
 * going back up, the visitor has already seen the beat and is looking for what
 * was before it.
 */
export const OPENING_REVERSE_SPEED = 1.5;

/**
 * The doors' remaining travel, scrubbed: 70vh from here and they are at rest in
 * their corners.
 *
 * The lead line of the gap copy is not played *over* this — it *is* this (see
 * leadSeat), growing out of the point the panels part from and reaching full size
 * exactly as they stop.
 *
 * 70 is the compromise between two complaints about this same stretch: longer and
 * it is several scrolls to finish one beat, shorter and one trackpad swipe covers
 * all of it, which feels like it happened by itself. At 70 a swipe gets most of the
 * way, a wheel notch a seventh, and *every* notch of it moves the doors.
 *
 * DOOR_OPEN_AT is where this *earliest* begins, not where it always begins, and
 * that difference is what stops the doors moving while the hole is still closing. A
 * fixed start cannot do it: the seal is on a clock and this is on scroll, so one
 * hard gesture reaches any fixed vh long before a 0.9s seal has finished and the
 * two play at once. The origin is therefore where the cued move *landed*, floored
 * at DOOR_OPEN_AT (see `armVh`) — before it lands this leg contributes nothing, and
 * at the instant it lands its progress is exactly zero, so there is no step however
 * far the scroll had already run. An ordinary rate lands before 22vh and gets
 * precisely the fixed window this used to have.
 *
 * A dynamic start means a dynamic end, so a late-armed flick pushes the doors' rest
 * past any exit ramp written in absolute vh. The copy sequence therefore measures
 * from where the doors *actually* stopped, not from DOOR_OPEN_END (see
 * COPY_SQUEEZE_MAX).
 */
export const DOOR_OPEN_AT = SEAL_AT + 14;
export const DOOR_SCRUB_VH = 70;
/** Where the doors reach rest for anyone who did not flick past the cued move. */
const DOOR_OPEN_END = DOOR_OPEN_AT + DOOR_SCRUB_VH;

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
 * copy sequence's nominal origin, which is where it begins for anyone who did not
 * outrun the cued move.
 */
export const LEAD_OUT_AT = DOOR_OPEN_END + LEAD_HOLD_VH;

/**
 * How far the copy sequence may be squeezed when it starts late.
 *
 * The lead line must not begin to leave until the doors are at rest — it is still
 * growing out of the aperture until then, and the two are one gesture — so its exit
 * is keyed to where they *actually* stopped, which differs whenever a flick armed
 * the scrubbed leg late.
 *
 * Sliding the sequence back wholesale would push its tail off the end of the pin,
 * since PIN_VH is fixed at mount. So it is squeezed instead: the start moves,
 * COPY_END stays put, and every downstream beat is untouched at any scroll speed.
 * In the ordinary case the factor is 1 and nothing happens at all.
 *
 * The cap holds the invariant for arming as late as ~138vh, past any real gesture.
 * Beyond that the sequence keeps its length and overlaps the tail of the opening,
 * which is harmless: the lead line's growth is carried through its exit rather than
 * discarded at it (see leadSeat), so an early exit is continuous, just early.
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

/** The stage is clear again: the last line has finished leaving. */
export const COPY_END = GAP_LINES[GAP_LINES.length - 1].out[1];

/**
 * The ribbon's draw-in is NOT scrubbed: crossing either end of the span fires a
 * timed tween that runs to completion, so stopping mid-scroll can never leave half
 * a wave on screen.
 *
 * BAND_LEAD_VH is dead scroll between the last line of copy clearing and the wave
 * starting, and it is what keeps the two off each other's screen — a fast scroll
 * can cross a cue while a tween is still playing, and scrolling *up* the close is
 * racing the last gap line back on. It must stay at least as long as
 * BAND_HIDE_SECONDS takes to scroll through.
 */
const BAND_LEAD_VH = 25;
export const BAND_DRAW_AT = COPY_END + BAND_LEAD_VH;
const BAND_HOLD_VH = 60;
export const BAND_CLOSE_AT = BAND_DRAW_AT + BAND_HOLD_VH;
export const BAND_DRAW_SECONDS = 0.9;
export const BAND_HIDE_SECONDS = 0.5;

// The closing line takes the space the ribbon just vacated. The 35vh gap past the
// ribbon's cue guarantees the wave has gone before the line arrives, since the
// close is a timed tween and the cue can be crossed at speed. Sized against
// BAND_HIDE_SECONDS, so it grows if the close is slowed further.
export const LEAP_AT = BAND_CLOSE_AT + 35;
export const LEAP_IN_VH = 32;
const LEAP_HOLD_VH = 38;

// The doors close as soon as the line has finished holding, retracing their
// opening exactly because they run on the same progress value scaled back to
// zero. Quicker than the opening, which had the gap copy to carry.
export const DOOR_CLOSE_AT = LEAP_AT + LEAP_IN_VH + LEAP_HOLD_VH;
export const DOOR_CLOSE_VH = 125;

// The line leaves *with* the doors rather than before them, receding as the orange
// closes in (see leapSeat). Sized so its scale reaches zero exactly as the panels
// meet — past that it would be shrinking against a surface already sealed.
export const LEAP_OUT_AT = DOOR_CLOSE_AT;
export const LEAP_OUT_VH = DOOR_CLOSE_VH * (1 - DOOR_SEALED_AT);

/**
 * The instant the panels meet and the stage reads as one unbroken orange surface.
 * Derived, not picked: the panels cover the screen well before they have finished
 * travelling (DOOR_SEALED_AT), and the closing line's recession is already sized
 * to land exactly here — so the two share one number by construction.
 */
const SEALED_AT = LEAP_OUT_AT + LEAP_OUT_VH;

/**
 * The stage turning over from orange to the next section's gray, in one move.
 *
 * Everything after SEALED_AT is door travel nobody can see, which used to leave
 * ~60vh of flat orange with nothing happening on it — stopping in there read as the
 * page having run out. This is that stretch spent on the transition it was always
 * leading to instead.
 *
 * Not scrubbed, on the same footing as the ribbon: the cue fires a timed tween, so
 * the turn-over is one move at one speed whatever the scroll was doing and no
 * stopping place can leave the stage half orange and half gray. Scrubbed, it was a
 * readout of scroll velocity instead of a transition.
 *
 * GRAY_LEAD_VH is sealed-orange scroll between the panels meeting and the cue, and
 * it exists for the *upward* pass: the fade-out and the doors parting are otherwise
 * keyed to the same instant and would race. It only has to outlast
 * GRAY_HIDE_SECONDS, and is forgiving if it ever doesn't — the panels overlap by
 * 16% of the screen, so just past the seal the gap they open is a sliver.
 */
const GRAY_LEAD_VH = 15;
export const GRAY_AT = SEALED_AT + GRAY_LEAD_VH;
/**
 * Scroll the wash is given before the pin's own hold begins.
 *
 * A guard against a fast scroll outrunning a timed tween, and nothing more — it is
 * not the wash's length, which is GRAY_SECONDS whatever is written here. So every
 * vh of it the wash does not use is a vh of blank gray screen, which is why it is 6
 * and not 35: together with HOLD_VH this is the *whole* of the gap before the next
 * section's statement can come up, and it is meant to be crossed, not dwelt in.
 *
 * A wash that outruns it is not cut off — it is on its own clock, so it keeps
 * running after the pin lets go and always plays in full, finishing off screen
 * under DefinitionSection's veil, which is the same --color-gray and fades in
 * across this same stretch.
 *
 * The pass back up is unaffected: the far shorter GRAY_HIDE_SECONDS is what has to
 * fit there, and GRAY_LEAD_VH gives it the room.
 */
const GRAY_HOLD_VH = 6;
export const GRAY_SECONDS = 1.3;
export const GRAY_HIDE_SECONDS = 0.55;

/**
 * Pinned screen past the last phase, where nothing scroll-driven moves. Short,
 * and not meant as a beat of rest: it is flat gray with the doors shut and the
 * stage empty. Four is a margin, not a hold — enough that the release cannot land
 * on the exact frame the wash is cued on, and no more.
 */
const HOLD_VH = 4;

/**
 * The pin plus the viewport the pinned stage occupies: the pin runs `top top` →
 * `bottom bottom`, so progress 0→1 covers `height − 100vh`.
 *
 * Measured from the wash and *not* from the door close, which ends the pin with the
 * panels only ~92% of the way shut. They are shut: they cover the screen at
 * DOOR_SEALED_AT, and since closing retraces the opening the seal comes at about
 * 72% of the close — from there to the end, ~19vh, every frame is the identical
 * flat orange rectangle. That invisible stretch was holding the pin open and
 * keeping the next section a screen and a half below the fold. Dropping it shortens
 * nothing visible: the doors move at the same speed over the same scroll, and every
 * visible frame of the close is untouched.
 *
 * Asserted rather than assumed below: the close must be past the seal by the
 * release, or the pin would end on a stage with a gap still open in it.
 */
export const PIN_VH = GRAY_AT + GRAY_HOLD_VH + HOLD_VH;
export const SECTION_VH = PIN_VH + 100;

if (process.env.NODE_ENV !== "production") {
  const closeP = (PIN_VH - DOOR_CLOSE_AT) / DOOR_CLOSE_VH;
  if (closeP < 1 - DOOR_SEALED_AT) {
    console.error(
      "[HeroNarrative] the pin releases before the panels have sealed: close is " +
      `${(100 * closeP).toFixed(1)}% at PIN_VH, and the seal is at ` +
      `${(100 * (1 - DOOR_SEALED_AT)).toFixed(1)}%. Lengthen GRAY_HOLD_VH or ` +
      "HOLD_VH, or shorten DOOR_CLOSE_VH.",
    );
  }
}

/**
 * The hand-off, published for DefinitionSection: how much pinned scroll is left at
 * the moment this stage begins turning gray.
 *
 * That section places both of its hand-off cues against it — its veil's dissolve
 * and its statement's reveal both run across exactly this stretch — so the wash,
 * the dissolve and the text arriving all start on the same instant by construction
 * rather than by three constants being kept in step.
 */
export const HERO_GRAY_TAIL_VH = PIN_VH - GRAY_AT;

/** 0 before the span, 1 after it, linear in between. */
export const ramp = (p: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (p - from) / (to - from));
