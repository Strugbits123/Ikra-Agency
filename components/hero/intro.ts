import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { holeClip } from "./doors";

/**
 * The load sequence: plays once on mount and is not scroll-driven. The hole opens
 * up over the footage, then the headline fades in.
 *
 * Sets `introDone` when it lands, which is what gates the scroll phases —
 * ScrollTrigger fires an onUpdate at creation, and without the gate it would snap
 * the clip straight to its resting size and cut this short.
 *
 * Then calls `catchUp`, and that call is not optional. Flipping the latch alone leaves
 * the sequence waiting for a scroll event to notice, and none is owed: the scrub's
 * tween settles about a second after the reader's last input and this timeline can
 * outlast it comfortably. Anyone who scrolled during the entrance and stopped would be
 * left looking at a frozen stage until they moved again. One edge-triggered call hands
 * the stage over at the true scroll position instead.
 *
 * And it publishes `hurry`, which the sequence calls the moment the reader scrolls past
 * the opening's first mark. That is the other half of handing over cleanly, and it
 * became necessary when the opening stopped being cued. The stage is frozen here until
 * this lands, so the scroll runs on underneath it — and where a cued opening would then
 * play its move from the beginning whatever the position, a scrubbed one is *read* from
 * the position, so the hand-off painted the doors wherever the reader had already got
 * to. They snapped from shut to half open at a reading pace, and to fully open past it,
 * taking the gap copy's first line with them. Hurrying the entrance keeps the hand-off
 * down at the top of the section where there is nothing to skip. It is not a
 * cancellation: a reader who has started scrolling has said they are done looking at
 * the fade, and the fade still finishes, at 6×.
 *
 * Returns the caller's cleanup, or nothing under reduced motion, where the whole
 * job is three `gsap.set`s and there is no timeline to revert.
 */
const HURRY_SCALE = 6;

export function playHeroIntro(
  box: HTMLDivElement,
  headline: HTMLParagraphElement,
  logo: HTMLSpanElement,
  introDone: RefObject<boolean>,
  catchUp: RefObject<(() => void) | null>,
  hurry: RefObject<(() => void) | null>,
  reducedMotion: boolean,
): (() => void) | undefined {
  if (reducedMotion) {
    // No ScrollTrigger runs in this mode, so only the clip and the hero headline —
    // which exist purely to be animated — are hidden here. The centre copy renders
    // as a plain static column instead (see the JSX). The logo stays visible: it's
    // the page header, not an animated aside. It renders hidden because nothing
    // knows which mode this is until after mount, so showing it is this branch's
    // job — there is no load timeline here to do it.
    gsap.set(logo, { opacity: 1 });
    gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0 });
    gsap.set(box, { opacity: 0 });
    introDone.current = true;
    return;
  }

  const ctx = gsap.context(() => {
    // The clip window starts fully *open* and is not animated here — only opacity
    // is, exactly as for the logo below. This used to animate the hole shut→open,
    // and that reveal is what made the footage read as arriving abruptly no matter
    // how the opacity was tuned: a mask edge travelling across the picture is a
    // wipe, and a wipe cannot be eased into a fade. The hole is the scroll phase's
    // to drive, and that already expects it fully open at scroll 0.
    //
    // Neither of these touches a transform, so the Tailwind translate classes keep
    // doing the centering untouched.
    gsap.set(box, { clipPath: holeClip(0), opacity: 0 });
    // The header logo, same treatment. The markup already starts it hidden; this
    // only restates it, so `ctx.revert()` has a value to put back and the timeline
    // below has an explicit floor to fade up from. Hiding it *here alone* was the
    // bug: this runs after mount, so it cannot run until the wordmark has already
    // been painted opaque.
    gsap.set(logo, { opacity: 0 });
    // GSAP owns the headline's centring and the classes deliberately don't: the
    // first transform GSAP writes replaces the whole inline transform, so a
    // class-based `-translate-y-1/2` would be wiped the instant `y` is touched,
    // dropping the line half its height as it fades in.
    gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 0, y: 16 });

    let cancelled = false;
    let tl: gsap.core.Timeline | null = null;
    let hurried = false;

    const land = () => {
      introDone.current = true;
      hurry.current = null;
      // Hands the stage to the scroll sequence at whatever position the reader has
      // actually reached — see the note above on why the latch alone is not enough.
      // Null only under reduced motion, where no sequence exists.
      catchUp.current?.();
    };

    hurry.current = () => {
      if (hurried) return;
      hurried = true;
      if (tl) {
        // `delay` is measured in the parent timeline and timeScale does not touch it,
        // so it has to go separately or the hand-off still waits 0.2s.
        tl.delay(0);
        tl.timeScale(HURRY_SCALE);
        return;
      }
      // Nothing to speed up yet: the wait on the webfont below has not resolved, which
      // is where a flick lands. Straight to the end state instead — the swap this is
      // all guarding against is only visible on a still page, and this one is moving.
      gsap.set([box, logo], { opacity: 1 });
      gsap.set(headline, { xPercent: -50, yPercent: -50, opacity: 1, y: 0 });
      land();
    };

    // Held until the webfont has settled. `display: swap` means the first paint is
    // in the fallback face, and fading in across that metrics change is the other
    // half of the flicker. Waiting costs a few ms and the swap happens while the
    // headline is still fully transparent.
    document.fonts.ready.then(() => {
      if (cancelled || introDone.current) return;
      ctx.add(() => {
        // Three plain opacity fades on absolute start times. The footage gets the
        // same treatment as the logo — nothing but opacity, on the same ease — just
        // over a slightly longer run, since it is a far larger area of the screen to
        // resolve.
        tl = gsap
          .timeline({ delay: 0.2, onComplete: land })
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
      hurry.current = null;
    };
  });

  return () => ctx.revert();
}
