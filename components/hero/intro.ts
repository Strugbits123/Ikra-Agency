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
 * Returns the caller's cleanup, or nothing under reduced motion, where the whole
 * job is three `gsap.set`s and there is no timeline to revert.
 */
export function playHeroIntro(
  box: HTMLDivElement,
  headline: HTMLParagraphElement,
  logo: HTMLSpanElement,
  introDone: RefObject<boolean>,
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
    // Held until the webfont has settled. `display: swap` means the first paint is
    // in the fallback face, and fading in across that metrics change is the other
    // half of the flicker. Waiting costs a few ms and the swap happens while the
    // headline is still fully transparent.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      ctx.add(() => {
        // Three plain opacity fades on absolute start times. The footage gets the
        // same treatment as the logo — nothing but opacity, on the same ease — just
        // over a slightly longer run, since it is a far larger area of the screen to
        // resolve.
        gsap
          .timeline({
            delay: 0.2,
            onComplete: () => {
              introDone.current = true;
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
}
