import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { DOOR_REST_X, DOOR_REST_Y, DOOR_SEALED_AT, holeClip } from "./doors";
import { BAND_CLIP_CLOSED, BAND_CLIP_FULL, BAND_CLIP_UNDRAWN } from "./band";
import { BACKGROUND_VISIBLE_AT_DOOR } from "./footage";
import { STACK_IN, STACK_OUT, leadSeat, leapSeat, stackSeat } from "./seats";
import {
  AJAR_SECONDS,
  BAND_CLOSE_AT,
  BAND_DRAW_AT,
  BAND_DRAW_SECONDS,
  BAND_HIDE_SECONDS,
  BAND_UNDRAW_AT,
  CLOSE_SEALED_P,
  CLOSE_SECONDS,
  COPY_END,
  COPY_SQUEEZE_MAX,
  DOOR_AJAR,
  DOOR_CLOSE_AT,
  DOOR_OPEN_AT,
  GAP_LINES,
  GRAY_HIDE_SECONDS,
  GRAY_SECONDS,
  LEAD_HOLD_VH,
  LEAD_OUT_AT,
  LEAP_AT,
  LEAP_IN_VH,
  OPENING_REVERSE_SPEED,
  OPEN_CUE_GAP_VH,
  OPEN_SECONDS,
  PIN_VH,
  SEAL_AT,
  SEAL_SECONDS,
  STOP_AJAR,
  STOP_OPEN,
  STOP_SHUT,
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
};

/**
 * The one scroll-driven sequence: one stage, one ScrollTrigger, so scrolling back
 * up reverses every phase. The beat-by-beat map is in ./timeline.
 *
 * Cued beats and scrubbed beats are mixed here, and the split is what makes that
 * safe: each cue drives a paused tween over a plain number, scrolling advances
 * `lastVh`, and `paintStage` is the *only* thing that reads either — so every
 * frame, whichever of them moved, is rendered from the current value of both.
 * Painting from inside the tweens instead would leave them and the scrubbed half
 * writing the same transforms from two places.
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
    // The ribbon's draw-in, kept off the scrub entirely (see BAND_DRAW_AT).
    // `shown` is the latched state, so crossing the cue fires the tween once
    // rather than restarting it on every scroll event past it.
    let shown = false;
    let bandTween: gsap.core.Tween | null = null;
    function drawBand(show: boolean) {
      const el = refs.ribbon.current;
      // Bailing before the latch flips matters: the ribbon only mounts once the
      // stage has been measured, so an early cue is retried, not swallowed.
      if (!el || show === shown) return;
      shown = show;
      const midFlight = bandTween?.isActive() ?? false;
      bandTween?.kill();
      // A finished close leaves the clip pinched at the opposite end from undrawn
      // (see BAND_CLIP_*), so it has to be moved back before it can draw again —
      // safe only because nothing is on screen then. `midFlight` catches a close
      // still running, where the draw instead reverses out of wherever it got to.
      if (show && !midFlight) gsap.set(el, { clipPath: BAND_CLIP_UNDRAWN });
      bandTween = gsap.to(el, {
        clipPath: show ? BAND_CLIP_FULL : BAND_CLIP_CLOSED,
        duration: show ? BAND_DRAW_SECONDS : BAND_HIDE_SECONDS,
        ease: show ? "power2.out" : "power2.in",
        overwrite: "auto",
      });
    }

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

    // The doors' return, cued the same way (see DOOR_CLOSE_AT). Its own tween and
    // not a fourth leg of the opening's path: the two are separated by the whole
    // middle of the section, so there is no flight either could interrupt, and the
    // close carries the wash and the closing line rather than the hole and the gap
    // copy.
    //
    // One cue and not two. Splitting it — half the travel on one scroll, the rest on
    // the next, mirroring the opening — was tried and reverted: the marks have to sit
    // about a notch apart, and a notch is crossed well inside the first leg's own
    // duration, so the second gesture retargets a tween that is still flying and the
    // panels skip the end of their travel. The opening survives that because its
    // legs are a *seal* and a *crack*, two different things; here both legs are the
    // same panels on the same path, and the join is the part you watch.
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
        duration: CLOSE_SECONDS * Math.abs(to - close.p),
        ease: "power2.inOut",
        onUpdate: paintStage,
        overwrite: "auto",
      });
    }

    // --- The opening, all three legs of it off the scrub (see SEAL_AT) ---
    const seal = { p: 0 };
    const crack = { p: 0 };
    const swing = { p: 0 };
    let lastVh = 0;
    // Which way the reader is going: 1 down, −1 up. The band's cue is the only thing
    // that reads it, and it needs to survive being called from a tween's onUpdate
    // rather than from the scroll — hence a stored value and not `self.direction`.
    let scrollDir = 1;

    /**
     * Where the first cued move flips — in *both* directions. SEAL_AT until the move
     * has landed, and from then on the scroll position it landed at.
     *
     * A fixed threshold is only correct going down, and the sequence stalled on the
     * way back up because of it. The move is timed, so going down it plays across
     * however much scroll the visitor covers during its 1.6s — landing at 40vh at a
     * moderate pace, far later on a flick — and everything keyed to the landing
     * reverses only back to that point, leaving the stretch between SEAL_AT and the
     * landing empty on the way up: doors frozen a crack open, lead line frozen at a
     * fifth of its size, for 30vh at a reading pace and over 100 after a flick.
     *
     * Latching the landing keeps the threshold model and fixes it — the move
     * reverses the moment the scroll drops below where the doors came to rest.
     *
     * Deliberately *not* reset when the move reverses: that would drop the threshold
     * back to 8 while the scroll is still at 30, re-satisfying `vh >= cueAt` and
     * re-opening the doors next frame — trading the stall for a loop. It resets when
     * the scroll actually reaches the top instead (below).
     */
    let cueAt = SEAL_AT;

    /**
     * Where the *second* cued move flips, on the same model and for the same reason:
     * a notch of scroll past wherever the crack landed, floored at DOOR_OPEN_AT.
     *
     * Null until the crack has landed, which is what keeps the two cues from ever
     * firing as one on a slow pass — there is no mark to cross until leg 2 is done,
     * so however far the scroll has already run, the swing starts from rest with the
     * hole shut and the crack finished.
     *
     * Unlike `cueAt` this one needs no separate latch for the way back up: the swing
     * costs no scroll and nothing downstream is keyed to a mark inside it, so
     * reversing at the same place it fired is exactly right — the doors are fully
     * open everywhere above it and at the crack everywhere below.
     */
    let openCueAt: number | null = null;

    /**
     * Where the swing came to rest, latched on arrival — the doors' true stop, and
     * what the copy sequence measures itself from. Null while they are anywhere short
     * of fully open (see `restVh`).
     */
    let openLandedVh: number | null = null;

    function paintStage() {
      const W = document.documentElement.clientWidth;
      const H = window.innerHeight;
      const vh = lastVh;

      // --- Phase 1: the hole seals over the footage (fires at 8vh) ---
      // The box is neither scaled nor moved — only the window it is seen through
      // closes, and only in width. A clip costs no layout work, and this owns it
      // outright: the load timeline animates opacity only and leaves the hole open,
      // so seal.p = 0 is already the state the entrance faded up into.
      gsap.set(box, { clipPath: holeClip(seal.p) });

      // Same driver rather than a window of its own, so the copy is gone at the
      // exact moment the hole seals.
      gsap.set(refs.headline.current, { opacity: 1 - seal.p });

      // Nothing of this footage is on screen for the remaining nine-plus viewports
      // of the pin.
      const clip = refs.clipVideo.current;
      if (clip) {
        const shut = seal.p >= 1;
        if (shut !== refs.clipSealed.current) {
          refs.clipSealed.current = shut;
          if (shut) clip.pause();
          else void clip.play().catch(() => { });
        }
      }

      // --- Phase 3: the doors, and the copy they hand over to ---
      //
      // How far open they are, from the two legs that carry them out: the crack,
      // capped at DOOR_AJAR, and the swing that covers the rest. Summed rather than
      // switched between, so there is no frame where one hands over to the other.
      //
      // Neither term is scrubbed — both are read straight off `head.t` (see
      // readHead), and the sum lives here only because the door *close* below still
      // is, and both ends have to write the same transform from one place.
      const doorP = crack.p + swing.p;

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

      // Where the doors come to rest, live: the latched landing once the swing has
      // arrived, and before that a value held at or ahead of the scroll — so the copy
      // cannot start while the doors are still moving, and the handover is continuous
      // rather than a jump, since `openLandedVh` is set to `vh` at the very instant
      // this expression equals it.
      const restVh = openLandedVh ?? Math.max(vh, openCueAt ?? DOOR_OPEN_AT);

      // The copy's own clock. Starts where the doors actually stopped plus the same
      // beat of rest, ends at COPY_END whatever happened, so a late start squeezes
      // the sequence rather than sliding the whole tail of the section back (see
      // COPY_SQUEEZE_MAX). Identity in the ordinary case.
      const from = Math.min(
        LEAD_OUT_AT + (COPY_END - LEAD_OUT_AT) * COPY_SQUEEZE_MAX,
        Math.max(LEAD_OUT_AT, restVh + LEAD_HOLD_VH),
      );
      const copyVh =
        LEAD_OUT_AT +
        ((vh - from) * (COPY_END - LEAD_OUT_AT)) / (COPY_END - from);

      // Every line passes through the same centre seat, each rising into it as the
      // one before leaves upward (see stackSeat) — except the lead line, which grows
      // into it with the doors and then leaves like the rest. Driven straight off
      // GAP_LINES rather than line by line, so the choreography is identical across
      // all of them by construction.
      for (let i = 0; i < GAP_LINES.length; i++) {
        const line = GAP_LINES[i];
        const outP = STACK_OUT(ramp(copyVh, line.out));
        gsap.set(
          refs.gapLines.current[i],
          line.in
            ? stackSeat(H, STACK_IN(ramp(copyVh, line.in)), outP)
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
      // The draw is measured in `copyVh` and the close in raw `vh`, which is the
      // whole reason this call lives here rather than in onUpdate. The draw overlaps
      // the last line's exit deliberately (see BAND_OVERLAP) and so has to be on the
      // clock that line is on — in raw vh it drifted earlier against the copy on
      // every pass that squeezed it, which is every pass where the doors did not stop
      // at their nominal mark. The close is long past the copy and has nothing to
      // stay level with, so it keeps the scroll's own clock.
      //
      // Two marks, picked by the direction of travel: the wave commits at
      // BAND_DRAW_AT going down and lets go at the higher BAND_UNDRAW_AT coming back
      // up. One mark cannot do both — see BAND_UNDRAW_AT for why the overlap that
      // reads as a handover downward reads as a collision in reverse.
      //
      // Keyed to `scrollDir` and emphatically *not* to the latch. Choosing the mark by
      // `shown` looks like hysteresis and is its inverse: the release mark sits
      // *above* the commit mark, so un-drawing at 212 drops the test to 191, which
      // `copyVh` still satisfies, which draws again, which restores 212 — a flip every
      // frame, each one killing the tween before it can play. The wave did not close,
      // it strobed. Direction is stable across a stopped scroll, so this cannot
      // oscillate: only a genuine reversal changes the mark, and the latch absorbs
      // the rest.
      drawBand(
        copyVh >= (scrollDir < 0 ? BAND_UNDRAW_AT : BAND_DRAW_AT) &&
          vh < BAND_CLOSE_AT,
      );

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
      gsap.set(
        refs.leap.current,
        leapSeat(
          H,
          STACK_IN(ramp(vh, [LEAP_AT, LEAP_AT + LEAP_IN_VH])),
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

    // --- The opening: one number, three resting points ---
    //
    // `head.t` is a position along that path, measured in seconds (see SEAL_AT), and
    // `readHead` is the only thing that writes seal.p, crack.p and swing.p. A tween
    // per leg was the alternative, and it has a race in it that this does not: three
    // tweens would own the same property whenever one started before another had
    // finished. Here there is only ever one tween, over one number, and a cue crossed
    // mid-flight just changes where it is heading.
    //
    // Which is why the second gesture's swing is a *leg of this path* rather than a
    // move of its own, even though it is cued separately: a flick that crosses both
    // marks in quick succession retargets the one tween from STOP_AJAR to STOP_OPEN
    // and the doors carry on out at the same rate, with nothing to collide with.
    const head = { t: STOP_SHUT };
    const LEG_EASE = gsap.parseEase("power2.inOut");

    function readHead() {
      const t = head.t;
      seal.p = LEG_EASE(gsap.utils.clamp(0, 1, t / SEAL_SECONDS));
      // Each leg starts exactly where the one before it ends, so the hole is shut
      // before the panels move and the crack is complete before the swing begins.
      crack.p =
        DOOR_AJAR *
        LEG_EASE(gsap.utils.clamp(0, 1, (t - SEAL_SECONDS) / AJAR_SECONDS));
      swing.p =
        (1 - DOOR_AJAR) *
        LEG_EASE(gsap.utils.clamp(0, 1, (t - STOP_AJAR) / OPEN_SECONDS));
    }

    let travel: gsap.core.Tween | null = null;
    let stop = STOP_SHUT;
    function openTo(next: number) {
      if (next === stop) return;
      const back = next < stop;
      stop = next;
      // Anything short of fully open un-lands the swing, so the copy's clock goes
      // back to tracking the scroll rather than a stop that no longer holds.
      if (next !== STOP_OPEN) openLandedVh = null;
      // Going back to shut also drops the second cue's mark, so a fresh pass down
      // re-measures it from wherever *that* pass's crack lands rather than from the
      // first one's.
      if (next === STOP_SHUT) openCueAt = null;
      travel?.kill();
      travel = gsap.to(head, {
        t: next,
        // Proportional to the ground left to cover, which is what keeps the rate the
        // same whether this is a whole leg, the remainder of one interrupted
        // mid-flight, or both legs at once.
        duration: Math.abs(next - head.t) / (back ? OPENING_REVERSE_SPEED : 1),
        // The easing lives in readHead, one curve per leg. An ease here would ease
        // the *path* as well and double up on it.
        ease: "none",
        onUpdate: () => {
          readHead();
          paintStage();
        },
        // Only on arrival: a move killed mid-flight never gets here, which is
        // correct — nothing has landed.
        onComplete: () => {
          if (next === STOP_OPEN) {
            openLandedVh = lastVh;
            return;
          }
          // `!back` matters now that STOP_AJAR is reachable from both sides: coming
          // back down off a reversed swing, re-marking `cueAt` to the current scroll
          // would put the crack's own threshold level with the scroll and flap the
          // doors between shut and ajar on alternate frames.
          if (next !== STOP_AJAR || back) return;
          // Where the crack landed, which from here is both where it reverses and
          // what the second cue is measured out from. Deliberately the raw landing
          // and not a floored one: a threshold sitting *ahead* of the scroll would
          // fire the reverse the instant the move finished.
          cueAt = lastVh;
          openCueAt = Math.max(DOOR_OPEN_AT, lastVh + OPEN_CUE_GAP_VH);
        },
      });
    }

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
      onUpdate(self) {
        // ScrollTrigger fires an onUpdate at creation; without this guard it would
        // snap the clip straight to its resting size and cut the entrance short.
        if (!refs.introDone.current) return;

        // Progress as real scroll distance through the pin, in vh, so each phase
        // reads as "from here to here" in scroll the user can feel.
        const vh = self.progress * PIN_VH;
        scrollDir = self.direction;
        // The one piece of scroll state paintStage reads. Set before the cues, since
        // firing one paints immediately.
        lastVh = vh;

        // Two cues, two moving thresholds, one move. The first scroll seals the hole
        // and cracks the doors (see SEAL_AT); the second swings them the rest of the
        // way (see OPEN_CUE_GAP_VH). Both are crossed in either direction, so
        // scrolling back up walks the same legs backwards, and both reverse from
        // where they landed rather than from a fixed mark — see `cueAt` for why a
        // fixed one stalled the whole sequence.
        //
        // Written as one target rather than two `if`s: the tween's stop is a position
        // along a single path, so the only question each frame is which of the three
        // the scroll is currently asking for. A flick that crosses both marks in a
        // frame asks for STOP_OPEN directly and gets one continuous move to it.
        //
        // Reset first: once the scroll is back at the top the move has nowhere left
        // to reverse to, so the next pass down is cued from the nominal mark exactly
        // as the first one was.
        if (vh <= SEAL_AT) cueAt = SEAL_AT;
        openTo(
          vh < cueAt
            ? STOP_SHUT
            : openCueAt !== null && vh >= openCueAt
              ? STOP_OPEN
              : STOP_AJAR,
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

        // Everything those two tweens and the scrubbed door close share, from
        // whatever the three of them currently say.
        paintStage();

        // --- Phase 4: the ribbon — cued in paintStage, off the copy's clock.

        // --- Phase 5: the closing line, and Phase 6 the wash — both painted in
        // paintStage, off the close's progress rather than off scroll.

        // --- Phase 6: the doors close (cue, fires at 390vh) ---
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
      },
    });

    return () => {
      // Created inside onUpdate, so the context never collected them.
      bandTween?.kill();
      grayTween?.kill();
      closeTween?.kill();
      travel?.kill();
      trigger.kill();
    };
  }, section);
}
