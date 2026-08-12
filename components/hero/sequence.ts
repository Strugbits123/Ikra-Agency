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
  COPY_END,
  COPY_SQUEEZE_MAX,
  DOOR_AJAR,
  DOOR_CLOSE_AT,
  DOOR_CLOSE_VH,
  DOOR_OPEN_AT,
  DOOR_SCRUB_VH,
  GAP_LINES,
  GRAY_AT,
  GRAY_HIDE_SECONDS,
  GRAY_SECONDS,
  LEAD_HOLD_VH,
  LEAD_OUT_AT,
  LEAP_AT,
  LEAP_IN_VH,
  LEAP_OUT_AT,
  LEAP_OUT_VH,
  OPENING_REVERSE_SPEED,
  PIN_VH,
  SEAL_AT,
  SEAL_SECONDS,
  STOP_AJAR,
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

    // The orange→gray turn-over, latched the same way (see GRAY_AT).
    //
    // Simpler than the ribbon in one respect: the hidden state *is* opacity 0, so
    // there is no parked-at-the-wrong-end problem to undo first and no `midFlight`
    // case — a reversal just tweens back from wherever it reached.
    //
    // `sine.inOut` both ways: this is a full-screen change of colour, so it has to
    // leave and arrive at zero velocity or the turn-over announces itself at one
    // end. The reverse is faster because it is racing the doors parting underneath
    // it (see GRAY_LEAD_VH), not because it should feel different.
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

    // --- The opening two beats, both off the scrub (see SEAL_AT) ---
    const seal = { p: 0 };
    const crack = { p: 0 };
    let lastVh = 0;
    // Where the doors' scrubbed leg measures from: null until the cued move has
    // landed, so that leg cannot contribute while the hole is still closing (see
    // DOOR_OPEN_AT).
    let armVh: number | null = null;

    /**
     * Where the cued move flips — in *both* directions. SEAL_AT until the move has
     * landed, and from then on the scroll position it landed at.
     *
     * A fixed threshold is only correct going down, and the sequence stalled on the
     * way back up because of it. The move is timed, so going down it plays across
     * however much scroll the visitor covers during its 1.6s — landing at 40vh at a
     * moderate pace, far later on a flick — and the doors' scrubbed leg starts from
     * where it landed (`armVh`), so it too reverses only back to that point. That
     * left the stretch between SEAL_AT and the landing empty on the way up: doors
     * frozen a crack open, lead line frozen at a fifth of its size, for 30vh at a
     * reading pace and over 100 after a flick.
     *
     * Latching the landing keeps the threshold model and fixes it — the move
     * reverses the moment the scroll drops below where the doors came to rest, which
     * is also where the scrubbed leg reaches zero, so the seam is continuous.
     *
     * Deliberately *not* reset when the move reverses: that would drop the threshold
     * back to 8 while the scroll is still at 30, re-satisfying `vh >= cueAt` and
     * re-opening the doors next frame — trading the stall for a loop. It resets when
     * the scroll actually reaches the top instead (below).
     */
    let cueAt = SEAL_AT;

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
      // How far open they are, from the two halves that drive them: the cued crack
      // and the scrubbed remainder. Summed rather than switched between, so there is
      // no frame where one hands over to the other — the first term is capped at
      // DOOR_AJAR and the second starts from zero, and a fast scroll that begins the
      // second while the first is still flying simply opens them sooner instead of
      // jumping.
      //
      // `sine.inOut` on the scrubbed half so it leaves the crack at rest and arrives
      // at rest, matching the copy's arrivals (see STACK_IN).
      const doorP =
        crack.p +
        (1 - DOOR_AJAR) *
          (armVh === null
            ? 0
            : STACK_IN(ramp(vh, [armVh, armVh + DOOR_SCRUB_VH])));

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

      // Where the doors will come to rest, live: `armVh` once the cued move has
      // landed, and the same expression `armVh` is about to be set to before that —
      // so this is continuous across the landing instead of jumping to it, and the
      // copy cannot start while the move is still flying.
      const restVh = Math.max(DOOR_OPEN_AT, armVh ?? vh) + DOOR_SCRUB_VH;

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

      // The panels, on `doorP` going out and closing again on scroll at the end.
      // Each slides out while drifting vertically, the drift finishing ahead of the
      // slide (hence `/0.7`).
      //
      // The close is not a second animation: `doorNow` is the opening's own progress
      // scaled back to zero, so the panels retrace the exact path they came out on.
      // Note the copy rides `doorP`, not this — it must stay gone while the doors
      // return, not play itself backwards.
      const closeP = ramp(vh, [DOOR_CLOSE_AT, DOOR_CLOSE_AT + DOOR_CLOSE_VH]);
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

    // --- The cued half of the opening: one number, two resting points ---
    //
    // `head.t` is a position along that path, measured in seconds (see SEAL_AT), and
    // `readHead` is the only thing that writes seal.p and crack.p. A tween per leg
    // was the alternative, and it has a race in it that this does not: two tweens
    // would own the same property whenever one started before the other had
    // finished. Here there is only ever one tween, over one number, and the cue
    // crossed mid-flight just changes where it is heading.
    const head = { t: STOP_SHUT };
    const LEG_EASE = gsap.parseEase("power2.inOut");

    function readHead() {
      const t = head.t;
      seal.p = LEG_EASE(gsap.utils.clamp(0, 1, t / SEAL_SECONDS));
      // Only as far as DOOR_AJAR: the rest of the doors' travel is scrubbed and is
      // added to this in paintStage. Leg 2 starts exactly where leg 1 ends, so the
      // hole is shut before the panels move.
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
        // Only on arrival, and only at the open end: this is the promise that the
        // doors' scrubbed leg starts from rest, at zero progress, with the hole
        // already shut. A move killed mid-flight never gets here, which is correct —
        // nothing has landed.
        onComplete: () => {
          if (next !== STOP_AJAR) return;
          armVh = Math.max(DOOR_OPEN_AT, lastVh);
          // Where it landed, which from here is also where it reverses. Not armVh:
          // that one is floored at DOOR_OPEN_AT and so can sit *ahead* of the scroll
          // on a slow pass, and a threshold ahead of the scroll would fire the
          // reverse the instant the move finished.
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
        const H = window.innerHeight;
        // The one piece of scroll state paintStage reads. Set before the cues, since
        // firing one paints immediately.
        lastVh = vh;

        // One cue, one moving threshold: the hole sealing and the doors cracking are
        // a single move that plays at its own speed (see SEAL_AT), crossed in either
        // direction so scrolling back up walks the same move backwards. Going up it
        // reverses from where it landed rather than from SEAL_AT — see `cueAt` for
        // why a fixed mark stalled the whole sequence there. The doors' remaining
        // travel is scrubbed, in paintStage.
        //
        // Reset first: once the scroll is back at the top the move has nowhere left
        // to reverse to, so the next pass down is cued from the nominal mark exactly
        // as the first one was.
        if (vh <= SEAL_AT) cueAt = SEAL_AT;
        openTo(vh >= cueAt ? STOP_AJAR : STOP_SHUT);

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

        // --- Phase 4: the ribbon draws in, holds, and clears (303 – 363vh) ---
        // Not scrubbed: each end of the span fires a tween that runs to completion
        // on its own clock, so the wedges are always at rest before it starts and it
        // can never be left frozen half-drawn. Expressed as a span so it behaves the
        // same crossed either way.
        drawBand(vh >= BAND_DRAW_AT && vh < BAND_CLOSE_AT);

        // --- Phase 5: the closing line takes its place (398 – 559vh) ---
        // Seated where the ribbon was, not below it, so the wave resolves into the
        // words. It arrives like the gap copy but recedes instead of fading (see
        // leapSeat), scaling to nothing across the door close so it reads as going
        // back through the gap the panels are shutting.
        //
        // The exit takes the raw ramp deliberately — no STACK_OUT. The eased version
        // holds the line near full size early, which is exactly when the panels are
        // already advancing on it.
        gsap.set(
          refs.leap.current,
          leapSeat(
            H,
            STACK_IN(ramp(vh, [LEAP_AT, LEAP_AT + LEAP_IN_VH])),
            ramp(vh, [LEAP_OUT_AT, LEAP_OUT_AT + LEAP_OUT_VH]),
          ),
        );

        // --- Phase 6: the doors close (468 – 593vh), driven in paintStage ---

        // --- Phase 7: orange turns over to gray (fires at 574vh) ---
        // Cued just past SEALED_AT rather than off the door close, because the
        // panels seal 34vh before they stop moving and all of that is travel with no
        // visible edges in it.
        //
        // Not scrubbed: crossing this threshold in either direction fires a tween
        // that runs to completion (see washGray). A threshold and not a span like
        // the ribbon's, because nothing past it ever takes the gray back off — the
        // pin's own end is the only upper bound it needs.
        //
        // A gray layer over the top rather than a background-colour tween: the
        // orange is painted by three separate elements here (the section and both
        // panels), and one layer over them is a single number instead of three that
        // have to agree.
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
}
