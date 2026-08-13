import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { DOOR_REST_X, DOOR_REST_Y, DOOR_SEALED_AT, holeClip } from "./doors";
import { BAND_CLOSED, BAND_FULL, BAND_UNDRAWN, bandClip } from "./band";
import { BACKGROUND_VISIBLE_AT_DOOR } from "./footage";
import { STACK_IN, STACK_OUT, leadSeat, leapSeat, stackSeat } from "./seats";
import {
  BAND_CLEAR_AT,
  BAND_CLOSE_AT,
  BAND_DRAW_AT,
  BAND_DRAW_SECONDS,
  BAND_HIDE_SECONDS,
  BAND_REVERSE_SPEED,
  BAND_UNDRAW_AT,
  CLOSE_REVERSE_SPEED,
  CLOSE_SEALED_P,
  CLOSE_SECONDS,
  DOOR_CLOSE_AT,
  DOOR_OPEN_AT,
  GAP_LINES,
  GRAY_HIDE_SECONDS,
  GRAY_SECONDS,
  LEAP_AT,
  LEAP_IN_VH,
  OPEN_REVERSE_SPEED,
  OPEN_SECONDS,
  OPEN_SPAN,
  PIN_VH,
  SEAL_AT,
  SEAL_OVERSHOOT,
  ramp,
} from "./timeline";

/**
 * Everything the sequence drives, as refs rather than resolved elements —
 * deliberately, and not just for convenience: the ribbon and the closing line only
 * mount once the stage has been measured, so both are still null when this runs and
 * `drawBand` is written to retry rather than to assume (see below). The last three
 * are latches, not elements.
 */
export type SequenceRefs = {
  stage: RefObject<HTMLDivElement | null>;
  headline: RefObject<HTMLParagraphElement | null>;
  panelLeft: RefObject<HTMLDivElement | null>;
  panelRight: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  gapLines: RefObject<(HTMLParagraphElement | null)[]>;
  ribbon: RefObject<HTMLDivElement | null>;
  leap: RefObject<HTMLDivElement | null>;
  gray: RefObject<HTMLDivElement | null>;
  bgVideo: RefObject<HTMLVideoElement | null>;
  clipVideo: RefObject<HTMLVideoElement | null>;
  /** Latched because play() is asynchronous: `paused` still reads stale next frame. */
  bgCovered: RefObject<boolean>;
  /** Latched for the same reason as bgCovered. */
  clipSealed: RefObject<boolean>;
  /** False until the load timeline has finished, which gates every phase here. */
  introDone: RefObject<boolean>;
  /**
   * Written by this module, called by the load timeline the instant it lands.
   *
   * The entrance and the scroll sequence run on two clocks that cannot see each
   * other, and the hand-off between them needs one edge-triggered call — a scroll
   * event cannot be relied on to arrive after the entrance finishes (see `advance`).
   */
  catchUp: RefObject<(() => void) | null>;
  /**
   * The other direction of that hand-off: written by the load timeline, called from
   * here the moment the reader scrolls past the opening's first mark.
   *
   * The stage is frozen until the entrance lands, so scroll accumulates underneath it,
   * and a *scrubbed* opening is read from the position rather than played from the
   * start — so the hand-off paints the doors wherever the reader has already reached.
   * See playHeroIntro for what that looked like and why hurrying is the right answer
   * rather than widening the gate.
   */
  hurryIntro: RefObject<(() => void) | null>;
};

/**
 * The one scroll-driven sequence: one stage, one ScrollTrigger, so scrolling back
 * up reverses every phase. The beat-by-beat map is in ./timeline.
 *
 * Cued beats and scrubbed beats are mixed here, and the split is what makes that
 * safe: each cue drives a tween over a plain number, scrolling advances `lastVh`, and
 * `paintStage` is the *only* thing that reads either — so every frame, whichever of
 * them moved, is rendered from the current value of both. Painting from inside the
 * tweens instead would leave them and the scrubbed half writing the same transforms
 * from two places.
 *
 * The cues are confined to the tail — the ribbon, the doors' close, the wash — and the
 * whole front of the section is scrubbed. That boundary is load-bearing: a cue plays on
 * its own clock while the reader keeps scrolling, so it lands at a different mark on
 * every pass, and anything measured from that landing inherits the scroll's speed. The
 * opening used to be cued and the gap copy was measured from where the doors stopped;
 * see the note at the top of ./timeline for what that did.
 *
 * A plain function rather than a hook: the caller owns the effect and its
 * dependencies, and everything created here is collected by the returned context.
 */
export function createHeroSequence(
  section: HTMLElement,
  box: HTMLDivElement,
  refs: SequenceRefs,
) {
  return gsap.context(() => {
    // The ribbon, kept off the scrub entirely (see BAND_DRAW_AT), and driven as one
    // number sweeping BAND_UNDRAWN → BAND_FULL → BAND_CLOSED (see bandClip).
    //
    // Three states and three tweens between fixed clip strings was the previous shape,
    // and it had the fault this one cannot have: a scroll fast enough to cross the draw
    // and close marks inside the draw's own 0.9s killed a half-drawn wave and retargeted
    // it at the *opposite* pinch, so it jumped the width of the screen instead of
    // carrying on. Along a single axis a cue crossed mid-flight only moves where the
    // sweep is heading — the wave keeps travelling the way it already was, faster.
    //
    // Serialising the old three-state version instead — never interrupt, queue the next
    // move — also removed the jump, and cost more than it was worth: a move that cannot
    // be interrupted is a move that is still playing 1.4s after the reader has gone
    // past, which put the ribbon on top of the last line of copy for the whole of a fast
    // pass back up. Interruptible and continuous beats uninterruptible.
    const band = { w: BAND_UNDRAWN };
    let bandTo: number = BAND_UNDRAWN;
    let bandTween: gsap.core.Tween | null = null;

    // The two legs are not the same speed, so a sweep spanning both costs the sum of
    // what it covers in each rather than one blended rate — and travelling backwards is
    // quicker than either (see BAND_REVERSE_SPEED). Proportional to the ground left, so
    // a reversal partway runs back at the rate it came out at.
    const sweepSeconds = (from: number, to: number) => {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      const drawing = Math.max(0, Math.min(hi, 0) - Math.min(lo, 0));
      const closing = Math.max(0, Math.max(hi, 0) - Math.max(lo, 0));
      const secs = drawing * BAND_DRAW_SECONDS + closing * BAND_HIDE_SECONDS;
      return to < from ? secs / BAND_REVERSE_SPEED : secs;
    };

    function sweepBand(to: number) {
      if (to === bandTo) return;
      bandTo = to;
      bandTween?.kill();
      bandTween = gsap.to(band, {
        w: to,
        duration: sweepSeconds(band.w, to),
        // The easing is applied when the number is read, not here. An eased tween
        // retargeted mid-flight re-eases from its new start, so an interruption would
        // stutter — exactly the case this shape exists to make smooth.
        ease: "none",
        onUpdate: paintStage,
        overwrite: "auto",
      });
    }

    // Applied on read, so the wipe still eases out as it lands and in as it leaves,
    // exactly as the two separate tweens did.
    const BAND_IN = gsap.parseEase("power2.out");
    const BAND_OUT = gsap.parseEase("power2.in");

    // The orange→gray turn-over, latched the same way (see CLOSE_SEALED_P).
    //
    // Simpler than the ribbon in one respect: the hidden state *is* opacity 0, so
    // there is no parked-at-the-wrong-end problem to undo first and no `midFlight`
    // case — a reversal just tweens back from wherever it reached.
    //
    // `sine.inOut` both ways: this is a full-screen change of colour, so it has to
    // leave and arrive at zero velocity or the turn-over announces itself at one
    // end. The reverse is faster because it is racing the doors parting underneath
    // it, not because it should feel different.
    let grayShown = false;
    let grayTween: gsap.core.Tween | null = null;
    function washGray(show: boolean) {
      const el = refs.gray.current;
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

    // The doors' return, cued (see DOOR_CLOSE_AT) where the opening is scrubbed — and
    // the asymmetry is deliberate rather than left over. A cue lands at a mark that
    // depends on scroll speed, which is ruinous when a whole sequence is measured from
    // it and free here: the close is the last thing in the section, so the only thing
    // downstream of it is the wash, and the wash rides the close's own progress rather
    // than a mark of its own (see CLOSE_SEALED_P). Nothing can be left behind by it.
    //
    // One cue and not two. Splitting it — half the travel on one scroll, the rest on
    // the next — was tried and reverted: the marks have to sit about a notch apart, and
    // a notch is crossed well inside the first leg's own duration, so the second gesture
    // retargets a tween that is still flying and the panels skip the end of their
    // travel. It is the same panels on the same path either way, and the join is the
    // part you watch. The opening lost its own halfway stop for the same reason from the
    // other direction — a place the doors are designed to rest in is a place they can be
    // left (see OPEN_VH).
    //
    // `power2.inOut` on the tween, so the panels leave and arrive at rest — the same
    // shape LEG_EASE gives each leg of the opening, which is what "retraces the
    // opening" has to mean once the clock under it is time rather than scroll. The
    // duration is proportional to the ground left, so a reversal mid-close runs back
    // at the rate it came out at instead of taking the full CLOSE_SECONDS to cover a
    // sliver.
    const close = { p: 0 };
    let closing = false;
    let closeTween: gsap.core.Tween | null = null;
    function closeDoors(shut: boolean) {
      if (shut === closing) return;
      closing = shut;
      const to = shut ? 1 : 0;
      closeTween?.kill();
      closeTween = gsap.to(close, {
        p: to,
        // Proportional to the ground left, and slower coming back — see
        // CLOSE_REVERSE_SPEED for why this reverse is the one that wants stretching
        // rather than shortening.
        duration:
          (CLOSE_SECONDS * Math.abs(to - close.p)) /
          (shut ? 1 : CLOSE_REVERSE_SPEED),
        ease: "power2.inOut",
        onUpdate: paintStage,
        overwrite: "auto",
      });
    }

    // --- The opening: one path, a clock on it, and a floor under it ---
    //
    // `cue.p` is the timed half: crossing SEAL_AT sends it to 1 over OPEN_SECONDS, so
    // one scroll of any size — a single wheel notch included — plays the whole opening.
    // paintStage takes `max(cue.p, ramp(vh, OPEN_SPAN))`, so the move may run ahead of
    // the scroll and never behind it. That bound is what makes the clock affordable:
    // the doors are open by DOOR_OPEN_AT whatever the reader does, so every mark below
    // is fixed and nothing downstream inherits their speed. See OPEN_VH.
    const cue = { p: 0 };
    let cueTo = 0;
    let cueTween: gsap.core.Tween | null = null;
    function openPath(next: number) {
      if (next === cueTo) return;
      cueTo = next;
      cueTween?.kill();
      cueTween = gsap.to(cue, {
        p: next,
        // Proportional to the ground left, so a reversal partway runs back at the rate
        // it came out at rather than taking the full duration to cover a sliver.
        duration:
          (OPEN_SECONDS * Math.abs(next - cue.p)) /
          (next < cue.p ? OPEN_REVERSE_SPEED : 1),
        // The easing is per leg, in paintStage. An ease here would ease the path as
        // well and double up on it.
        ease: "none",
        onUpdate: paintStage,
        overwrite: "auto",
      });
    }

    let lastVh = 0;
    /**
     * Which way the reader is going: 1 down, −1 up. Stored rather than read off
     * `self.direction` at the point of use, because it is read from tween callbacks as
     * well as from the scroll — and, more importantly, because it is *filtered*.
     *
     * `self.direction` flips on the sign of a single frame's delta, and under
     * ScrollSmoother that sign is not stable: the smoother keeps delivering motion for
     * about a second after a gesture ends, and the tail of it wobbles across zero. Two
     * beats key off direction — the opening's reverse and the ribbon's two marks — and
     * for the opening the cost was the whole complaint. Each flicker retargeted a 1.9s
     * cue that had barely started, so the doors never got to close: they jittered in
     * place while the reader scrolled up, then the scroll ceiling caught them and pulled
     * them shut in one frame. No closing, no footage growing, just the video suddenly
     * there.
     *
     * So it is a Schmitt trigger on travel rather than on sign: the direction only
     * changes once the scroll has actually moved DIR_FLIP_VH against it. `dirPeak` is
     * the furthest point reached since the last flip, so the threshold is measured from
     * the turn and not from wherever the last event landed.
     */
    let scrollDir = 1;
    let dirPeak = 0;
    /**
     * How far the scroll must reverse before it counts as a reversal.
     *
     * Under a wheel notch (~11vh) and comfortably above the smoother's settling wobble,
     * which is well under a viewport percent. Small enough that a deliberate change of
     * mind is honoured on the same gesture that makes it.
     */
    const DIR_FLIP_VH = 3;

    function trackDirection(vh: number) {
      if (scrollDir > 0) {
        if (vh > dirPeak) dirPeak = vh;
        else if (vh < dirPeak - DIR_FLIP_VH) {
          scrollDir = -1;
          dirPeak = vh;
        }
      } else {
        if (vh < dirPeak) dirPeak = vh;
        else if (vh > dirPeak + DIR_FLIP_VH) {
          scrollDir = 1;
          dirPeak = vh;
        }
      }
    }

    /**
     * The ease both legs of the opening are shaped by, so each leaves and arrives at
     * rest. Parsed once, because paintStage calls it twice a frame.
     *
     * Per leg and not across the pair: the seal has to come to a stop before the panels
     * start, or the footage would still be closing as the orange parted over it. Inside
     * a leg it is one curve end to end, which is the other half of the smoothness fix —
     * the doors used to cross two of these inside 12vh (see OPEN_VH).
     */
    const LEG_EASE = gsap.parseEase("power2.inOut");

    /**
     * The path fraction at which a gap first appears between the panels.
     *
     * They are DOOR_PANEL_W wide each and overlap until DOOR_SEALED_AT of their travel,
     * so the first 41% of the doors' leg is invisible — solid orange, whatever the
     * panels are doing underneath. That is the number the hole's closing has to be
     * timed against rather than against the leg's start, or the two are half a second
     * apart with nothing on screen between them (see SEAL_OVERSHOOT).
     *
     * Solved by bisection rather than by inverting `power2.inOut` in closed form: the
     * ease is named in one place and this follows it, so changing LEG_EASE cannot leave
     * a stale constant behind. Forty steps is far past double precision on [0,1], and it
     * runs once per mount.
     */
    const APERTURE_AT = (() => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (LEG_EASE(mid) < DOOR_SEALED_AT) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    })();

    /** Where the hole finishes closing: just past the gap opening, never before it. */
    const SEAL_END = Math.min(1, APERTURE_AT * (1 + SEAL_OVERSHOOT));

    /**
     * The viewport, cached rather than read per paint.
     *
     * `paintStage` runs on every scroll event *and* on every frame of five separate
     * tweens, and `clientWidth`/`innerHeight` can both force a synchronous layout. So
     * the old per-paint read charged a layout to exactly the moment frames are
     * scarcest — a fast scroll, with the scrub still catching up and two or three cued
     * moves in flight. Dropped frames there are the difference between a move that
     * plays and a move that jumps, which is the whole complaint.
     *
     * Re-read on ScrollTrigger's own refresh, which is what a resize already fires.
     */
    let W = document.documentElement.clientWidth;
    let H = window.innerHeight;

    function paintStage() {
      const vh = lastVh;

      // Where the opening has got to: the timed move or the scroll, whichever is
      // further on *in the direction being travelled*. The clock leads at ordinary
      // speeds, the scroll leads once the reader outruns it, and the crossing between
      // them is continuous because both are heading for the same end. See OPEN_VH.
      //
      // The direction is the whole of why this is not a plain `max`. A floor can only
      // ever push the path further *open*, so with `max` alone the descent was one cued
      // gesture and the way back up was scrubbed across all 52vh of OPEN_SPAN — five
      // notches to shut a door that took one to open, stalling partway with a sliver of
      // footage showing. Going up the same ramp has to act as a ceiling instead, and
      // then the reverse is one gesture too.
      const boundP = ramp(vh, OPEN_SPAN);
      const pathP =
        scrollDir < 0 ? Math.min(cue.p, boundP) : Math.max(cue.p, boundP);

      // The two legs of that one path, overlapping rather than sequential. The panels
      // run the whole path; the hole closes across the part of it that ends as the
      // aperture appears, so the footage hands over from one to the other with no bare
      // orange in between (see SEAL_OVERSHOOT). The panels' first 41% is invisible
      // anyway — they are still overlapped — so nothing is given up by starting them
      // under the hole.
      const sealP = LEG_EASE(gsap.utils.clamp(0, 1, pathP / SEAL_END));
      const openP = LEG_EASE(pathP);

      // --- Phase 1: the hole seals over the footage (the first 28% of the path) ---
      // The box is neither scaled nor moved — only the window it is seen through
      // closes, and only in width. A clip costs no layout work, and this owns it
      // outright: the load timeline animates opacity only and leaves the hole open,
      // so sealP = 0 is already the state the entrance faded up into.
      gsap.set(box, { clipPath: holeClip(sealP) });

      // Same driver rather than a window of its own, so the copy is gone at the
      // exact moment the hole seals.
      gsap.set(refs.headline.current, { opacity: 1 - sealP });

      // Nothing of this footage is on screen for the remaining nine-plus viewports
      // of the pin.
      const clip = refs.clipVideo.current;
      if (clip) {
        const shut = sealP >= 1;
        if (shut !== refs.clipSealed.current) {
          refs.clipSealed.current = shut;
          if (shut) clip.pause();
          else void clip.play().catch(() => { });
        }
      }

      // --- Phase 3: the doors, and the copy they hand over to ---
      //
      // How far open they are. One number off one span now — it used to be a crack
      // capped at DOOR_AJAR plus a swing covering the rest, summed, with a deliberate
      // resting place between them (see OPEN_VH for why that went).
      const doorP = openP;

      // The aperture rather than the panels. They are DOOR_PANEL_W wide each, so
      // they overlap until DOOR_SEALED_AT and nothing has opened before that — this
      // is 0 the instant a gap appears and 1 when the doors come to rest, which is
      // exactly the span the lead line grows across (see leadSeat).
      //
      // Derived from the same `doorP` the panels use, so whatever is driving them
      // drives the line identically. The lock is between the text and the aperture,
      // never between the text and its driver — which is why moving the doors
      // between a tween and the scrub has never disturbed it.
      const gapP = ramp(doorP, [DOOR_SEALED_AT, 1]);

      // Every line passes through the same centre seat, each rising into it as the
      // one before leaves upward (see stackSeat) — except the lead line, which grows
      // into it with the doors and then leaves like the rest. Driven straight off
      // GAP_LINES rather than line by line, so the choreography is identical across
      // all of them by construction.
      //
      // Read off raw `vh`, and that is the fix for the whole complaint this section
      // used to have. There was a clock of its own here — the copy's origin measured
      // from wherever the doors had come to rest, its end pinned to COPY_END, the run
      // between them compressed to fit — because a cued opening rests at a different
      // mark on every pass. Squeezed past the cap on that compression, the lines began
      // arriving before the doors had stopped: the lead line's exit ramp running while
      // the aperture was still scaling it up, and the two behind it flashing through.
      // Now that the doors rest at a fixed mark (see the note on scrubbing in
      // ./timeline) the two clocks are one, and these windows are the windows at any
      // scroll speed — same order, same holds, no compression.
      for (let i = 0; i < GAP_LINES.length; i++) {
        const line = GAP_LINES[i];
        const outP = STACK_OUT(ramp(vh, line.out));
        gsap.set(
          refs.gapLines.current[i],
          line.in
            ? stackSeat(H, STACK_IN(ramp(vh, line.in)), outP)
            : leadSeat(H, gapP, outP),
        );
      }

      // Each line owns its own opacity, so the container's only job is to stay
      // hidden until the first paint has seated them.
      gsap.set(refs.content.current, { opacity: 1 });

      // --- Phase 4: the ribbon draws in, holds, and clears ---
      // Not scrubbed: each end of the span fires a tween that runs to completion on
      // its own clock, so the wedges are always at rest before it starts and it can
      // never be left frozen half-drawn. Expressed as a span so it behaves the same
      // crossed either way.
      //
      // Two marks, picked by the direction of travel: the wave commits at
      // BAND_DRAW_AT going down and lets go at the higher BAND_UNDRAW_AT coming back
      // up. One mark cannot do both — see BAND_UNDRAW_AT for why the overlap that
      // reads as a handover downward reads as a collision in reverse.
      //
      // Keyed to `scrollDir` and emphatically *not* to the latch. Choosing the mark by
      // `bandTo` looks like hysteresis and is its inverse: the release mark sits
      // *above* the commit mark, so un-drawing at 243 drops the test to 222, which the
      // scroll still satisfies, which draws again, which restores 243 — a flip every
      // frame, each one killing the tween before it can play. The wave did not close,
      // it strobed. Direction is stable across a stopped scroll, so this cannot
      // oscillate: only a genuine reversal changes the mark, and the target absorbs
      // the rest.
      sweepBand(
        vh >= BAND_CLOSE_AT
          ? BAND_CLOSED
          : vh >= (scrollDir < 0 ? BAND_UNDRAW_AT : BAND_DRAW_AT)
            ? BAND_FULL
            : BAND_UNDRAWN,
      );

      // The wipe, eased, and how much ribbon that leaves on screen. `bandVis` is what
      // the closing line is gated on below.
      const wipe = band.w < 0 ? BAND_IN(1 + band.w) - 1 : BAND_OUT(band.w);
      const bandVis = 1 - Math.abs(wipe);
      if (refs.ribbon.current) {
        gsap.set(refs.ribbon.current, { clipPath: bandClip(wipe) });
      }

      // The panels, on `doorP` going out and closing again on scroll at the end.
      // Each slides out while drifting vertically, the drift finishing ahead of the
      // slide (hence `/0.7`).
      //
      // The close is not a second animation: `doorNow` is the opening's own progress
      // scaled back to zero, so the panels retrace the exact path they came out on.
      // Note the copy rides `doorP`, not this — it must stay gone while the doors
      // return, not play itself backwards.
      const closeP = close.p;
      const doorNow = doorP * (1 - closeP);
      const drift = gsap.utils.clamp(0, 1, doorNow / 0.7);
      gsap.set(refs.panelLeft.current, {
        x: -doorNow * W * DOOR_REST_X,
        y: drift * H * DOOR_REST_Y,
      });
      gsap.set(refs.panelRight.current, {
        x: doorNow * W * DOOR_REST_X,
        y: -drift * H * DOOR_REST_Y,
      });

      // --- Phase 5: the closing line, arriving on scroll and leaving with the doors
      //
      // Seated where the ribbon was, not below it, so the wave resolves into the
      // words. It arrives like the gap copy but recedes instead of fading (see
      // leapSeat), scaling to nothing as the panels shut so it reads as being drawn
      // back through the gap they are closing.
      //
      // The exit is the close's own progress rescaled to reach 1 at the seal — no
      // STACK_OUT, and no window of its own in vh. Both halves of that matter: an
      // eased exit holds the line near full size exactly when the panels are already
      // advancing on it, and a scroll window would come unstuck from a close that no
      // longer costs scroll.
      //
      // Its arrival is the *lesser* of the scroll's ramp and how far the ribbon has
      // actually gone, and the second term is what keeps them off each other at speed.
      // The scroll ramp alone was tuned against the close's 0.5s clock at an ordinary
      // pace — 32vh of `sine.inOut` is slowest exactly at the start, so half a second in
      // the line has barely moved. At 90vh/s those 32vh take 0.36s, so the line was
      // fully seated while the wave was still closing through the same seat. Reading the
      // wave directly instead makes the hand-over hold at every speed, in both
      // directions: scrolling back up the ribbon redraws, `bandVis` climbs, and the line
      // is pushed out of the seat ahead of it rather than fading through it.
      //
      // `BAND_CLEAR_AT` rather than `1 - bandVis` because they share one seat: a line at
      // half strength under a wave that is half gone is still two things in one place.
      // The gate stays shut until the wave is most of the way out, then opens quickly.
      const bandClear = ramp(1 - bandVis, BAND_CLEAR_AT);
      gsap.set(
        refs.leap.current,
        leapSeat(
          H,
          Math.min(STACK_IN(ramp(vh, [LEAP_AT, LEAP_AT + LEAP_IN_VH])), bandClear),
          gsap.utils.clamp(0, 1, closeP / CLOSE_SEALED_P),
        ),
      );

      // --- Phase 6: orange turns over to gray, on the close's own progress ---
      // Fired the instant the panels meet rather than at a mark in vh, which is what
      // guarantees there is no flat-orange stall between the two at any scroll speed
      // (see CLOSE_SEALED_P). Latched, so this is a threshold and not a scrub — the
      // wash is one timed move in both directions (see washGray).
      washGray(closeP >= CLOSE_SEALED_P);

      // A 1080p decode is not free, so the footage only runs while some of it can be
      // seen — which covers both ends of the sequence.
      const bg = refs.bgVideo.current;
      if (bg) {
        const covered = doorNow < BACKGROUND_VISIBLE_AT_DOOR;
        if (covered !== refs.bgCovered.current) {
          refs.bgCovered.current = covered;
          if (covered) bg.pause();
          // Rejects if the browser declines to autoplay, which is not something to
          // act on: the still underneath is the fallback.
          else void bg.play().catch(() => { });
        }
      }
    }

    /**
     * One frame of the sequence, from whatever `lastVh` currently says.
     *
     * Split out of `onUpdate` so it has two callers. The scroll is the ordinary one;
     * the other is the load timeline landing (see `refs.catchUp`), and without it the
     * hand-off between the two clocks could be dropped entirely — see the gate below.
     *
     * Short, and it used to be long. The opening was three cued stops along a timed
     * path, dispatched from here through a pair of moving thresholds and a landing
     * latch; all of it existed to answer "where did the doors stop this time", and the
     * answer is now a constant. `paintStage` reads the three legs straight off the
     * scroll, so the only thing left to dispatch is the tail's cues.
     */
    function advance() {
      const vh = lastVh;

      // The opening's clock, which is the one cue at this end of the section. Held at 0
      // until the reader has actually scrolled — `advance` runs once at creation and on
      // every refresh, and firing there would play the whole opening at scroll zero.
      //
      // Direction decides it only *inside* the opening's own span. Past DOOR_OPEN_AT the
      // doors are simply open: the reader scrolling back up through the copy or the
      // ribbon is nowhere near this beat, and letting a reversal there start closing
      // them would shut the stage in the middle of the section. Below SEAL_AT they are
      // simply shut. Between the two — and only there — a reversal means the reader is
      // walking the opening backwards and wants it to run backwards, which is what
      // pairs with the `min` in paintStage.
      openPath(
        vh >= DOOR_OPEN_AT ? 1 : vh < SEAL_AT || scrollDir < 0 ? 0 : 1,
      );

      // The logo would end up over the revealed background, so this took it
      // ink → white straddling the seal — a change of surface rather than a third
      // event queued behind the other two. Disabled for now: the logo stays ink for
      // the whole scroll. Uncomment to restore the color swap.
      // gsap.set(logoEl, {
      //   backgroundColor: gsap.utils.interpolate(
      //     "#390303",
      //     "#ffffff",
      //     ramp(vh, [SEAL_AT, SEAL_AT + 30]),
      //   ),
      // });

      // Phases 1–3 in full — the opening's legs and the gap copy, all read straight
      // off the scroll — plus whatever the tail's cued tweens currently say.
      paintStage();

      // --- Phase 4: the ribbon — cued in paintStage, off the scroll.

      // --- Phase 5: the closing line, and Phase 6 the wash — both painted in
      // paintStage, off the close's progress rather than off scroll.

      // --- Phase 6: the doors close (cue) ---
      // A threshold like the wash's, crossed in either direction so scrolling back
      // up parts them again on the same timed move.
      //
      // The wash rides this rather than a mark of its own, so the gray follows the
      // panels meeting at every scroll speed. Which is also why the gray is a layer
      // over the top rather than a background-colour tween: the orange is painted
      // by three separate elements here (the section and both panels), and one
      // layer over them is a single number instead of three that have to agree.
      closeDoors(vh >= DOOR_CLOSE_AT);

      // --- Phase 7: a short guard on flat gray — already the next section's
      // colour, so the pin releasing is invisible.
    }

    // Published for the load timeline, which is the only thing that can tell this
    // sequence the entrance has released the stage.
    refs.catchUp.current = advance;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      // CSS `sticky` does not work here: ScrollSmoother fakes scrolling with a
      // transform on #smooth-content, and `sticky` never engages without a real
      // scrolling ancestor. GSAP's pin sets position:fixed via JS.
      pin: refs.stage.current,
      pinSpacing: false,
      // Every transform written here is a fraction of the viewport, so a resize
      // invalidates all of them — and a refresh does not imply a scroll event, so
      // without this the panels, the copy's seats and the closing line all held their
      // pre-resize geometry until the reader next moved.
      onRefresh() {
        W = document.documentElement.clientWidth;
        H = window.innerHeight;
        if (refs.introDone.current) paintStage();
      },
      onUpdate(self) {
        // Progress as real scroll distance through the pin, in vh, so each phase
        // reads as "from here to here" in scroll the user can feel.
        //
        // Recorded *before* the entrance gate, not after. This is the fix for the one
        // genuinely speed-dependent fault in the section: the gate used to return
        // early from the whole handler, so a reader who scrolled during the ~1.5s
        // entrance had every one of those events discarded. `lastVh` stayed at 0 while
        // the real scroll ran on, and two things followed. The stage sat frozen at its
        // entrance state under a pin the page was scrolling through; and when a later
        // event did arrive, `lastVh` jumped from 0 to wherever the reader now was, so
        // the opening fired as one continuous move from deep inside the section and
        // the doors could be asked to close in the same frame they opened. Slow
        // readers never saw it, fast ones saw it every time.
        //
        // Tracking the position costs nothing visual — `paintStage` is what writes to
        // the DOM, and that still waits.
        lastVh = self.progress * PIN_VH;
        trackDirection(lastVh);

        // The entrance owns the stage until it lands: it is a time-driven sequence and
        // must play at its designed duration however fast the reader scrolls through
        // it. ScrollTrigger also fires an onUpdate at creation, which without this
        // would snap the clip to its resting size and the headline to full opacity,
        // cutting the entrance short at frame one.
        //
        // `refs.catchUp` is what closes the gate safely. A scroll event is not
        // guaranteed to arrive after the entrance finishes — the scrub's own tween
        // settles about a second after the last input, and the entrance can easily
        // outlast that — so waiting for one could leave the stage frozen until the
        // reader happened to move again.
        //
        // `refs.hurryIntro` is what keeps the gate *short*. Waiting out a 1.5s fade
        // while the scroll runs on means handing over at 36vh at a reading pace and
        // 144vh past it, and the opening is only 20vh long — so the doors, the hole and
        // the lead line were all skipped by a reader who did nothing worse than scroll
        // early. Asking the entrance to finish quickly is the fix; idempotent, and it
        // nulls itself once it has landed.
        if (!refs.introDone.current) {
          if (lastVh > SEAL_AT) refs.hurryIntro.current?.();
          return;
        }

        advance();
      },
    });

    return () => {
      refs.catchUp.current = null;
      refs.hurryIntro.current = null;
      // Created inside onUpdate, so the context never collected them.
      bandTween?.kill();
      grayTween?.kill();
      closeTween?.kill();
      cueTween?.kill();
      trigger.kill();
    };
  }, section);
}
