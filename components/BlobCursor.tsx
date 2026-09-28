"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The site's one cursor: a blob that inverts the *brightness* of whatever it passes over,
 * so it is legible on every section without being told what colour that section is. It
 * trails the pointer on an ease, stretches along its direction of travel, and wobbles when
 * the reader stops.
 *
 * **It replaces the hero's white dot rather than joining it** — see `RESTORE THE HERO DOT`
 * in components/HeroNarrative.tsx for the seven-step uncommenting that brings that back.
 *
 * Five things here are load-bearing.
 *
 * **The inversion is `backdrop-filter: grayscale(1) invert(1)`, and NOT a white element on
 * `mix-blend-mode: difference`.** They look like the same idea and they are not, because
 * this brand's palette is warm. `difference` renders `255 − backdrop` per channel, and the
 * inverse of a colour with a lot of red and almost no blue is a colour with a lot of blue —
 * so a white blob came out cyan on precisely the two surfaces it crosses most:
 *
 *     bg-accent  #fa5e3c  ->  #05a1c3   the wave, the approach rail, every dot
 *     text-ink   #390303  ->  #c6fcfc   the founders' headings, the approach copy
 *
 * That was reported, and no choice of blob colour fixes it — any light element differenced
 * against a warm ground lands in the cyans. Taking the greyscale *first* throws the hue away
 * before the inversion can act on it, so the blob is only ever white, grey or black.
 *
 * **The `brightness(2)` on the end is what keeps it off grey, and the hero's doors are the
 * surface it exists for.** A plain inversion has a blind spot wherever the ground's own
 * greyscale is mid, because there the inverse is mid too — measured across a 26-step neutral
 * ramp, the plain filter's worst case is a ground of 130 against a blob of 125, a contrast of
 * **1.07:1**. `bg-accent` is greyscale **125**, i.e. sitting in that blind spot almost exactly,
 * which is why the blob read as a grey smudge on the orange doors and was reported as one.
 * Doubling after the inversion lifts everything the inversion left dark-ish and leaves
 * everything it left dark alone, because a small number doubled is still small. Measured off
 * a rendered swatch of each surface, before -> after:
 *
 *     bg-accent #fa5e3c   130 -> 255   1.23:1 -> 3.12:1     the doors, the wave, the rail
 *     bg-ember  #e74b2f   149 -> 255   1.29:1 -> 3.86:1
 *     mid-grey  #808080   127 -> 254   1.01:1 -> 3.92:1     any mid-tone photograph
 *     footer    #484848   183 -> 255   4.56:1 -> 9.15:1
 *     navy      #0e3159   211 -> 255   8.76:1 -> 13.11:1
 *     text-ink  #390303   241 -> 255  15.65:1 -> 17.67:1
 *     bg-black  #000000   255 -> 255  21.00:1 -> 21.00:1
 *     bg-gray   #dfdfdf    32 ->  64  12.23:1 -> 7.78:1     still black on a light ground
 *     cases end #cfcece    49 ->  98   8.28:1 -> 3.88:1
 *     bg-paper  #f7f7f7     8 ->  16  18.69:1 -> 17.76:1
 *     bg-cream  #fef5f3     8 ->  16  18.66:1 -> 17.73:1
 *
 * **What this does not do is remove the blind spot — it moves it**, from a ground of 130 to a
 * ground of **170**, measured on the same ramp. That is the trade, and it is worth taking here
 * because no flat surface in this palette is anywhere near 170 (the nearest are `casesEnd` at
 * 207 and `footer` at 72) while one of the most-crossed surfaces on the site was sitting inside
 * the old one. **If a new ground lands near greyscale 170, this is the number to re-check**,
 * and the answer then is a different multiplier rather than a blob colour. Nothing gets worse
 * than 3.88:1 anywhere, against 1.01:1 before.
 *
 * It is also why the background below is `transparent` rather than a colour: an opaque fill
 * would hide the filtered backdrop entirely, which is the whole effect. A blob that is simply
 * *white* is the obvious thing to reach for instead and is the one thing that cannot work: it
 * would vanish on cream, paper, white and `bg-gray`, which is most of the site below the hero.
 *
 * **It portals to `document.body`.** `position: fixed` does not work inside
 * `#smooth-content`: ScrollSmoother's transform on that element makes it the containing
 * block for fixed descendants, so anything fixed in there scrolls with the page. Same
 * reason and same fix as components/ScrollBar.tsx and the hero's own cursor.
 *
 * **The native cursor is hidden from JS, not from CSS**, through `html.blob-cursor` (the
 * rule is in app/globals.css beside `html.scroll-locked`, which is the same pattern). A
 * static rule would hide the pointer for a reader who never gets a blob — reduced motion,
 * a touch device, or JavaScript that failed — and a page with no cursor at all is worse
 * than a page with the ordinary one. The class goes up on the first mouse movement and
 * comes down the moment a finger touches the screen.
 *
 * **The stretch is computed from the blob's own velocity, not the pointer's**, and that is
 * the one deliberate departure from the sketch this was built from. The pointer's velocity
 * falls to zero on the single frame the mouse stops, while the blob is still several frames
 * behind and visibly travelling — so a pointer-derived stretch snapped the blob round in
 * mid-flight every time the reader came to a halt. Its own velocity eases in and out by
 * construction, because it is the eased position's own derivative, and at a steady speed
 * the two are identical anyway. It also removes the need for a second smoothing constant.
 *
 * **One rAF loop, not two.** The sketch ran the idle wobble on a loop of its own alongside
 * the main one, and both wrote `border-radius` on every frame — so which shape you saw was
 * decided by the order the two happened to be queued in. The wobble is a branch inside the
 * one loop here, chosen off the time since the last movement.
 */

/** The blob's resting diameter in px. Every stretch below is a scale against this. */
const SIZE = 40;

/**
 * How far the drawn position closes on the pointer each frame. This is the whole of the
 * trail: at 0.12 the blob sits a few frames behind a moving mouse and arrives about a fifth
 * of a second after it stops.
 */
const EASE = 0.12;

/** Stillness before the idle wobble takes over, in ms. */
const IDLE_AFTER_MS = 200;

/**
 * Radians per frame of the idle wobble's phase. The eight radii are driven at eight
 * different multiples of it (0.7 to 1.4) so their periods never line up and the wobble has
 * no visible loop.
 */
const IDLE_STEP = 0.03;

/** The most the blob may stretch, in px against SIZE. */
const MAX_STRETCH = 25;

/** Squash is a fraction of the stretch: it thins as it lengthens, but never to a needle. */
const SQUASH_RATIO = 0.3;

/** Below this speed, in px per frame, the blob is at rest and holds its shape and angle. */
const MOVING_SPEED = 3;

/** The speed, in px per frame, at which the lopsided radius reaches its full lean. */
const FULL_STRETCH_SPEED = 30;

/** Resting shape. A true circle reads as a dot rather than as a drop of something. */
const REST_RADIUS = "43% 57% 52% 48% / 45% 55% 45% 55%";

/** Where it waits before the pointer has ever been seen — off-screen, not at the origin. */
const PARKED = `translate3d(-${SIZE * 4}px, -${SIZE * 4}px, 0)`;

/**
 * Greyscale first, then invert, then lift. The first two do not depend on their order —
 * inverting each channel and then taking a weighted sum gives the same number as taking the
 * sum and inverting it — but written this way it says what it is for: the hue is discarded,
 * and only the brightness is turned over. The `brightness` **must** come last, since it is
 * what pulls the inverted mid-tones up off grey; ahead of the invert it would push them down
 * instead. See the head of this file for the measured before-and-after on every surface.
 */
const INVERSION = "grayscale(1) invert(1) brightness(2)";

/**
 * The blob is drawn entirely by `backdrop-filter`, so a browser without it renders nothing
 * at all — and because the native cursor is hidden at the same time, that is not a degraded
 * cursor but no cursor. Bailing out keeps the ordinary pointer instead, the same answer
 * reduced motion gets. Safari needs the prefixed name, and only the prefixed name.
 */
const supportsInversion = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  (CSS.supports("backdrop-filter", INVERSION) ||
    CSS.supports("-webkit-backdrop-filter", INVERSION));

export default function BlobCursor() {
  const blobRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // `matchMedia` cannot be read before an effect has run, so the first commit reports "no
  // preference" whatever the reader's setting is — the same gate every scroll-driven
  // section in this repo uses, and the reason `enabled` starts false rather than true.
  useEffect(() => {
    setMounted(true);
    setEnabled(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        supportsInversion(),
    );
  }, []);

  useEffect(() => {
    if (!mounted || !enabled) return;
    const blob = blobRef.current;
    if (!blob) return;

    const target = { x: 0, y: 0 };
    const drawn = { x: 0, y: 0 };
    const previous = { x: 0, y: 0 };

    let idlePhase = 0;
    let lastMoveAt = 0;
    let angle = 0;
    let seen = false;
    let raf = 0;

    const takeCursor = () =>
      document.documentElement.classList.add("blob-cursor");
    const releaseCursor = () =>
      document.documentElement.classList.remove("blob-cursor");

    /** A tap, or the pointer leaving the window entirely. Both give the cursor back. */
    const handleLeave = () => {
      seen = false;
      blob.style.opacity = "0";
      blob.style.transform = PARKED;
      releaseCursor();
    };

    /**
     * A finger is a mouse as far as the compatibility mouse events are concerned, which is
     * the bug components/hero/cursor.ts documents at length: a tap synthesises a move at
     * the point of contact, and a finger lifts rather than travelling away, so nothing ever
     * arrives to take the blob back off the screen. Reading `pointerType` off the pointer
     * event itself is the only thing that carries the distinction, and it is why this
     * listens for `pointermove` rather than `mousemove`.
     */
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") {
        handleLeave();
        return;
      }

      target.x = e.clientX;
      target.y = e.clientY;
      lastMoveAt = performance.now();

      if (!seen) {
        // Seed the drawn position at the pointer rather than easing to it from the corner,
        // which would fly the blob across the page on the reader's first small movement.
        seen = true;
        drawn.x = previous.x = target.x;
        drawn.y = previous.y = target.y;
        takeCursor();
        blob.style.opacity = "1";
      }
    };

    const handleDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") handleLeave();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!seen) return;

      drawn.x += (target.x - drawn.x) * EASE;
      drawn.y += (target.y - drawn.y) * EASE;

      // The blob's own velocity, not the pointer's — see the head of this file.
      const velocityX = drawn.x - previous.x;
      const velocityY = drawn.y - previous.y;
      previous.x = drawn.x;
      previous.y = drawn.y;

      const speed = Math.hypot(velocityX, velocityY);
      const moving = speed > MOVING_SPEED;

      let radius: string;
      if (!moving && now - lastMoveAt > IDLE_AFTER_MS) {
        idlePhase += IDLE_STEP;
        const p = idlePhase;
        radius =
          `${43 + Math.sin(p) * 8}% ${57 + Math.cos(p * 0.7) * 8}% ` +
          `${52 + Math.sin(p * 1.3) * 6}% ${48 + Math.cos(p * 0.9) * 6}% / ` +
          `${45 + Math.sin(p * 1.1) * 7}% ${55 + Math.cos(p * 0.8) * 7}% ` +
          `${45 + Math.sin(p * 1.4) * 5}% ${55 + Math.cos(p * 1.2) * 5}%`;
      } else if (moving) {
        const t = Math.min(speed / FULL_STRETCH_SPEED, 1);
        radius =
          `${50 - t * 15}% ${50 + t * 15}% ${50 + t * 10}% ${50 - t * 10}% / ` +
          `${50 + t * 12}% ${50 - t * 8}% ${50 + t * 8}% ${50 - t * 12}%`;
      } else {
        radius = REST_RADIUS;
      }

      // The angle is *held* rather than recomputed at rest: `atan2(0, 0)` is 0, so reading
      // it every frame flicks the blob back to level on the frame the reader stops. Holding
      // it is invisible, because a blob at rest is near enough symmetrical to have no
      // orientation to see.
      if (moving) angle = (Math.atan2(velocityY, velocityX) * 180) / Math.PI;

      // Scale rather than width/height: a size change is layout on every frame, where a
      // transform stays on the compositor. `rotate` before `scale` is what puts the stretch
      // along the direction of travel rather than along the screen's x axis.
      const stretch = Math.min(speed * 0.8, MAX_STRETCH);
      const squash = Math.min(speed * 0.4, MAX_STRETCH) * SQUASH_RATIO;
      const scaleX = (SIZE + stretch) / SIZE;
      const scaleY = (SIZE - squash) / SIZE;

      blob.style.transform =
        `translate3d(${drawn.x - SIZE / 2}px, ${drawn.y - SIZE / 2}px, 0) ` +
        `rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
      blob.style.borderRadius = radius;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handleDown, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    window.addEventListener("blur", handleLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handleDown);
      document.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("blur", handleLeave);
      releaseCursor();
    };
  }, [mounted, enabled]);

  if (!mounted || !enabled) return null;

  return createPortal(
    /*
     * z-300 clears everything, RouteCover's z-200 included — which is the one that matters,
     * because the cover is opaque and the native cursor is hidden underneath it, so a blob
     * below it would leave the reader with no pointer at all for the length of a route
     * change. Below that the ladder is: hero layers z-30, the definition veil z-40, that
     * section's stage z-50, ScrollBar z-60.
     */
    <div
      ref={blobRef}
      aria-hidden
      data-blob-cursor
      className="pointer-events-none fixed top-0 left-0 z-300"
      style={{
        width: SIZE,
        height: SIZE,
        // Transparent on purpose: the blob *is* the filtered backdrop, and any fill would
        // paint over the thing it is meant to show. The filter is clipped to the border
        // box, border-radius included, so the morphing shape below cuts it as it goes.
        background: "transparent",
        borderRadius: REST_RADIUS,
        backdropFilter: INVERSION,
        WebkitBackdropFilter: INVERSION,
        transform: PARKED,
        opacity: 0,
        transition: "opacity 200ms ease",
        willChange: "transform, border-radius",
      }}
    />,
    document.body,
  );
}
