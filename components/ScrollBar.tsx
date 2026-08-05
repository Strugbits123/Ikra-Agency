"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap, ScrollTrigger, ScrollSmoother } from "@/lib/gsap";

/**
 * Width of the visible pill, and of the invisible strip around it that catches
 * the pointer. The two are deliberately different: a 6px pill is the look, but a
 * 6px drag target is a nuisance, so the thumb element is HIT_W wide with the pill
 * centred inside it.
 */
const PILL_W = 6;
const HIT_W = 18;
/** Gap from the top, bottom and right edges of the viewport, in px. */
const INSET = 6;
/**
 * Shortest the thumb is allowed to get. Without a floor it becomes a few pixels
 * tall on this site — the pinned sections make the page some 13 viewports long —
 * and a thumb that small is neither visible nor grabbable.
 */
const MIN_THUMB = 56;

/**
 * The page's scrollbar, drawn rather than styled.
 *
 * The native one is hidden (see globals.css) because its *track* cannot be made
 * to show the page. A classic scrollbar occupies a gutter outside the viewport's
 * content area, and ScrollSmoother fixes #smooth-wrapper to that content area, so
 * no section can reach into the gutter: a "transparent" track there falls through
 * to the canvas — the body's background — and the best it can do is be painted a
 * colour that happens to match whatever section is on screen. That works until
 * the next section arrives in a new colour, at which point the match has to be
 * taught about it.
 *
 * This has nothing to teach. There is no track element at all — only a thumb
 * floating over the page — so whatever is behind it *is* the background, at every
 * scroll position, for any section added later. That is the whole reason for
 * replacing a native control rather than restyling it.
 *
 * Portaled to document.body because `position: fixed` does not work inside
 * ScrollSmoother's transformed #smooth-content — a transformed ancestor becomes
 * the containing block for fixed descendants, so it would scroll with the page.
 * Same reason, and the same fix, as the custom cursor in HeroNarrative.
 */
export default function ScrollBar() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const thumb = thumbRef.current;
    if (!thumb) return;

    // Layout figures, refreshed on ScrollTrigger's own refresh rather than from a
    // resize listener of this component's own: the page's scrollable height is
    // decided by the pinned sections, so ScrollTrigger recalculating is precisely
    // the moment these change — including when a pin is added or its length
    // shifts, which no resize event would announce.
    let travel = 0;
    let maxScroll = 0;

    const measure = () => {
      maxScroll = ScrollTrigger.maxScroll(window);
      const trackH = window.innerHeight - INSET * 2;
      // The thumb's share of the track is the viewport's share of the document,
      // which is `innerHeight / (innerHeight + maxScroll)` — maxScroll being the
      // scrollable *distance*, one viewport short of the document's height.
      const visible = maxScroll
        ? window.innerHeight / (window.innerHeight + maxScroll)
        : 1;
      const thumbH = Math.max(MIN_THUMB, Math.round(trackH * visible));
      // How far the thumb itself can move, which is not the track's height. Kept
      // as the conversion factor for both directions: progress → thumb position
      // here, and drag distance → scroll position below.
      travel = trackH - thumbH;
      // Hidden outright when there is nothing to scroll, which is what a native
      // scrollbar does — otherwise it would sit there full-height, indicating a
      // scroll position it cannot have.
      gsap.set(thumb, { height: thumbH, opacity: maxScroll ? 1 : 0 });
    };

    /**
     * Where the page is *drawn*, which is not where it has been scrolled to.
     *
     * ScrollSmoother eases the content towards the native scroll position over
     * `smooth` seconds, so for that long the two disagree — and neither
     * `window.scrollY` nor the smoother's own `progress` is the drawn one; both are
     * the input. The drawn position is the transform GSAP is animating on the
     * content, and reading it back is what makes the thumb agree with the screen
     * instead of arriving somewhere before the page does.
     *
     * It is also a free read: GSAP caches the transform it is driving on the
     * element, so this never touches layout.
     */
    const drawnScroll = () => {
      const smoother = ScrollSmoother.get();
      if (!smoother) return window.scrollY;
      // The content is translated *up* as the page goes down, so its y is the
      // negative of the scroll offset.
      return -Number(gsap.getProperty(smoother.content(), "y"));
    };

    const update = () => {
      if (!maxScroll) return;
      const p = gsap.utils.clamp(0, 1, drawnScroll() / maxScroll);
      gsap.set(thumb, { y: p * travel });
    };

    const remeasure = () => {
      measure();
      update();
    };

    measure();
    update();
    // Per frame rather than on a scroll event, because under ScrollSmoother the
    // content keeps moving after the last scroll event has fired. A scroll-driven
    // update would stop with the events and let the thumb sit still through the
    // coast.
    gsap.ticker.add(update);
    ScrollTrigger.addEventListener("refresh", remeasure);

    // --- Dragging ---------------------------------------------------------
    // Pointer capture rather than window listeners: it keeps the drag alive when
    // the pointer leaves the thumb — which it will immediately, the thumb being
    // 18px wide — and releases it automatically if the pointer is lost.
    let fromY = 0;
    let fromScroll = 0;

    const setScroll = (y: number) => {
      const target = gsap.utils.clamp(0, maxScroll, y);
      const smoother = ScrollSmoother.get();
      // scrollTop() sets the smoothed position outright instead of easing towards
      // it, which is what a drag needs: the page should be where the thumb is, not
      // catching up to it. Without a smoother — reduced motion kills it — the
      // window is the scroller.
      if (smoother) smoother.scrollTop(target);
      else window.scrollTo(0, target);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !travel) return;
      fromY = e.clientY;
      // The *target* position rather than the drawn one, so a drag begun while the
      // page is still coasting continues from where it is heading instead of
      // fighting the tail of the easing.
      fromScroll = ScrollSmoother.get()?.scrollTop() ?? window.scrollY;
      thumb.setPointerCapture(e.pointerId);
      thumb.dataset.dragging = "true";
      // Stops the drag turning into a text selection across the whole page.
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!thumb.dataset.dragging || !travel) return;
      setScroll(fromScroll + ((e.clientY - fromY) / travel) * maxScroll);
    };

    const onPointerUp = (e: PointerEvent) => {
      delete thumb.dataset.dragging;
      if (thumb.hasPointerCapture(e.pointerId)) {
        thumb.releasePointerCapture(e.pointerId);
      }
    };

    thumb.addEventListener("pointerdown", onPointerDown);
    thumb.addEventListener("pointermove", onPointerMove);
    thumb.addEventListener("pointerup", onPointerUp);
    thumb.addEventListener("pointercancel", onPointerUp);

    return () => {
      gsap.ticker.remove(update);
      ScrollTrigger.removeEventListener("refresh", remeasure);
      thumb.removeEventListener("pointerdown", onPointerDown);
      thumb.removeEventListener("pointermove", onPointerMove);
      thumb.removeEventListener("pointerup", onPointerUp);
      thumb.removeEventListener("pointercancel", onPointerUp);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    /*
     * The container is `pointer-events-none` and only the thumb inside it takes
     * the pointer back. It spans the full height of the viewport, and a strip that
     * tall swallowing clicks along the right edge would quietly break real content
     * — the definition section's copy sits against that edge. The cost is that
     * clicking the empty track does not page the view, which native scrollbars do;
     * catching those clicks would mean catching all the others too.
     *
     * z-60 clears everything else on the page: the hero's layers reach z-30, the
     * veil z-40, and both the definition section's stage and the hero's cursor
     * z-50.
     */
    <div
      aria-hidden
      className="pointer-events-none fixed right-0 z-[60]"
      style={{ top: INSET, bottom: INSET, width: HIT_W }}
    >
      <div
        ref={thumbRef}
        className="pointer-events-auto absolute top-0 left-0 flex cursor-grab justify-center active:cursor-grabbing"
        style={{ width: HIT_W }}
      >
        {/* The visible pill. Separate from the element that takes the pointer, so
            the drag target can be three times its width without looking it. */}
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: PILL_W }}
        />
      </div>
    </div>,
    document.body,
  );
}
