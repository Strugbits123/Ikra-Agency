"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import Logo from "./Logo";

// The footage behind the doors. /img/hero-bg.jpg stays underneath it as the base
// layer rather than being replaced, and this is fetched on an idle callback.
const BACKGROUND_VIDEO_SRC: string | null = "/video/waves.mp4";
/** How long to wait for an idle moment before fetching the footage anyway, in ms. */
const BACKGROUND_VIDEO_IDLE_TIMEOUT = 2500;
// How far the doors must be open before the footage is worth decoding. Just
// inside the ~0.28 where the overlapping panels first clear each other.
const BACKGROUND_VISIBLE_AT_DOOR = 0.25;

/**
 * Where the doors come to rest, as fractions of the viewport: they stop here
 * instead of leaving frame, parking as orange wedges in the bottom-left and
 * top-right corners. DOOR_REST_X is the one knob for how much orange stays.
 *
 * The panels are 58% wide each, so closed they overlap by 16% of the screen and
 * a gap only appears once doorP passes 8/29 ≈ 0.28 — "the doors are moving" and
 * "the doors are visibly opening" are different moments, and the lead line of
 * the copy grows on the second (see leadSeat).
 */
const DOOR_PANEL_W = 0.58;
const DOOR_REST_X = 0.29;
const DOOR_REST_Y = 0.73;

// Derived from the doors rather than restated, so the two cannot drift apart.
// Tucks 2px under each panel so no rounding can show a hairline between them.
const BAND_INSET = `calc(${((DOOR_PANEL_W - DOOR_REST_X) * 100).toFixed(2)}% - 2px)`;

/**
 * The clear span the doors leave between the wedges once they are at rest, as a
 * fraction of the viewport width.
 *
 * Not an independent number, and worth being explicit about because it reads
 * like one: a wedge is DOOR_PANEL_W − DOOR_REST_X wide and this is whatever the
 * two of them leave, so it is exactly 1 − 2·wedge. There is one degree of
 * freedom here, not two — widening the gap *is* shrinking the wedges, and
 * DOOR_REST_X is the only knob for either.
 */
const APERTURE = 1 - 2 * (DOOR_PANEL_W - DOOR_REST_X);

const WAVE_TEXT = "holding your business back";
// Non-breaking on purpose: SVG collapses runs of ordinary whitespace.
const WAVE_TEXT_GAP = "\u00a0\u00a0\u00a0";
/** How fast the copy travels right-to-left along the ribbon, in px per second. */
const MARQUEE_SPEED = 55;

/**
 * The rectangular hole in the orange: p=0 is fully open, p=1 is sealed. Driving
 * the window rather than the box's scale keeps the footage still. Horizontal
 * only — the hole holds its full height and narrows to nothing.
 */
const holeClip = (p: number) => {
  const edge = (p * 50).toFixed(3);
  return `inset(0% ${edge}% 0% ${edge}%)`;
};

/**
 * The timeline, in vh of actual scrolling through the pin. Written as a chain of
 * derivations rather than a list of numbers, so retiming any beat carries the
 * rest along instead of quietly opening a gap or an overlap.
 */

/**
 * The opening is half cued and half scrubbed, and which half is which is the
 * whole design of it.
 *
 * A scrubbed phase costs scroll to play. That is exactly right for the copy below
 * — a line arriving over 150vh cannot be hurried, which is the point of it — and
 * exactly wrong for the hole sealing, because a mouse wheel notch is about 100px,
 * i.e. ~11vh. That shrink was 110vh, then 28vh, and both read as "two or three
 * scrolls" for the same reason: no window a hole can visibly close across fits
 * inside one notch. Shortening it further only trades the wait for a flinch.
 *
 * So the first beat is a cue, on the same footing as the ribbon and the orange→gray
 * wash (see BAND_DRAW_AT, GRAY_AT): crossing it starts a move that runs to
 * completion on its own clock, costs no scroll distance, and cannot be left
 * half-done by stopping. One scroll, one finished beat.
 *
 * That cued move contains two things, in order: the hole seals, and then the doors
 * crack open to DOOR_AJAR. The crack belongs *inside* the cued move rather than
 * after it because it is the acknowledgement — the first scroll should visibly
 * start the doors, not just close the video.
 *
 * The rest of the doors' travel is then scrubbed, and that is a deliberate reversal
 * of an earlier attempt at a second cue. Two cues cannot be separated reliably by
 * distance: ScrollSmoother keeps delivering scroll for a second or more after the
 * gesture that started it has ended, so the tail of one flick crosses the next cue
 * on its own, and the doors continue from the crack to fully open with no input —
 * which reads, correctly, as a glitch. Any gap wide enough to defeat a hard swipe's
 * tail is also several notches of nothing for someone on a wheel.
 *
 * Scrubbing removes the problem rather than defending against it. The doors cannot
 * move without scroll, in either direction, because scroll position is the only
 * thing that says where they are — and it costs nothing in stall, because unlike
 * the shrink there is continuous motion on every notch of it. It also puts the lead
 * line's growth back under the visitor's hand, which is where most of it was
 * before any of this (see DOOR_SCRUB_VH).
 */

/**
 * Leg 1 of the cued move: the hole seals, and the headline fades with it.
 *
 * This is where the move is cued going *down*, and only going down. Where it is
 * cued coming back up is wherever it actually landed, which is a different mark
 * and has to be — see `cueAt`, which is where that is tracked and why.
 */
const SEAL_AT = 8;
const SEAL_SECONDS = 0.9;

/**
 * Leg 2 of the cued move: the doors crack open, in the same breath as the seal.
 *
 * DOOR_AJAR is how far "a little bit" is, as a fraction of the doors' full travel.
 * It has to clear DOOR_SEALED_AT (~0.276) to be visible at all — below that the
 * panels still overlap and the stage is unbroken orange — so 0.42 is really 0.2 of
 * the *aperture*, about 8% of the screen's width. Cracked open, unmistakably not
 * open.
 */
const DOOR_AJAR = 0.42;
const AJAR_SECONDS = 0.7;

/** The two ends of the cued move, as positions along it. */
const STOP_SHUT = 0;
const STOP_AJAR = SEAL_SECONDS + AJAR_SECONDS;
/**
 * Travelling back is quicker, for the same reason the gray wash's reverse is:
 * going back up, the visitor has already seen the beat and is looking for what was
 * before it.
 */
const OPENING_REVERSE_SPEED = 1.5;

/**
 * The doors' remaining travel, scrubbed: 70vh from here and they are at rest in
 * their corners.
 *
 * The lead line of the gap copy is not played *over* this — it *is* this (see
 * leadSeat), growing out of the point the panels part from and reaching full size
 * exactly as they stop. So the line grows a fifth of the way with the crack above,
 * and the remaining four fifths across these 70vh, under the visitor's hand.
 *
 * 70 is the compromise between two complaints, both of which have been made about
 * this same stretch. Too long and it is the shrink's problem again — several
 * scrolls to finish one beat. Too short and a single trackpad swipe covers all of
 * it, which is the "it happened by itself" complaint with the cause removed but
 * the feeling intact. At 70 a swipe gets most of the way and a wheel notch gets a
 * seventh, and — the part that matters and that the cued version could not offer —
 * *every* notch of it moves the doors. The old stall was never about length, it was
 * about scrolling and seeing nothing change.
 *
 * Being scrubbed does NOT on its own put the lead line's exit safely after the
 * growth, and it is worth recording why, because the note here used to claim it did.
 * A scrubbed leg with a *fixed* start would: it ends at a known vh and the exit goes
 * after it. This one's start is dynamic (below), so its end is too, and a flick that
 * arms it late pushes the doors' rest past an exit ramp written in absolute vh — the
 * lead line then begins to leave while it is still growing out of the aperture. The
 * copy sequence therefore measures from where the doors *actually* came to rest
 * rather than from DOOR_OPEN_END (see COPY_SQUEEZE_MAX).
 *
 * DOOR_OPEN_AT is where this *earliest* begins, not where it always begins, and the
 * difference is what stops the doors moving while the hole is still closing.
 *
 * A fixed start cannot do that. The seal is on a clock and this is on scroll, so a
 * single hard gesture reaches any fixed vh — 22, 40, anything a wheel user could
 * also reach in a few notches — long before a 0.9s seal has finished, and then the
 * two play at once. Widening the gap is the same losing argument as spacing the two
 * cues was.
 *
 * So the origin is the scroll position at which the cued move *landed*, floored at
 * DOOR_OPEN_AT (see `armVh`). Before it lands this leg contributes nothing at all,
 * which makes simultaneity structurally impossible rather than merely unlikely; at
 * the instant it lands the leg's own progress is exactly zero, so there is no step
 * in the doors' position however far the scroll had already run. Anyone scrolling at
 * an ordinary rate lands before 22vh and gets precisely the fixed window this used
 * to have — the floor is what keeps the common case unchanged.
 */
const DOOR_OPEN_AT = SEAL_AT + 14;
const DOOR_SCRUB_VH = 70;
/** Where the doors reach rest for anyone who did not flick past the cued move. */
const DOOR_OPEN_END = DOOR_OPEN_AT + DOOR_SCRUB_VH;

/** The doors stand at rest for a beat before the lead line begins to leave. */
const LEAD_HOLD_VH = 20;

/**
 * The copy after the doors.
 *
 * The lead line arrives *with* the doors and is already seated at full size when
 * they stop, so what these buy is scroll for the two lines behind it — which
 * used to share the door opening and now play out on the settled composition
 * instead, one at a time, with nothing else moving.
 *
 * These went up and have now come most of the way back down: the arrival 25 → 35 →
 * 48 → 70 → 150 → 95 → 45, the exit 19 → 45 → 90 → 60 → 30.
 *
 * Every widening was made against the same neighbour — the lead line's growth,
 * which was a 170vh scrubbed window sitting immediately before these three. Next to
 * that, anything under about 150 read as rushed, and it genuinely was: a beat is not
 * fast or slow in the abstract, it is fast or slow next to the beat before it. That
 * neighbour is now 0.7s of cued crack plus DOOR_SCRUB_VH — 70vh — of scroll, less
 * than half what it was.
 *
 * 45 is the size of one scroll gesture, and that is the whole of why it is 45: a
 * trackpad swipe covers most of a viewport height, so one swipe carries a line from
 * below the seat to settled in it and lets go as it arrives. The exit is two thirds
 * of that, because a line that is leaving has the eye's permission to go.
 *
 * This is knowingly *below* the floor the note here used to argue for — that a beat
 * has to outlast the gesture driving it or it reads as one event rather than as a
 * movement. That floor is real, and it was also the argument for five viewports of
 * scrolling to see out one thought; it loses to what happens on the page, which is
 * three short lines the visitor has finished reading long before the scroll releases
 * them. What carries the smoothness at this length is the ease rather than the
 * distance: `sine.inOut` starts and ends at zero velocity (see STACK_IN), so a 45vh
 * arrival still eases into the seat instead of stopping in it. Raise this pair if it
 * ever reads as a flicker rather than a move — nothing downstream needs touching
 * when they change, only the numbers quoted in the phase table above.
 *
 * Length alone was never enough on its own, though, and it is worth recording
 * why: with the old `power1` eases (see STACK_IN) a line was three quarters
 * arrived by the halfway point and travelling flat out at the instant it
 * vanished, whatever the windows were. Widening them lengthened the slow parts
 * and left the fast parts exactly as fast. The ease governs how this *feels*, the
 * window governs how long it lasts, and the end states below govern how much has
 * to happen in that time — all three matter, and only the third is a change to
 * how it looks.
 *
 * The exit stays shorter than the arrival, and deliberately: a line that is
 * leaving has the eye's permission to go, and one that is arriving does not.
 *
 * Lengthening it moves the whole tail of the sequence back, since COPY_STEP_VH
 * is built from it and BAND_DRAW_AT is built from where the copy ends. That is
 * the intended behaviour, not a side effect to be corrected for: the wave should
 * still wait for the copy to clear.
 */
const COPY_IN_VH = 45;
const COPY_HOLD_VH = 8;
const COPY_OUT_VH = 30;

/**
 * The lead line's exit, once the doors have stood at rest for a beat — and the
 * copy sequence's nominal origin, which is where it begins for anyone who did not
 * outrun the cued move.
 */
const LEAD_OUT_AT = DOOR_OPEN_END + LEAD_HOLD_VH;

/**
 * How far the copy sequence may be squeezed when it starts late.
 *
 * The lead line must not begin to leave until the doors are at rest, because it is
 * still growing out of the aperture until then and the two motions are the same
 * gesture; starting the exit early makes it break out of an opening that is still
 * opening. Its exit is therefore keyed to where the doors *actually* stopped, not
 * to DOOR_OPEN_END, which differs whenever a flick armed the scrubbed leg late
 * (see DOOR_OPEN_AT).
 *
 * Sliding the sequence back wholesale would push its tail into the ribbon's cue,
 * and the cues after it cannot move — PIN_VH is fixed at mount, so a shifted tail
 * would run off the end of the pin. So it is squeezed instead: the start moves and
 * COPY_END stays exactly where it is, which leaves every downstream beat untouched
 * at any scroll speed. Nothing happens at all in the ordinary case, where the
 * doors rest on schedule and the factor is 1.
 *
 * The cap is where the fixed tail wins. It holds the invariant for arming as late
 * as ~138vh, which is past any real gesture — ScrollSmoother is still easing toward
 * its target when the cued move lands, so the value here lags the flick that caused
 * it. Beyond that the sequence keeps its length and overlaps the tail of the
 * opening, because the alternative is a start past COPY_END and there is no honest
 * answer at that speed. It is harmless in any case: the lead line's growth is
 * carried through its exit rather than discarded at it (see leadSeat), so an early
 * exit is continuous, just early.
 *
 * Raising it costs nothing at any speed it already covers — the squeeze only
 * reaches its limit for someone who armed late enough to be clamped, and a
 * moderate flick lands nearer 1.2×.
 */
const COPY_SQUEEZE_MAX = 0.7;

/**
 * Each line rises as the one before it is halfway out — the overlap is what
 * makes a handover read as one unhurried gesture rather than a swap. It is the
 * same for all three: the lead line's *exit* is an ordinary exit, and only its
 * arrival is special.
 */
const COPY_STEP_VH = COPY_IN_VH + COPY_HOLD_VH + COPY_OUT_VH / 2;

type GapLine = {
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
 * The gap copy: three lines that each pass through the same centre seat, one at
 * a time. Words and timing are one table on purpose — they were two parallel
 * lists, which is an invitation to add a line without a window or retime a
 * window against the wrong words. A fourth line is `follower(text, 2)`.
 */
const GAP_LINES: GapLine[] = [
  {
    text: "growth creates a gap",
    in: null,
    out: [LEAD_OUT_AT, LEAD_OUT_AT + COPY_OUT_VH],
  },
  follower("between who you've become", 0),
  follower("how the world sees you", 1),
];

/** The stage is clear again: the last line has finished leaving. */
const COPY_END = GAP_LINES[GAP_LINES.length - 1].out[1];

/**
 * The ribbon's draw-in is the one thing here that is NOT scrubbed: crossing
 * either end of the span fires a timed tween that runs to completion, so
 * stopping mid-scroll can never leave half a wave on screen.
 *
 * BAND_LEAD_VH is dead scroll between the last line of copy clearing and the
 * wave starting, and it is what keeps the wave and the gap copy off each other's
 * screen. Because both tweens run on their own clock, a fast scroll can cross a
 * cue while one is still playing — and scrolling *up*, the close is racing the
 * last gap line back on. This margin is the guarantee, so it has to stay at
 * least as long as BAND_HIDE_SECONDS takes to scroll through.
 */
const BAND_LEAD_VH = 25;
const BAND_DRAW_AT = COPY_END + BAND_LEAD_VH;
const BAND_HOLD_VH = 60;
const BAND_CLOSE_AT = BAND_DRAW_AT + BAND_HOLD_VH;
const BAND_DRAW_SECONDS = 0.9;
const BAND_HIDE_SECONDS = 0.5;

// The closing line takes the space the ribbon just vacated. The 35vh gap past the
// ribbon's cue guarantees the wave has gone before the line arrives, since the
// close is a timed tween and the cue can be crossed at speed. Sized against
// BAND_HIDE_SECONDS, so it grows if the close is slowed further.
const LEAP_AT = BAND_CLOSE_AT + 35;
const LEAP_IN_VH = 32;
const LEAP_HOLD_VH = 38;

// The doors close as soon as the line has finished holding, retracing their
// opening exactly because they run on the same progress value scaled back to
// zero. Quicker than the opening, which had the gap copy to carry.
const DOOR_CLOSE_AT = LEAP_AT + LEAP_IN_VH + LEAP_HOLD_VH;
const DOOR_CLOSE_VH = 125;

// The doorP below which the panels overlap and the stage reads as unbroken
// orange: they are DOOR_PANEL_W wide each, so their 16% overlap covers the gap
// before they have finished travelling. Closing, that lands at 72% of the way.
const DOOR_SEALED_AT = (2 * DOOR_PANEL_W - 1) / (2 * DOOR_REST_X);

// The line leaves *with* the doors rather than before them, receding as the orange
// closes in (see leapSeat). Sized so its scale reaches zero exactly as the panels
// meet — past that it would be shrinking against a surface already sealed.
const LEAP_OUT_AT = DOOR_CLOSE_AT;
const LEAP_OUT_VH = DOOR_CLOSE_VH * (1 - DOOR_SEALED_AT);

/**
 * The instant the panels meet and the stage reads as one unbroken orange
 * surface. Derived, not picked: the panels are DOOR_PANEL_W wide each, so they
 * cover the screen well before they have finished travelling (DOOR_SEALED_AT),
 * and the closing line's recession is already sized to land exactly here — so
 * the two share one number by construction rather than by being kept in sync.
 */
const SEALED_AT = LEAP_OUT_AT + LEAP_OUT_VH;

/**
 * The stage turning over from orange to the next section's gray, in one move.
 *
 * Everything after SEALED_AT is door travel nobody can see — the panels are
 * still moving, but under a surface with no edges left in it — and that used to
 * leave ~60vh of flat orange with nothing happening on it. Stopping anywhere in
 * there read as the page having run out. This is that stretch spent on the one
 * transition it was always leading to instead.
 *
 * Not scrubbed, on the same footing as the ribbon (see BAND_DRAW_AT): crossing
 * the cue fires a timed tween that runs to completion on its own clock, so the
 * turn-over is one continuous move at one speed whatever the scroll that
 * triggered it happened to be doing — and no stopping place anywhere in the
 * section can leave the stage sitting half orange and half gray. Scrubbing it
 * made the wash a readout of scroll velocity instead of a transition.
 *
 * GRAY_LEAD_VH is sealed-orange scroll between the panels meeting and the cue,
 * and it exists for the *upward* pass: the fade-out and the doors parting are
 * otherwise both keyed to the same instant, so they would race. It only has to
 * outlast GRAY_HIDE_SECONDS, and it is forgiving if it ever doesn't — the panels
 * overlap by 16% of the screen, so just past the seal the gap they open is a
 * sliver rather than a reveal.
 */
const GRAY_LEAD_VH = 15;
const GRAY_AT = SEALED_AT + GRAY_LEAD_VH;
/**
 * Scroll the wash is given to play out in, before the pin's own hold begins.
 *
 * A guard against a fast scroll outrunning a timed tween, and nothing more — it
 * is not the wash's length, which is GRAY_SECONDS whatever is written here. So
 * every vh of it the wash does not use is a vh of blank gray screen, and that is
 * why it has come down from 35 to 6: past the wash there is nothing left on this
 * stage but flat gray, and the next section's statement cannot begin to come up
 * until this pin has released and its own top edge has appeared. Together with
 * HOLD_VH this is now the *whole* of the gap between the two, and it is meant to
 * be crossed rather than dwelt in.
 *
 * A wash that outruns it is not cut off — it is a tween on its own clock, so it
 * goes on running after the pin lets go and always plays in full. It simply
 * finishes off screen, underneath DefinitionSection's veil, which is opaque by
 * then and is the same --color-gray the wash is heading for; and that veil now
 * fades in across this same stretch, so the two ramp to gray together rather than
 * one handing over to the other. Nothing about the transition is lost by being
 * short of room here — only the flat gray that used to follow it.
 *
 * The pass back up is unaffected: the far shorter GRAY_HIDE_SECONDS is what has
 * to fit there, and GRAY_LEAD_VH is what gives it the room.
 */
const GRAY_HOLD_VH = 6;
const GRAY_SECONDS = 1.3;
const GRAY_HIDE_SECONDS = 0.55;

/**
 * Pinned screen past the last phase, where nothing scroll-driven moves.
 *
 * Short, and no longer meant as a beat of rest: it is flat gray with the doors
 * shut and the stage empty, which reads as the page having stopped rather than as
 * a pause. Four is a margin, not a hold — enough that the release cannot land on
 * the exact frame the wash is cued on, and no more.
 */
const HOLD_VH = 4;

/**
 * The pin plus the viewport the pinned stage occupies: the pin runs `top top` →
 * `bottom bottom`, so progress 0→1 covers `height − 100vh`.
 *
 * Measured from the wash and *not* from the door close, which is the one change
 * here that needs justifying, because it ends the pin with the panels only ~92%
 * of the way shut.
 *
 * They are shut. The panels are DOOR_PANEL_W wide each, so they cover the screen
 * at DOOR_SEALED_AT and everything past that is travel underneath a surface with
 * no edges left in it — the same fact GRAY_AT is placed on. Closing retraces the
 * opening, so the seal comes at 1 − DOOR_SEALED_AT of the close, about 72%: from
 * there to the end, ~19vh, every frame is the identical flat orange rectangle.
 *
 * That stretch was the actual wall in front of the hand-off. It is invisible here
 * and it was holding the pin open, so the next section stayed a screen and a half
 * below the fold with its statement in it, and no amount of retiming *there*
 * could reach past it. Dropping it is not a shortening of the door animation —
 * the doors move at exactly the speed they did, over exactly the scroll they did,
 * and every visible frame of the close is untouched. The travel simply stops
 * being waited on once it stops being visible.
 *
 * Which is asserted rather than assumed: the close must be past the seal by the
 * release, or the pin would end on a stage with a gap still open in it.
 */
const PIN_VH = GRAY_AT + GRAY_HOLD_VH + HOLD_VH;
const SECTION_VH = PIN_VH + 100;

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
 * The hand-off, published for DefinitionSection — one number, which is how much
 * pinned scroll is left at the moment this stage begins turning gray.
 *
 * That section places both of its hand-off cues against it: its veil's dissolve
 * and its statement's reveal both run across exactly this stretch, so the wash,
 * the dissolve and the text arriving all start on the same instant by
 * construction rather than by three constants being kept in step. It used to
 * carry a copy of HOLD_VH for the veil instead, which was only correct until one
 * of the two moved — and both have now moved twice.
 */
export const HERO_GRAY_TAIL_VH = PIN_VH - GRAY_AT;

/** 0 before the span, 1 after it, linear in between. */
const ramp = (p: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (p - from) / (to - from));

/**
 * The gap copy shares one seat at the centre of the stage. The two ends of that
 * travel are deliberately not mirror images: a line settles into the seat from
 * just below, barely smaller and barely soft, and leaves by climbing further
 * away while shrinking and blurring out.
 *
 * Every line *leaves* that way, the lead line included. It is only the arrival
 * the lead line does differently — it grows into the seat with the doors instead
 * (see leadSeat).
 *
 * `y` is a fraction of the viewport height, not of the element, so every line
 * travels the same distance despite them not being the same height.
 *
 * Both eases are `sine.inOut`, and both used to be a `power1` half-curve pointing
 * the wrong way for how this reads:
 *
 *   STACK_IN was `power1.out`, which leaves at *twice* the average rate and then
 *   creeps. A line was three quarters arrived by the halfway mark, so it lunged
 *   out of nothing and crawled the rest — and widening the window only made the
 *   crawl longer, never the lunge gentler.
 *
 *   STACK_OUT was `power1.in`, the same fault mirrored: it *ends* at twice the
 *   average rate, so a line left by accelerating and was travelling flat out at
 *   the moment it vanished. Worse than the arrival, in fact, because the exit
 *   covers half again as much distance (0.12 of the viewport against 0.08) and
 *   three times as much scale, and had a fifth of the scroll to do it in.
 *
 * `sine.inOut` starts and ends at zero velocity, so a line eases out of rest,
 * crosses at a peak of only 1.57× the average, and settles — at both ends of the
 * seat and in both directions. The deceleration into the seat that `power1.out`
 * had is kept; what is added is that nothing is ever already at full speed.
 *
 * The asymmetry that matters is untouched, because it was never in the eases: it
 * is in the end states below — a line arrives from just below, barely smaller and
 * barely soft, and leaves further, smaller and properly blurred.
 *
 * Those end states are the third lever on how fast this reads, and the only one
 * that is a change to how it *looks* rather than to its pace — which is why the
 * exit's were the last thing touched and not the first. They had to be: an exit
 * covers more ground than an arrival in every term at once, so at equal rates it
 * needs proportionally more scroll, and the scale term was the outlier. Collapsing
 * to 0.45 is nearly three times the arrival's 0.82 → 1, so even after the exit
 * window was doubled to 90vh it was still changing size about five times faster
 * than an arriving line — one term running away with the whole gesture. At 0.70,
 * with the blur eased back to match, every term of the exit lands in a 2.2–2.8×
 * band against the arrival: uniformly a little quicker, which is what an exit
 * should be, rather than one thing lurching.
 */
const STACK_IN_END = { y: 0.08, scale: 0.82, blur: 3 };
const STACK_OUT_END = { y: -0.12, scale: 0.7, blur: 4 };
const STACK_IN = gsap.parseEase("sine.inOut");
const STACK_OUT = gsap.parseEase("sine.inOut");

/**
 * How much of the lead line's growth is spent fading up. It grows out of a
 * literal point, so without this it arrives as a speck on the orange; a fade
 * across the first slice of the growth resolves it out of the surface instead.
 * 0.18 of the growth is ~30vh, i.e. one ordinary arrival's worth of scroll.
 */
const GROW_FADE = 0.18;

/**
 * One line's state in that seat. `away` is the single travel axis — 1 waiting
 * below, 0 seated, −1 gone above — and its sign picks which end is being
 * travelled to, which is the only place the arriving/leaving asymmetry lives.
 *
 * The −50s are folded into xPercent/yPercent because driving either at all would
 * overwrite a class-based translate, so GSAP has to own both halves.
 */
function stackSeat(viewportH: number, inP: number, outP: number) {
  const away = 1 - inP - outP;
  const seated = 1 - Math.abs(away);
  const end = away > 0 ? STACK_IN_END : STACK_OUT_END;
  const blur = end.blur * (1 - seated);
  return {
    xPercent: -50,
    yPercent: -50,
    y: end.y * viewportH * Math.abs(away),
    scale: gsap.utils.interpolate(end.scale, 1, seated),
    opacity: seated,
    // Dropped entirely once seated rather than left at blur(0): any filter at
    // all costs subpixel antialiasing for the whole time the copy is readable.
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

/**
 * The lead line's seat. It grows out of the point the doors part from, on the
 * *aperture's* progress rather than a window of its own, so the two are one
 * gesture and land together by construction rather than by being kept in step.
 *
 * That progress is deliberately unaeased. The panels travel linearly, so the gap
 * between them widens linearly, and the line's rendered width is linear in
 * `growP` — which means the copy fills the same fraction of the opening at every
 * frame, and reaches full size on the frame the panels stop. Any ease here would
 * put the text ahead of or behind the doors, which is the one thing this is for.
 *
 * Only the arrival is written here: the exit is an ordinary one, stackSeat's,
 * from fully seated. The two meet exactly — growth finished with outP 0 is
 * scale 1, y 0, opacity 1 and no filter in both — so the handover is a
 * continuation rather than a switch.
 *
 * `growP` is multiplied into that exit rather than dropped at it, and the reason is
 * a glitch this had: handing straight to `stackSeat(viewportH, 1, outP)` asserts
 * the line is fully grown, so if the exit ever began early the line snapped out to
 * full size in one frame and then climbed away — it appeared to burst out of a gap
 * that was still opening. The copy's origin now makes an early exit almost
 * unreachable (see COPY_SQUEEZE_MAX), which is the actual fix; this is the backstop
 * that keeps the seam continuous rather than merely unlikely to be seen, and it
 * costs a multiply by 1 in every ordinary frame.
 */
function leadSeat(viewportH: number, growP: number, outP: number) {
  if (outP > 0) {
    const seat = stackSeat(viewportH, 1, outP);
    return { ...seat, scale: seat.scale * growP };
  }
  return {
    xPercent: -50,
    yPercent: -50,
    y: 0,
    scale: growP,
    opacity: gsap.utils.clamp(0, 1, growP / GROW_FADE),
    // No blur on this arrival, unlike the others': theirs is carried for a 35vh
    // beat, this one would be carried for the whole door opening, and a filter
    // costs subpixel antialiasing for every frame it is on.
    filter: "none",
  };
}

/**
 * The closing line's own seat. It arrives exactly as the gap copy does — fading
 * up from just below the seat, barely smaller — but it leaves by *receding*: the
 * opacity holds at 1 and the scale runs all the way to zero, with no rise and no
 * blur, so it reads as being drawn back through the gap the doors are closing
 * rather than dissolving where it stands.
 *
 * The recession has to be linear in the raw scroll ramp, which is why this cannot
 * reuse STACK_OUT (power1.in): the line is as wide as the gap it sits in, and the
 * panels are closing on it at a known rate, so anything that shrinks slower than
 * linear leaves its ends hanging over the orange. That matters more than it
 * sounds — `text-accent` is the panels' own colour, so those words would vanish
 * against them while the ink half stayed visible, at full opacity now that
 * nothing fades. Linear beats the panels everywhere: the line's width falls by
 * 0.42·p of the viewport against the gap's 0.30·p, so it is inside the gap for
 * every frame of the close and reaches nothing exactly as they meet.
 */
function leapSeat(viewportH: number, inP: number, outP: number) {
  const arriving = 1 - inP;
  const blur = STACK_IN_END.blur * arriving;
  return {
    xPercent: -50,
    yPercent: -50,
    y: STACK_IN_END.y * viewportH * arriving,
    scale: gsap.utils.interpolate(STACK_IN_END.scale, 1, inP) * (1 - outP),
    opacity: inP,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : "none",
  };
}

/**
 * The ribbon draws in and closes in the same direction, right-to-left, which
 * pinches the clip at opposite ends — so a closed ribbon is parked at the wrong
 * end to open from and has to be moved back first (see `drawBand`).
 */
const BAND_CLIP_UNDRAWN = "inset(0% 0% 0% 100%)";
const BAND_CLIP_FULL = "inset(0% 0% 0% 0%)";
const BAND_CLIP_CLOSED = "inset(0% 100% 0% 0%)";

/** Gap between the ribbon's box and the closing line beneath it, in px. */
const LEAP_GAP = 56;
/** Cubics emitted per half wave. Three tracks a sine to well under a pixel. */
const SAMPLES_PER_HUMP = 3;

/**
 * Everything about the ribbon, derived from the stage it sits on.
 *
 * Both ends must land exactly on the door wedges' inner corners. That works
 * because the centre line is a straight baseline between those two anchor points
 * plus a sine: sin() is zero at both ends for any whole number of half waves, so
 * amplitude and hump count are free to be tuned without reopening a gap.
 */
function bandGeometry(stageW: number, stageH: number) {
  // Matches BAND_INSET, so the ribbon tucks 2px under each wedge horizontally.
  const inset = (DOOR_PANEL_W - DOOR_REST_X) * stageW - 2;
  const width = stageW - inset * 2;

  // The wedges' horizontal edges. The left wedge exists only *below* its top
  // edge and the right only *above* its bottom edge, which is why the ends have
  // to be pinned rather than merely overlapped.
  const leftEdge = (DOOR_REST_Y - 0.25) * stageH;
  const rightEdge = (1.25 - DOOR_REST_Y) * stageH;

  // Scales faster than the span, so the copy inside doesn't shrink with it.
  const thickness = gsap.utils.clamp(44, 76, width * 0.072);
  const fontSize = thickness * 0.55;
  // Half waves across the span. Must stay a whole number — that is what puts
  // sin() at exactly zero on both ends and pins the ribbon to the wedges.
  const humps = Math.round(gsap.utils.clamp(3, 8, width / 165));

  // Offset half a thickness inward so it is the ribbon *edges* that meet the
  // wedge corners.
  const startY = leftEdge + thickness / 2;
  const endY = rightEdge - thickness / 2;
  const slope = (endY - startY) / width;

  // Held to 15–25px for a gentle wave. The second term is a safety ceiling:
  // glyphs rotate with the path, so past roughly 40° they push out through the
  // ribbon's edges. It only binds on a narrow phone span.
  const amplitude = Math.min(
    gsap.utils.clamp(15, 25, thickness * 0.42),
    (Math.max(0, 0.85 - Math.abs(slope)) * width) / (humps * Math.PI),
  );

  // Solved, not sampled. The baseline tilts, so the extremes are not
  // `min/max(startY, endY) ± amplitude`: c'(x) = slope − A·ω·cos(ωx), so the
  // turning points are wherever cos(ωx) = slope/(A·ω). A sampled scan
  // undershoots by a fraction of a pixel and clips the sharpest crest.
  const omega = (humps * Math.PI) / width;
  const centreAt = (x: number) =>
    startY + slope * x - amplitude * Math.sin(omega * x);
  const turningPoints = [0, width];
  const ratio = amplitude * omega === 0 ? 2 : slope / (amplitude * omega);
  if (Math.abs(ratio) <= 1) {
    const base = Math.acos(ratio);
    for (const phase of [base, -base]) {
      for (let n = 0; n <= humps + 1; n++) {
        const x = (phase + 2 * Math.PI * n) / omega;
        if (x > width) break;
        if (x >= 0) turningPoints.push(x);
      }
    }
  }
  const centres = turningPoints.map(centreAt);
  const top = Math.min(...centres) - thickness / 2;
  const bottom = Math.max(...centres) + thickness / 2;

  if (process.env.NODE_ENV !== "production") {
    // The end-alignment guarantee, asserted rather than trusted — otherwise a
    // break surfaces as a hairline notch at only some viewport sizes.
    const endsOnAxis = Math.abs(Math.sin(omega * width)) < 1e-9;
    const leftFlush = Math.abs(centreAt(0) - thickness / 2 - leftEdge) < 1e-6;
    const rightFlush =
      Math.abs(centreAt(width) + thickness / 2 - rightEdge) < 1e-6;
    if (!endsOnAxis || !leftFlush || !rightFlush) {
      console.error(
        "[HeroNarrative] the ribbon's ends no longer meet the door wedges. " +
        "`humps` must stay a whole number, and startY/endY must stay derived " +
        "from the wedge edges.",
        { humps, endsOnAxis, leftFlush, rightFlush },
      );
    }
  }

  return {
    inset,
    width,
    thickness,
    fontSize,
    humps,
    amplitude,
    slope,
    startY,
    endY,
    top,
    height: bottom - top,
    // Drops the baseline so the copy's visual mass rides the wave. Done in the
    // path to avoid `dy` on a textPath, which browsers disagree about.
    baselineShift: fontSize * 0.3,
  };
}

type BandGeometry = ReturnType<typeof bandGeometry>;

/** The centre line at x, in the band's own coordinates. */
function waveY(g: BandGeometry, x: number) {
  return (
    g.startY -
    g.top +
    g.slope * x -
    g.amplitude * Math.sin((g.humps * Math.PI * x) / g.width)
  );
}

/** dy/dx of the same, so each emitted cubic gets the exact tangent. */
function waveSlope(g: BandGeometry, x: number) {
  return (
    g.slope -
    ((g.amplitude * g.humps * Math.PI) / g.width) *
    Math.cos((g.humps * Math.PI * x) / g.width)
  );
}

/**
 * One traversal of the wave as Hermite-matched cubics. `yOffset` shifts the whole
 * run, which is how both edges come from a single wave, and `reverse` retraces
 * the *same* curve so the edges stay parallel and the thickness stays constant.
 */
function waveRun(g: BandGeometry, yOffset: number, reverse: boolean) {
  const n = g.humps * SAMPLES_PER_HUMP;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = ((reverse ? n - i : i) / n) * g.width;
    const x1 = ((reverse ? n - i - 1 : i + 1) / n) * g.width;
    // Hermite → Bézier: control points a third of the run along each tangent.
    const d = (x1 - x0) / 3;
    parts.push(
      `C ${x0 + d} ${waveY(g, x0) + yOffset + waveSlope(g, x0) * d} ${x1 - d} ${waveY(g, x1) + yOffset - waveSlope(g, x1) * d} ${x1} ${waveY(g, x1) + yOffset}`,
    );
  }
  return parts.join(" ");
}

/** The invisible line the copy rides along. */
const bandTextPath = (g: BandGeometry) =>
  `M 0 ${waveY(g, 0) + g.baselineShift} ${waveRun(g, g.baselineShift, false)}`;

/** The ribbon: the same wave offset up and down by half its thickness. */
const bandOutlinePath = (g: BandGeometry) => {
  const half = g.thickness / 2;
  return [
    `M 0 ${waveY(g, 0) - half}`,
    waveRun(g, -half, false),
    `L ${g.width} ${waveY(g, g.width) + half}`,
    waveRun(g, half, true),
    "Z",
  ].join(" ");
};

/**
 * Slim orange ribbon spanning the gap between the doors, with the copy
 * marqueeing right-to-left along its wave forever.
 *
 * The copy rides an SVG textPath rather than positioned spans, which is what
 * tilts each character tangent to the wave and makes containment structural: a
 * glyph past either end simply isn't rendered.
 */
function WavyBand({ g, animate }: { g: BandGeometry; animate: boolean }) {
  const textPathRef = useRef<SVGTextPathElement>(null);
  // Sanitised: useId's output contains colons, awkward in a URL fragment.
  const pathId = `band-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Enough repetitions to overfill the path, so copy is still arriving at the
  // right-hand end after a full repetition has scrolled off the left.
  const repeats = Math.max(
    2,
    Math.ceil(g.width / (WAVE_TEXT.length * g.fontSize * 0.55)) + 2,
  );

  useEffect(() => {
    const textPath = textPathRef.current;
    if (!animate || !textPath || !repeats) return;

    let tween: ReturnType<typeof gsap.to> | null = null;
    let cancelled = false;

    // Measure only once the webfont has settled: a fallback-font measurement
    // makes the loop length wrong and puts a visible jump in every repeat.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const oneRepeat = textPath.getComputedTextLength() / repeats;
      if (!oneRepeat) return;
      // Shifting by exactly one repetition lands on an identical-looking frame,
      // so a plain linear repeat loops seamlessly instead of snapping back.
      tween = gsap.to(textPath, {
        attr: { startOffset: -oneRepeat },
        duration: oneRepeat / MARQUEE_SPEED,
        ease: "none",
        repeat: -1,
      });
    });

    return () => {
      cancelled = true;
      tween?.revert();
    };
  }, [animate, repeats, g.width, g.fontSize]);

  return (
    <>
      {/* The copy is repeated to fill the ribbon, so it is announced once here
          and the drawing itself is hidden from assistive tech. */}
      <span className="sr-only">{WAVE_TEXT}</span>
      <svg
        aria-hidden
        className="block w-full"
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <path id={pathId} d={bandTextPath(g)} fill="none" />
        </defs>
        <path d={bandOutlinePath(g)} fill="var(--color-accent)" />
        <text fill="#ffffff" fontSize={g.fontSize} fontWeight={500}>
          <textPath ref={textPathRef} href={`#${pathId}`} startOffset={0}>
            {`${WAVE_TEXT}${WAVE_TEXT_GAP}`.repeat(repeats)}
          </textPath>
        </text>
      </svg>
    </>
  );
}

/**
 * How many ems wide the lead line is. Measured, not guessed: summing the advance
 * widths in public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf, with the
 * HVAR deltas applied for weight 500 — `font-medium`, which is what this
 * actually renders at, and 1.4% wider than the font's default 400 instance —
 * gives 10.791em for "growth creates a gap". Kerning only ever subtracts, so
 * taking the advance sum as the width errs in the safe direction. Re-measure if
 * the wording changes.
 */
const GAP_LEAD_EMS = 10.8;

/**
 * Clearance between the lead line's ends and the wedges' inner edges, as a share
 * of the aperture on each side.
 *
 * A share rather than a pixel count on purpose. The line's width and the gap's
 * width are both linear in the growth's progress (see leadSeat), so a
 * proportional margin is the *same* margin at every frame — the copy sits inside
 * the opening from the moment it appears, not merely once the doors have
 * stopped.
 */
const GAP_COPY_INSET = 0.07;

/**
 * The gap copy's size, solved from the span it has to sit in rather than
 * declared — for exactly the reason the closing line's is (see LEAP_EMS). The
 * aperture is a fraction of the viewport and a declared size is not, so any
 * fixed size is only right at one width: a flat `md:text-[60px]` is 647px of
 * line against a 605px gap at 1440 and a 430px gap at 1024, which put the ends
 * on the orange at every laptop size there is.
 *
 * The ceiling is that same 60px, so the widest screens are unchanged; the floor
 * is the old mobile size, so phones are unchanged too. Between them — roughly
 * 700px to 1200px — the floor binds and the line still overhangs, because the
 * gap is simply too narrow for this many words at a readable size. That is the
 * same concession LEAP_EMS's clamp already makes, in the same place.
 *
 * Solved from the *lead* line alone, not the longest of the three. It is the one
 * locked to the aperture, so it is the one whose fit is read frame by frame;
 * sizing to "between who you've become" instead would put the whole statement at
 * ~35px on a 1440 screen. The other two still cross onto the wedges as they
 * always have, but by far less, since they shrink along with it.
 */
const GAP_COPY_MIN_PX = 40;
const GAP_COPY_MAX_PX = 60;
const gapCopyFontSize = (stageW: number) =>
  gsap.utils.clamp(
    GAP_COPY_MIN_PX,
    GAP_COPY_MAX_PX,
    (APERTURE * stageW * (1 - 2 * GAP_COPY_INSET)) / GAP_LEAD_EMS,
  );

/**
 * `overlay` stacks every line in the same seat at the centre of the stage, so
 * each takes the last one's place rather than sitting beneath it. Positioning is
 * left entirely to GSAP (see `stackSeat`), which drives `yPercent` and would
 * overwrite any translate-based centring from the classes.
 *
 * Without it they stack in normal flow, which is the reduced-motion rendering:
 * no GSAP touches them there, so nothing may depend on a transform being
 * written — hence the flow-only `mt-5` between them.
 *
 * `lineRefs` is filled in line order, so index `i` here is index `i` in
 * GAP_LINES and the element being driven always matches the window driving it.
 */
function GapCopy({
  overlay = false,
  fontSize,
  lineRefs,
}: {
  overlay?: boolean;
  fontSize?: number;
  lineRefs?: { current: (HTMLParagraphElement | null)[] };
}) {
  // One class string for all of them: they are parts of one statement in the
  // same seat, so any difference in size or weight reads as a replacement rather
  // than the sentence carrying on. That is why the solved size below is shared
  // by all three even though only the lead line's fit is what solves it — a line
  // arriving at a different size than the one it replaces is the exact seam this
  // avoids. The max-width only fixes where the longest line wraps; GSAP centres
  // on the element's own width, so it stays centred.
  //
  // The class-based sizes are the reduced-motion rendering only: there the copy
  // is a static column at the top of the stage rather than seated in the gap, so
  // there is no span to solve it against.
  const line = `w-full max-w-[1500px] leading-[1.15] font-medium text-ink ${fontSize === undefined ? "text-[40px] md:text-[60px]" : ""
    }`;
  const seat = overlay
    ? "absolute top-1/2 left-1/2 px-8 text-center"
    : "";
  return (
    <>
      {GAP_LINES.map(({ text }, i) => (
        <p
          key={text}
          ref={
            lineRefs
              ? (el) => {
                lineRefs.current[i] = el;
              }
              : undefined
          }
          className={`${seat} ${overlay || i === 0 ? "" : "mt-5"} ${line}`}
          style={fontSize === undefined ? undefined : { fontSize }}
        >
          {text}
        </p>
      ))}
    </>
  );
}

// How many ems wide the closing line is, so its size can be solved from the span
// between the wedges rather than picked — widen the wedges and the line shrinks
// to suit.
//
// Not a guess: summing the advance widths in
// public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf gives 4.494em for
// "until you " and 7.009em for "make the leap", so 11.50em at weight 400. The
// bold run renders at 700 and the font ships HVAR, so its advances are wider
// than that — 14 leaves room for the bold run being up to ~12% wider *and* still
// clears the span at every width from 768px up. Keep it above ~12.4 if the
// wording changes.
const LEAP_EMS = 14;

// `whitespace-nowrap` because the size is solved for this width; wrapping would
// only ever mean the fit is wrong.
//
// Deliberately carries NO font-size of its own. It used to say
// `text-3xl md:text-[60px]`, which silently overrode the size the container
// solves and pinned the line to a flat 60px — 741px wide, against a span that is
// 609px at 1440 and 542px at 1280, so the ends sat on top of the wedges on every
// laptop. `text-accent` words over accent-coloured orange simply disappear, which
// is why the overlap has to be structurally impossible rather than merely
// unlikely: the only size here is the one derived from the span (see LEAP_EMS).
const LEAP_COPY = (
  <p className="leading-[1.3] font-normal whitespace-nowrap text-ink">
    until you <span className="font-bold text-accent">make the leap</span>
  </p>
);

/**
 * One continuous pinned sequence — one stage, one ScrollTrigger, so scrolling back
 * up reverses every phase.
 *
 * Mostly scrubbed, but not entirely, and the exceptions are the point of the
 * opening: four beats here are *cues* rather than windows. Crossing one starts a
 * move that plays to completion on its own clock, so it costs no scroll distance,
 * cannot be left half-finished by stopping, and runs at the same speed however
 * fast the wheel was turned. Those four are the two stops of the opening, the
 * ribbon, and the orange→gray wash — marked "(cue)" below. Everything else is
 * driven directly by scroll position and is written as a span.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH):
 *       8vh    (cue) one continuous 1.6s move with two things in it, and the whole
 *              of the first scroll. First the rectangular hole the footage is seen
 *              through seals, over 0.9s — the footage never moves or resizes, and
 *              the headline fades on the same driver so it is gone at the instant
 *              the hole shuts. Then, immediately, the doors crack open over 0.7s:
 *              diagonally (right up-and-right, left down-and-left) and only a fifth
 *              of the way, to about 8% of the screen's width (see DOOR_AJAR). 8vh
 *              is under one wheel notch, so one scroll buys the pair of them.
 *   22–92vh    the doors travel the rest of the way and stop partway across the
 *              screen, leaving wedges in the bottom-left and top-right corners for
 *              good. Scrubbed, unlike the crack that precedes it: it moves when the
 *              visitor scrolls and never otherwise, which is the one thing a second
 *              cue could not promise. These two numbers are where it runs for anyone
 *              scrolling at an ordinary rate; flick hard enough to outrun the 1.6s
 *              above and the whole 70vh shifts out to start wherever that move
 *              landed, so the doors still cannot part before the hole is shut (see
 *              DOOR_SCRUB_VH). "growth creates a gap" is
 *              not played over the opening — it *is* the opening, growing out of the
 *              centre point the panels part from with its width locked to the gap's
 *              in constant proportion, so it reads as being pushed open by them
 *              (see leadSeat). It therefore grows a fifth of the way with the crack
 *              above and the remaining four fifths here, resolving out of the orange
 *              rather than arriving as a speck, and reaching full size on the frame
 *              the panels stop.
 *   92–112vh   the line holds at full size, doors at rest, nothing else moving.
 *  112–142vh   it climbs away, shrinking and blurring out — an ordinary exit. This
 *              and the two lines below it are the numbers for anyone who did not
 *              outrun the cued move; the whole copy sequence measures from where
 *              the doors actually stopped, so the lead line cannot begin to leave
 *              an aperture that is still opening (see COPY_SQUEEZE_MAX).
 *  127–172vh   "between who you've become" rises into the seat as the lead line
 *              leaves it; the overlap is what makes an exchange one gesture
 *              rather than a swap. 45vh of arrival — about one scroll gesture,
 *              which is the whole of why it is 45 (COPY_IN_VH).
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
 *              never fading, reaching zero exactly as the panels meet (~559vh), so
 *              it goes back through the gap rather than dissolving. The pin now
 *              releases at 583.5, ~92% of the way through it — see PIN_VH. Every
 *              frame from ~559 on is the same flat orange rectangle, so nothing
 *              of this is lost; the section simply stops waiting on it.
 *     ~559vh   the panels meet: from here the stage is one unbroken orange
 *              surface and the rest of their travel has no visible edges in it.
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
 *              There is no flat-gray hold left between the two: it was ~50vh of
 *              this section's tail, and holding onto it is what made the reader
 *              wait on an empty screen for the text.
 *
 * Then DefinitionSection takes over. Its own gradient strip still covers this
 * seam and is left in place, but it now has nothing to do: it fades gray over
 * gray, and is only still worth keeping as cover if these timings ever move.
 *
 * Layering (back to front): the background still with the footage over it, the
 * wavy band, the doors, the hero copy, the gray wash, then the header. The band
 * sits *under* the doors deliberately — both are the same orange, but it means a
 * ribbon caught mid-close is swallowed by the returning panels instead of
 * floating over them. The wash sits over the copy and under the header for the
 * same kind of reason: everything it covers is already gone by the time it
 * arrives, and the one thing that isn't is the wordmark.
 */
export default function HeroNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gapLineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const wavyRef = useRef<HTMLDivElement>(null);
  const leapRef = useRef<HTMLDivElement>(null);
  const grayRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const bgCoveredRef = useRef(false);
  const clipVideoRef = useRef<HTMLVideoElement>(null);
  const clipSealedRef = useRef(false);
  const introDoneRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Null until the browser has a spare moment (see the effect below);
  // `bgPlaying` then fades the footage over the still once it has frames.
  const [bgSrc, setBgSrc] = useState<string | null>(null);
  const [bgPlaying, setBgPlaying] = useState(false);
  // The ribbon is pinned to the wedges' corners, so it needs both axes of the
  // stage's real size, not just its width.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setStageBox({ w: el.offsetWidth, h: el.offsetHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const band =
    stageBox.w > 0 && stageBox.h > 0
      ? bandGeometry(stageBox.w, stageBox.h)
      : null;

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setMounted(true);
  }, []);

  /**
   * Fetch the background footage once the browser is idle. Nothing behind the
   * doors is visible until ~1.3s after the *first* cue at 8vh — the panels are 58%
   * wide each, so they still overlap for the whole seal and most of the crack — so
   * loading it with the page would only put several megabytes up against the assets
   * that are actually on screen.
   *
   * That head start used to be nearly 190vh of scrolling and is now a couple of
   * wheel notches, since the opening is on cues rather than windows. It is still
   * the right call: this is an idle *fetch*, the play/pause gate in paintStage is
   * keyed to the doors independently of it, and the still underneath is the
   * fallback for every case where the frames are not there yet — so arriving late
   * costs a beat of a static image, not a gap.
   *
   * Skipped under reduced motion, where the doors start parked open and
   * autoplaying footage would be unrequested motion on arrival.
   */
  useEffect(() => {
    if (!mounted || reducedMotion || !BACKGROUND_VIDEO_SRC) return;
    const start = () => setBgSrc(BACKGROUND_VIDEO_SRC);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, {
        timeout: BACKGROUND_VIDEO_IDLE_TIMEOUT,
      });
      return () => window.cancelIdleCallback(id);
    }
    // Safari has no requestIdleCallback; a plain timeout is close enough for
    // something with this much slack.
    const id = window.setTimeout(start, 1200);
    return () => window.clearTimeout(id);
  }, [mounted, reducedMotion]);

  // Load sequence (plays once, not scroll-driven): the hole opens up over the
  // footage, then the headline fades in.
  useEffect(() => {
    if (!mounted) return;
    const box = videoBoxRef.current;
    const headline = headlineRef.current;
    const logo = logoRef.current;
    if (!box || !headline || !logo) return;

    if (reducedMotion) {
      // No ScrollTrigger runs in this mode, so only the clip and the hero
      // headline — which exist purely to be animated — are hidden here. The
      // centre copy renders as a plain static column instead (see the JSX).
      // The logo stays visible: it's the page header, not an animated aside.
      // It renders hidden because nothing knows which mode this is until after
      // mount, so showing it is this branch's job — there is no load timeline
      // here to do it.
      gsap.set(logo, { opacity: 1 });
      gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0 });
      gsap.set(box, { opacity: 0 });
      introDoneRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      // The clip window starts fully *open* and is not animated here — only
      // opacity is, exactly as for the logo below. This used to animate the
      // hole shut→open, and that reveal is what made the footage read as
      // arriving abruptly no matter how the opacity was tuned: a mask edge
      // travelling across the picture is a wipe, and a wipe cannot be eased
      // into a fade. The hole is the scroll phase's to drive (see Phase 1),
      // which already expects it fully open at scroll 0.
      //
      // Neither of these touches a transform, so the Tailwind translate
      // classes keep doing the centering untouched.
      gsap.set(box, { clipPath: holeClip(0), opacity: 0 });
      // The header logo, same treatment. The markup already starts it hidden;
      // this only restates it, so `ctx.revert()` has a value to put back and
      // the timeline below has an explicit floor to fade up from. Hiding it
      // *here alone* was the bug: this effect is gated on `mounted`, so it
      // cannot run until the wordmark has already been painted opaque.
      gsap.set(logo, { opacity: 0 });
      // GSAP owns the headline's centring and the classes deliberately don't:
      // the first transform GSAP writes replaces the whole inline transform, so
      // a class-based `-translate-y-1/2` would be wiped the instant `y` is
      // touched, dropping the line half its height as it fades in.
      gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0, y: 16 });

      let cancelled = false;
      // Held until the webfont has settled. `display: swap` means the first
      // paint is in the fallback face, and fading in across that metrics change
      // is the other half of the flicker. Waiting costs a few ms and the swap
      // happens while the headline is still fully transparent.
      document.fonts.ready.then(() => {
        if (cancelled) return;
        ctx.add(() => {
          // Three plain opacity fades on absolute start times. The footage gets
          // the same treatment as the logo — nothing but opacity, on the same
          // ease — just over a slightly longer run, since it is a far larger
          // area of the screen to resolve.
          gsap
            .timeline({
              delay: 0.2,
              onComplete: () => {
                introDoneRef.current = true;
              },
            })
            .to(box, { opacity: 1, duration: 1.1, ease: "power2.out" }, 0)
            .to(logo, { opacity: 1, duration: 0.8, ease: "power2.out" }, 0.1)
            .to(
              headline,
              { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
              0.5,
            );
        });
      });

      return () => {
        cancelled = true;
      };
    });

    return () => ctx.revert();
  }, [reducedMotion, mounted]);

  // The single scroll-driven sequence covering every phase above.
  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const box = videoBoxRef.current;
    if (!section || !box) return;

    const ctx = gsap.context(() => {
      // The ribbon's draw-in, kept off the scrub entirely (see BAND_DRAW_AT).
      // `shown` is the latched state, so crossing the cue fires the tween once
      // rather than restarting it on every scroll event past it.
      let shown = false;
      let bandTween: gsap.core.Tween | null = null;
      function drawBand(show: boolean) {
        const el = wavyRef.current;
        // Bailing before the latch flips matters: the ribbon only mounts once
        // the stage has been measured, so an early cue is retried, not swallowed.
        if (!el || show === shown) return;
        shown = show;
        const midFlight = bandTween?.isActive() ?? false;
        bandTween?.kill();
        // A finished close leaves the clip pinched at the opposite end from
        // undrawn (see BAND_CLIP_*), so it has to be moved back before it can
        // draw again — safe only because nothing is on screen then. `midFlight`
        // catches a close still running, where the draw instead reverses out of
        // wherever it got to.
        if (show && !midFlight) gsap.set(el, { clipPath: BAND_CLIP_UNDRAWN });
        bandTween = gsap.to(el, {
          clipPath: show ? BAND_CLIP_FULL : BAND_CLIP_CLOSED,
          duration: show ? BAND_DRAW_SECONDS : BAND_HIDE_SECONDS,
          ease: show ? "power2.out" : "power2.in",
          overwrite: "auto",
        });
      }

      // The orange→gray turn-over, latched the same way (see GRAY_AT).
      //
      // Simpler than the ribbon in one respect: the hidden state *is* opacity 0,
      // so there is no parked-at-the-wrong-end problem to undo first and no
      // `midFlight` case — a reversal just tweens back from wherever it reached.
      //
      // `sine.inOut` both ways: this is a full-screen change of colour, so it
      // has to leave and arrive at zero velocity or the turn-over announces
      // itself at one end. The reverse is faster because it is racing the doors
      // parting underneath it (see GRAY_LEAD_VH), not because it should feel
      // different.
      let grayShown = false;
      let grayTween: gsap.core.Tween | null = null;
      function washGray(show: boolean) {
        const el = grayRef.current;
        if (!el || show === grayShown) return;
        grayShown = show;
        grayTween?.kill();
        grayTween = gsap.to(el, {
          opacity: show ? 1 : 0,
          duration: show ? GRAY_SECONDS : GRAY_HIDE_SECONDS,
          ease: "sine.inOut",
          overwrite: "auto",
        });
      }

      // --- The opening two beats, both off the scrub (see SEAL_AT) ---
      //
      // Each is a latched cue driving a paused tween over a plain number, and
      // `paintStage` is the only thing that reads those numbers. That split is
      // what makes mixing the two models safe: the cued move advances `seal.p` and
      // `crack.p` on its own clock, scrolling advances `lastVh`, and every frame —
      // whichever of them moved — is rendered by one function from the current
      // value of both. Painting from inside the tween instead would leave it and
      // the scrubbed half writing the same transforms from two places.
      const seal = { p: 0 };
      const crack = { p: 0 };
      let lastVh = 0;
      // Where the doors' scrubbed leg measures from: null until the cued move has
      // landed, so that leg cannot contribute while the hole is still closing (see
      // DOOR_OPEN_AT).
      let armVh: number | null = null;

      /**
       * Where the cued move flips — in *both* directions. It is SEAL_AT until the
       * move has landed, and from then on it is the scroll position it landed at.
       *
       * This exists because a fixed threshold is only correct in one direction, and
       * the sequence stalled on the way back up because of it. The move is timed,
       * not scrubbed, so scrolling down it plays over however much scroll the
       * visitor covers during its 1.6s — cued at 8vh, landing at 40 at a moderate
       * pace and far later on a flick. The doors' scrubbed leg then starts from
       * where it landed (`armVh`), so it, too, reverses back to exactly that point
       * and no further.
       *
       * Which left the stretch between SEAL_AT and the landing with nothing in it on
       * the way up. Going down it is full of motion — it *is* the cued move playing
       * — but coming back, the scrubbed leg was already spent at its bottom end and
       * the cue would not reverse until 8vh. So the doors sat frozen a crack open
       * with the lead line frozen at a fifth of its size, for however much scroll
       * the move had used going the other way: 30vh at a reading pace, over 100 after
       * a flick. Exactly the report — stuck, and no amount of scrolling up closed
       * them until the visitor had walked all the way back to 8.
       *
       * Latching the landing point fixes it with the threshold model intact: the
       * doors come to rest, and the moment the scroll goes back below where they
       * came to rest, the move reverses. Continuous at the seam, because that is the
       * same point the scrubbed leg reaches zero at.
       *
       * It is deliberately *not* reset when the move reverses. Clearing it there
       * would drop the threshold back to 8 while the scroll is still at 30 — which
       * satisfies `vh >= cueAt` again and re-opens the doors on the next frame,
       * trading the stall for a loop. It resets when the scroll actually reaches the
       * top instead (below), so a fresh pass down is cued exactly as the first was.
       */
      let cueAt = SEAL_AT;

      function paintStage() {
        const W = document.documentElement.clientWidth;
        const H = window.innerHeight;
        const vh = lastVh;

        // --- Phase 1: the hole seals over the footage (fires at 8vh) ---
        // The box is neither scaled nor moved — only the window it is seen
        // through closes, and only in width. A clip costs no layout work, and
        // this owns it outright: the load timeline animates opacity only and
        // leaves the hole open, so seal.p = 0 is already the state the entrance
        // faded up into.
        gsap.set(box, { clipPath: holeClip(seal.p) });

        // Same driver rather than a window of its own, so the copy is gone at
        // the exact moment the hole seals.
        gsap.set(headlineRef.current, { opacity: 1 - seal.p });

        // Nothing of this footage is on screen for the remaining nine-plus
        // viewports of the pin. Latched on a ref rather than the element's own
        // `paused`, since play() is asynchronous.
        const clip = clipVideoRef.current;
        if (clip) {
          const shut = seal.p >= 1;
          if (shut !== clipSealedRef.current) {
            clipSealedRef.current = shut;
            if (shut) clip.pause();
            else void clip.play().catch(() => { });
          }
        }

        // --- Phase 3: the doors, and the copy they hand over to ---
        //
        // How far open they are, from the two halves that drive them: the cued
        // crack and the scrubbed remainder. Summed rather than switched between,
        // so there is no frame where one hands over to the other — the first term
        // is capped at DOOR_AJAR and the second starts from zero, and a fast
        // scroll that begins the second while the first is still flying simply
        // opens them sooner instead of jumping.
        //
        // `sine.inOut` on the scrubbed half so it leaves the crack at rest and
        // arrives at rest, matching the copy's arrivals (see STACK_IN) and the
        // cued legs' own eases.
        const doorP =
          crack.p +
          (1 - DOOR_AJAR) *
            (armVh === null
              ? 0
              : STACK_IN(ramp(vh, [armVh, armVh + DOOR_SCRUB_VH])));

        // The aperture rather than the panels. They are DOOR_PANEL_W wide each,
        // so they overlap until DOOR_SEALED_AT and nothing has opened before
        // that — this is 0 the instant a gap appears and 1 when the doors come
        // to rest, which is exactly the span the lead line grows across (see
        // leadSeat).
        //
        // Derived from the same `doorP` the panels use, so whatever is driving
        // them drives the line identically and it stays locked to the opening it
        // is growing out of. The lock is between the text and the aperture, never
        // between the text and its driver — which is why moving the doors between
        // a tween and the scrub has never disturbed it.
        const gapP = ramp(doorP, [DOOR_SEALED_AT, 1]);

        // Where the doors will come to rest, live: `armVh` once the cued move has
        // landed, and the same expression `armVh` is about to be set to before
        // that — so this is continuous across the landing instead of jumping to
        // it, and the copy cannot start while the move is still flying.
        const restVh = Math.max(DOOR_OPEN_AT, armVh ?? vh) + DOOR_SCRUB_VH;

        // The copy's own clock. Starts where the doors actually stopped plus the
        // same beat of rest, ends at COPY_END whatever happened, so a late start
        // squeezes the sequence rather than sliding the whole tail of the section
        // back (see COPY_SQUEEZE_MAX). Identity in the ordinary case: the doors
        // rest at DOOR_OPEN_END, `from` is LEAD_OUT_AT, and this is just `vh`.
        const from = Math.min(
          LEAD_OUT_AT + (COPY_END - LEAD_OUT_AT) * COPY_SQUEEZE_MAX,
          Math.max(LEAD_OUT_AT, restVh + LEAD_HOLD_VH),
        );
        const copyVh =
          LEAD_OUT_AT +
          ((vh - from) * (COPY_END - LEAD_OUT_AT)) / (COPY_END - from);

        // Every line passes through the same centre seat, each rising into it as
        // the one before leaves upward (see stackSeat) — except the lead line,
        // which grows into it with the doors and then leaves like the rest.
        // Driven straight off GAP_LINES rather than line by line, so the
        // choreography is identical across all of them by construction: there is
        // no per-line code left for a line to be accidentally left out of.
        for (let i = 0; i < GAP_LINES.length; i++) {
          const line = GAP_LINES[i];
          const outP = STACK_OUT(ramp(copyVh, line.out));
          gsap.set(
            gapLineRefs.current[i],
            line.in
              ? stackSeat(H, STACK_IN(ramp(copyVh, line.in)), outP)
              : leadSeat(H, gapP, outP),
          );
        }

        // Each line owns its own opacity, so the container's only job is to stay
        // hidden until the first paint has seated them.
        gsap.set(contentRef.current, { opacity: 1 });

        // The panels, on `doorP` going out and closing again on scroll at the end.
        // Each slides out while drifting vertically, the drift finishing ahead of
        // the slide (hence `/0.7`).
        //
        // The close is not a second animation: `doorNow` is the opening's own
        // progress scaled back to zero, so the panels retrace the exact path they
        // came out on. Note the copy rides `doorP`, not this — it must stay gone
        // while the doors return, not play itself backwards.
        const closeP = ramp(vh, [DOOR_CLOSE_AT, DOOR_CLOSE_AT + DOOR_CLOSE_VH]);
        const doorNow = doorP * (1 - closeP);
        const drift = gsap.utils.clamp(0, 1, doorNow / 0.7);
        gsap.set(panelLeftRef.current, {
          x: -doorNow * W * DOOR_REST_X,
          y: drift * H * DOOR_REST_Y,
        });
        gsap.set(panelRightRef.current, {
          x: doorNow * W * DOOR_REST_X,
          y: -drift * H * DOOR_REST_Y,
        });

        // A 1080p decode is not free, so the footage only runs while some of it
        // can be seen — which covers both ends of the sequence. Latched on a ref
        // because play() is asynchronous: `paused` would still read true on the
        // next frame and this would call play() every frame until it resolved.
        const bg = bgVideoRef.current;
        if (bg) {
          const covered = doorNow < BACKGROUND_VISIBLE_AT_DOOR;
          if (covered !== bgCoveredRef.current) {
            bgCoveredRef.current = covered;
            if (covered) bg.pause();
            // Rejects if the browser declines to autoplay, which is not
            // something to act on: the still underneath is the fallback.
            else void bg.play().catch(() => { });
          }
        }
      }

      // --- The cued half of the opening: one number, two resting points ---
      //
      // `head.t` is a position along that path, measured in seconds (see SEAL_AT),
      // and `readHead` is the only thing that writes seal.p and crack.p. A tween
      // per leg was the alternative, and it has a race in it that this does not:
      // two tweens would own the same property whenever one started before the
      // other had finished. Here there is only ever one tween, over one number,
      // and the cue crossed mid-flight just changes where it is heading.
      const head = { t: STOP_SHUT };
      const LEG_EASE = gsap.parseEase("power2.inOut");

      function readHead() {
        const t = head.t;
        seal.p = LEG_EASE(gsap.utils.clamp(0, 1, t / SEAL_SECONDS));
        // Only as far as DOOR_AJAR: the rest of the doors' travel is scrubbed and
        // is added to this in paintStage. Leg 2 starts exactly where leg 1 ends, so
        // the hole is shut before the panels move.
        crack.p =
          DOOR_AJAR *
          LEG_EASE(gsap.utils.clamp(0, 1, (t - SEAL_SECONDS) / AJAR_SECONDS));
      }

      let travel: gsap.core.Tween | null = null;
      let stop = STOP_SHUT;
      function openTo(next: number) {
        if (next === stop) return;
        const back = next < stop;
        stop = next;
        // Going back to shut disarms the scrubbed leg, so a second pass down arms
        // again from wherever that pass happens to land rather than from the first
        // one's origin.
        if (next === STOP_SHUT) armVh = null;
        travel?.kill();
        travel = gsap.to(head, {
          t: next,
          // Proportional to the ground left to cover, which is what keeps the
          // rate the same whether this is a whole leg, the remainder of one
          // interrupted mid-flight, or both legs at once.
          duration:
            Math.abs(next - head.t) / (back ? OPENING_REVERSE_SPEED : 1),
          // The easing lives in readHead, one curve per leg. An ease here would
          // ease the *path* as well and double up on it.
          ease: "none",
          onUpdate: () => {
            readHead();
            paintStage();
          },
          // Only on arrival, and only at the open end: this is the promise that the
          // doors' scrubbed leg starts from rest, at zero progress, with the hole
          // already shut. A move killed mid-flight never gets here, which is
          // correct — nothing has landed.
          onComplete: () => {
            if (next !== STOP_AJAR) return;
            armVh = Math.max(DOOR_OPEN_AT, lastVh);
            // Where it landed, which from here is also where it reverses. Not
            // armVh: that one is floored at DOOR_OPEN_AT and so can sit *ahead* of
            // the scroll on a slow pass, and a threshold ahead of the scroll would
            // fire the reverse the instant the move finished.
            cueAt = lastVh;
          },
        });
      }

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        // CSS `sticky` does not work here: ScrollSmoother fakes scrolling with a
        // transform on #smooth-content, and `sticky` never engages without a
        // real scrolling ancestor. GSAP's pin sets position:fixed via JS.
        pin: stageRef.current,
        pinSpacing: false,
        onUpdate(self) {
          // ScrollTrigger fires an onUpdate at creation; without this guard it
          // would snap the clip straight to its resting size and cut the
          // entrance animation short.
          if (!introDoneRef.current) return;

          // Progress as real scroll distance through the pin, in vh, so each
          // phase reads as "from here to here" in scroll the user can feel.
          const vh = self.progress * PIN_VH;
          const H = window.innerHeight;
          // The one piece of scroll state paintStage reads. Set before the cues,
          // since firing one paints immediately.
          lastVh = vh;

          // One cue, one moving threshold: the hole sealing and the doors cracking
          // are a single move that plays at its own speed (see SEAL_AT), crossed in
          // either direction so scrolling back up walks the same move backwards.
          // Going up it reverses from where it landed rather than from SEAL_AT —
          // see `cueAt` for why a fixed mark stalled the whole sequence there. The
          // doors' remaining travel is scrubbed, in paintStage.
          //
          // Reset first: once the scroll is back at the top the move has nowhere
          // left to reverse to, so the next pass down is cued from the nominal mark
          // exactly as the first one was.
          if (vh <= SEAL_AT) cueAt = SEAL_AT;
          openTo(vh >= cueAt ? STOP_AJAR : STOP_SHUT);

          // The logo would end up over the revealed background, so this took it
          // ink → white straddling the seal — a change of surface rather than a
          // third event queued behind the other two. Disabled for now: the logo
          // stays ink for the whole scroll. Uncomment to restore the color swap.
          // gsap.set(logoRef.current, {
          //   backgroundColor: gsap.utils.interpolate(
          //     "#390303",
          //     "#ffffff",
          //     ramp(vh, [SEAL_AT, SEAL_AT + 30]),
          //   ),
          // });

          // Everything those two tweens and the scrubbed door close share, from
          // whatever the three of them currently say.
          paintStage();

          // --- Phase 4: the ribbon draws in, holds, and clears (303 – 363vh) ---
          // Not scrubbed: each end of the span fires a tween that runs to
          // completion on its own clock, so the wedges are always at rest before
          // it starts and it can never be left frozen half-drawn. Expressed as a
          // span so it behaves the same crossed either way.
          drawBand(vh >= BAND_DRAW_AT && vh < BAND_CLOSE_AT);

          // --- Phase 5: the closing line takes its place (398 – 559vh) ---
          // Seated where the ribbon was, not below it, so the wave resolves into
          // the words. It arrives like the gap copy but recedes instead of fading
          // (see leapSeat), scaling to nothing across the door close so it reads
          // as going back through the gap the panels are shutting.
          //
          // The exit takes the raw ramp deliberately — no STACK_OUT. The eased
          // version holds the line near full size early, which is exactly when
          // the panels are already advancing on it.
          gsap.set(
            leapRef.current,
            leapSeat(
              H,
              STACK_IN(ramp(vh, [LEAP_AT, LEAP_AT + LEAP_IN_VH])),
              ramp(vh, [LEAP_OUT_AT, LEAP_OUT_AT + LEAP_OUT_VH]),
            ),
          );

          // --- Phase 6: the doors close (468 – 593vh), driven in paintStage ---

          // --- Phase 7: orange turns over to gray (fires at 574vh) ---
          // Cued just past SEALED_AT rather than off the door close, because the
          // panels seal 34vh before they stop moving and all of that is travel
          // with no visible edges in it — waiting for the doors to finish would
          // shorten the flat-orange stall instead of removing it.
          //
          // Not scrubbed: crossing this threshold in either direction fires a
          // tween that runs to completion (see washGray). A threshold and not a
          // span like the ribbon's, because nothing past it ever takes the gray
          // back off — the pin's own end is the only upper bound it needs.
          //
          // A gray layer over the top rather than a background-colour tween: the
          // orange is painted by three separate elements here (the section and
          // both panels), and one layer over them is a single number instead of
          // three that have to agree.
          washGray(vh >= GRAY_AT);

          // --- Phase 8: a short hold on flat gray — already the next section's
          // colour, so the pin releasing is invisible.
        },
      });

      return () => {
        // Created inside onUpdate, so the context never collected them.
        bandTween?.kill();
        grayTween?.kill();
        travel?.kill();
        trigger.kill();
      };
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  // Custom circle cursor, active only while pointing at this section.
  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const section = sectionRef.current;
    const cursor = cursorRef.current;
    if (!section || !cursor) return;

    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3" });

    function handleMove(e: MouseEvent) {
      xTo(e.clientX);
      yTo(e.clientY);
    }
    function handleEnter(e: MouseEvent) {
      xTo(e.clientX);
      yTo(e.clientY);
      gsap.to(cursor, { opacity: 1, duration: 0.2 });
    }
    function handleLeave() {
      gsap.to(cursor, { opacity: 0, duration: 0.2 });
    }

    section.addEventListener("mousemove", handleMove);
    section.addEventListener("mouseenter", handleEnter);
    section.addEventListener("mouseleave", handleLeave);
    return () => {
      section.removeEventListener("mousemove", handleMove);
      section.removeEventListener("mouseenter", handleEnter);
      section.removeEventListener("mouseleave", handleLeave);
    };
  }, [reducedMotion, mounted]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-accent [&_*]:!cursor-none cursor-none"
      style={{ height: reducedMotion ? "100vh" : `${SECTION_VH}vh` }}
    >
      {/* Portaled out because `position: fixed` does not work inside
          ScrollSmoother's transformed #smooth-content. */}
      {mounted &&
        !reducedMotion &&
        createPortal(
          <div
            ref={cursorRef}
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-50 h-6 w-6 rounded-full bg-white opacity-0"
          />,
          document.body,
        )}

      {/* GSAP pins this element directly (see the ScrollTrigger above); CSS
          `sticky` does not work here. `relative` still gives next/image `fill`
          something to resolve against before pinning kicks in. */}
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden">
        <div className="relative h-full w-full">
          {/* Background reveal, uncovered once the doors move. The still and the
            footage are layered rather than swapped: the still covers the stretch
            before the idle callback fires, the reduced-motion path, and an
            outright playback failure.

            No `priority`, and no `poster` on the video either — both would
            preload for a first frame that cannot be seen for a viewport of
            scrolling, and the poster once pointed at this same 5184px source. */}
          <Image
            src="/img/hero-bg.jpg"
            alt="Misty coastal cliffs at dawn"
            fill
            className="object-cover"
            sizes="100vw"
          />

          {bgSrc && (
            <video
              ref={bgVideoRef}
              // Fades over the still on its first frame rather than cutting,
              // which matters for a visitor arriving at a restored scroll
              // position with the doors already open.
              className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-700 ${bgPlaying ? "opacity-100" : "opacity-0"
                }`}
              src={bgSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              // Decorative: the still below carries the alt text.
              aria-hidden
              onPlaying={() => setBgPlaying(true)}
            />
          )}

          {/* Orange doors. Oversized so the closed state fully overlaps and the
            diagonal drift never exposes a panel's short edge. In reduced motion
            they render already parked — the same offsets in vw/vh, since there
            is no ScrollTrigger to drive them. */}
          <div
            ref={panelLeftRef}
            className="absolute -top-1/4 left-0 z-10 h-[150%] bg-accent"
            style={{
              width: `${DOOR_PANEL_W * 100}%`,
              transform: reducedMotion
                ? `translate(${-DOOR_REST_X * 100}vw, ${DOOR_REST_Y * 100}vh)`
                : undefined,
            }}
          />
          <div
            ref={panelRightRef}
            className="absolute -top-1/4 right-0 z-10 h-[150%] bg-accent"
            style={{
              width: `${DOOR_PANEL_W * 100}%`,
              transform: reducedMotion
                ? `translate(${DOOR_REST_X * 100}vw, ${-DOOR_REST_Y * 100}vh)`
                : undefined,
            }}
          />

          {/* The footage, seen through a rectangular hole in the orange. The box
            never moves or resizes — only its clip does, and only on scroll.
            Starts fully open but transparent, so the entrance is a plain fade
            (see the load timeline) and nothing flashes before it runs; opacity
            rather than a `scale-0` class because GSAP must not have to write a
            transform here, which would wipe the translate-centering. */}
          <div
            ref={videoBoxRef}
            className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-75 min-w-35 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            style={{ clipPath: holeClip(0), opacity: 0 }}
          >
            {/* Not /video/section2.mp4, which is kept alongside as the master:
              that is 1920×1080 and 18.5MB, and this box is at most 300px wide,
              so `object-cover` was discarding ~80% of every decoded frame. This
              is the same footage pre-cropped to the strip that shows, centred
              where object-cover already centred it, at 480×1080 and 3.53MB.

              `poster` is a plain URL, so it bypasses next/image and is served at
              whatever size it is on disk. It is now the video's own first frame
              at 36KB, so the handoff to playback is invisible. */}
            <video
              ref={clipVideoRef}
              className="absolute inset-0 h-full w-full object-cover"
              src="/video/section2-vertical.mp4"
              poster="/img/section2-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>

          {/* The turn-over from orange to the next section's gray (see Phase 7).
            Above the panels and everything they carry, but deliberately below
            the header: the wordmark survives into the gray rather than being
            painted out along with the orange.

            Nothing but GSAP ever raises it, so it stays at opacity 0 under
            reduced motion — where the doors are parked open over the footage and
            a gray screen would be plainly wrong. */}
          <div
            ref={grayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[25] bg-gray opacity-0"
          />

          {/* Starts hidden in the markup, exactly like the clip box above and
            the headline below, and for the same reason. The load timeline is
            what fades it in; the effect that sets its start state cannot run
            until after the first paint — one commit to flip `mounted`, another
            for the effect itself — so a wordmark left visible here is painted
            at full strength, blanked a frame or two later, then faded back in.
            Restored explicitly under reduced motion, where nothing fades it. */}
          <header className="absolute top-0 left-0 z-30 w-full px-8 py-8 md:px-16">
            <Logo
              ref={logoRef}
              className="w-[90px] opacity-0 md:w-[120px]"
              color="var(--color-ink)"
            />
          </header>

          {/* No translate-centring classes on purpose: GSAP animates `y` here
            and owns xPercent/yPercent instead, in both motion modes. Safe to
            leave uncentred for the frame before that runs because `opacity-0`
            starts it hidden. */}
          <p
            ref={headlineRef}
            className="absolute top-1/2 left-1/2 z-30 w-full max-w-5xl px-8 text-center text-[32px] leading-[1.3] font-light text-white/80 opacity-0 md:text-[52px] lg:max-w-[1300px] lg:text-[68px]"
          >
            eventually, success becomes your
            <br />
            biggest branding problem
          </p>

          <div
            aria-hidden
            className="absolute bottom-8 left-1/2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/70"
          />

          {reducedMotion && (
            /* Nothing animates here, so the opening copy has to live where it
               won't collide with the ribbon, which is pinned to the wedges in
               both modes. */
            <div className="absolute inset-x-8 top-[10%] z-20 text-center md:inset-x-16">
              <GapCopy />
            </div>
          )}

          {!reducedMotion && (
            /* No flex column and no padding of its own: both lines are seated
               absolutely at its centre and carry their own gutters, so the one
               arriving lands exactly where the one leaving sat. */
            <div
              ref={contentRef}
              className="pointer-events-none absolute inset-0 z-30 opacity-0"
            >
              <GapCopy
                overlay
                lineRefs={gapLineRefs}
                fontSize={gapCopyFontSize(stageBox.w)}
              />
            </div>
          )}

          {band && (
            <>
              {/* Placed at the geometry's own `top`, not centred, because its
                ends have to meet the wedge corners exactly.

                Sits *below* the doors (z-5 against z-10), which changes nothing
                about the finished composition but does mean panels sliding back
                in on an upward scroll cover a ribbon that is still closing
                rather than leaving it on top of the orange. */}
              <div
                ref={wavyRef}
                className="pointer-events-none absolute z-[5]"
                style={{
                  left: BAND_INSET,
                  right: BAND_INSET,
                  top: band.top,
                  clipPath: reducedMotion ? undefined : BAND_CLIP_UNDRAWN,
                }}
              >
                <WavyBand g={band} animate={!reducedMotion} />
              </div>

              {/* Centred on the stage rather than boxed inside the band's inset:
                sized to its own content and pulled back half its width, so its
                midpoint is the screen's at any font size. Being unboxed is what
                keeps any overhang even rather than all on one side — it is not a
                licence to overhang, which is what the old note here read as, and
                what the hardcoded 60px it excused actually did.

                On the ribbon's centre line, since it takes over that space once
                the ribbon clears — and sized to the span between the wedges (see
                LEAP_EMS) so it sits between them, with 26–64px of clearance a
                side from 768px up. The clamp's floor still overflows below ~700px,
                where the span is far too narrow to fit this many words at any
                readable size; that is the one place the overhang is accepted.

                Translate-centring is GSAP's here (xPercent, from leapSeat), not
                the class list's. Reduced motion has no GSAP, so it keeps the
                class and stays below the band — where it must be, since the
                ribbon is drawn in full there and never clears. */}
              <div
                ref={leapRef}
                className={`pointer-events-none absolute left-1/2 z-20 text-center ${reducedMotion ? "-translate-x-1/2" : ""
                  }`}
                style={{
                  top: reducedMotion
                    ? band.top + band.height + LEAP_GAP
                    : band.top + band.height / 2,
                  fontSize: gsap.utils.clamp(26, 82, band.width / LEAP_EMS),
                  opacity: reducedMotion ? 1 : 0,
                }}
              >
                {LEAP_COPY}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
