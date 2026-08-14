import { gsap } from "@/lib/gsap";
import { ramp } from "./timeline";

/**
 * A move played by a clock and bounded by the scroll — the shape both the opening and
 * the closing of the doors need, and the one thing in this section that is genuinely
 * hard to get right.
 *
 * A pure cue is what you want to watch: one gesture, one speed, never parked half
 * done however small the scroll that started it. What a pure cue cannot do is finish
 * anywhere in particular, because the reader keeps scrolling while it plays — so it
 * lands at a mark that depends on their speed, and if the section runs out underneath
 * it, it is simply cut off. The closing had exactly that fault: 1.15s of move with
 * 5vh of pinned scroll behind it, so at any ordinary reading pace the pin released
 * with the doors about a seventh shut and the whole gesture scrolled away unseen.
 *
 * A pure scrub has the opposite pair: it always finishes exactly where it should and
 * it never plays, because a wheel notch is ~11vh and no span a door can visibly swing
 * across fits inside one.
 *
 * So: the clock may run **ahead** of the scroll and never behind it.
 *
 *     p = dir > 0 ? max(clock, ramp(vh)) : min(clock, ramp(vh))
 *
 * Below the crossover speed (`span / seconds`) the clock leads and the reader gets
 * the whole designed move. Above it the scroll leads and the move finishes in
 * whatever distance is left — quicker, but continuous, and bounded either way, so
 * everything keyed below the span stays a fixed number.
 *
 * ## Why the bound is offset
 *
 * Swapping `max` for `min` at a reversal is where this goes wrong, and it is not
 * obvious. The clock is allowed to be far ahead of the ramp, so at the instant the
 * direction flips the value being clamped and the bound clamping it can disagree by
 * almost the whole range — and the swap pays that difference in a single frame. On
 * the opening that was the doors reading fully open at 17vh and snapping to 0.18 the
 * moment the reader nudged back up.
 *
 * `offset` holds the ramp on the rendered position across the flip, so both sides of
 * the swap agree there and it is invisible. `rebase` also re-anchors the clock on the
 * same value — both are needed, since the offset alone leaves the clock ahead and the
 * flip back down jumps to *it* instead. The offset then bleeds off at the ramp's own
 * rate as the reader commits to a direction, so the span's end is a hard mark again
 * within `span · |offset|` of travel. The guarantee is only ever suspended while the
 * reader is undoing their own scroll.
 *
 * Returns raw progress. Easing is the caller's, applied on read rather than put on
 * the tween: an eased tween retargeted mid-flight re-eases from its new start, which
 * stutters at exactly the moment this shape exists to keep smooth. It also lets one
 * cue be read through two different eases, which the opening does.
 */
export type FlooredCue = {
  /** This frame's bounded progress, and the value a later `rebase` anchors on. */
  read(vh: number, dir: number): number;
  /** Point the clock at `to`. Idempotent, so it is safe to call every frame. */
  aim(to: number): void;
  /** Re-anchor clock and bound on what is on screen. Call when the direction flips. */
  rebase(vh: number): void;
  kill(): void;
};

export function createFlooredCue({
  span,
  seconds,
  reverseSpeed,
  onUpdate,
}: {
  /** The scroll window the move is floored against, in vh. */
  span: readonly [number, number];
  /** How long the move takes when the reader is not outrunning it. */
  seconds: number;
  /** Multiplier on the return leg's speed. Below 1 makes coming back slower. */
  reverseSpeed: number;
  /** Called on every frame of the clock, so the caller can repaint. */
  onUpdate: () => void;
}): FlooredCue {
  const vhSpan = span[1] - span[0];

  const clock = { p: 0 };
  // NaN after a rebase, so the next `aim` always retargets even when the target it
  // computes is the one already stored — see rebase.
  let aimed: number = 0;
  let tween: gsap.core.Tween | null = null;

  /** How far the rendered value sits from where the raw ramp alone would put it. */
  let offset = 0;
  let offsetVh = 0;
  /** Last rendered position, which is what a reversal re-anchors on. */
  let now = 0;

  return {
    aim(to: number) {
      if (to === aimed) return;
      aimed = to;
      tween?.kill();
      tween = gsap.to(clock, {
        p: to,
        // Proportional to the ground left, so a reversal partway runs back at the
        // rate it came out at rather than taking the full duration to cover a sliver.
        duration:
          (seconds * Math.abs(to - clock.p)) / (to < clock.p ? reverseSpeed : 1),
        // Linear on purpose — the ease is applied when the value is read.
        ease: "none",
        onUpdate,
        overwrite: "auto",
      });
    },

    rebase(vh: number) {
      offset = now - ramp(vh, span);
      offsetVh = vh;
      tween?.kill();
      clock.p = now;
      // Forces the retarget on the next `aim`: without it a flip that leaves the
      // target unchanged would kill the tween and never start another, freezing the
      // move partway.
      aimed = NaN;
    },

    read(vh: number, dir: number) {
      // Bleed the offset off at the same rate the ramp itself moves, so the bound
      // converges back onto the true ramp rather than being permanently displaced by
      // one change of mind. A no-op when called twice in a frame, since nothing moved.
      const moved = Math.abs(vh - offsetVh);
      offsetVh = vh;
      if (offset !== 0) {
        const left = Math.max(0, Math.abs(offset) - moved / vhSpan);
        offset = offset < 0 ? -left : left;
      }

      const bound = gsap.utils.clamp(0, 1, ramp(vh, span) + offset);
      now = dir < 0 ? Math.min(clock.p, bound) : Math.max(clock.p, bound);
      return now;
    },

    kill() {
      tween?.kill();
    },
  };
}
