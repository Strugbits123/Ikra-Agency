"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import type { RefObject } from "react";
import {
  DOOR_PANEL_BLEED_PX,
  DOOR_PANEL_OVERHANG,
  DOOR_PANEL_W,
  DOOR_REST_X,
  DOOR_REST_Y,
  holeClip,
} from "./doors";

/**
 * The panel's box: oversized top and bottom so the diagonal drift never slides it off
 * its own short edge, and DOOR_PANEL_BLEED_PX wider than its share so the two overlap
 * rather than merely meet when the doors seal. Both come from ./doors, because the
 * ribbon's anchors are measured against the same overhang.
 */
const PANEL_BOX = {
  top: `${-DOOR_PANEL_OVERHANG * 100}%`,
  height: `${(1 + 2 * DOOR_PANEL_OVERHANG) * 100}%`,
  width: `calc(${DOOR_PANEL_W * 100}% + ${DOOR_PANEL_BLEED_PX}px)`,
};

/**
 * The static layers of the pinned stage, in paint order: the backdrop, the two
 * orange panels over it, and the clip window the footage is seen through. None of
 * them holds any timing — every one is driven from `paintStage` through the ref it
 * is handed (see ./sequence).
 */

/**
 * The background reveal, uncovered once the doors move. The still and the footage
 * are layered rather than swapped: the still covers the stretch before the idle
 * callback fires, the reduced-motion path, and an outright playback failure.
 *
 * No `priority`, and no `poster` on the video either — both would preload for a
 * first frame that cannot be seen for a viewport of scrolling.
 */
export function HeroBackdrop({
  bgSrc,
  bgPlaying,
  onPlaying,
  videoRef,
}: {
  bgSrc: string | null;
  bgPlaying: boolean;
  onPlaying: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <>
      <Image
        src="/img/hero-bg.jpg"
        alt="Misty coastal cliffs at dawn"
        fill
        className="object-cover"
        sizes="100vw"
      />

      {bgSrc && (
        <video
          ref={videoRef}
          // Fades over the still on its first frame rather than cutting, which
          // matters for a visitor arriving at a restored scroll position with the
          // doors already open.
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
          onPlaying={onPlaying}
        />
      )}
    </>
  );
}

/**
 * The orange doors. Oversized so the closed state fully overlaps and the diagonal
 * drift never exposes a panel's short edge. In reduced motion they render already
 * parked — the same offsets in vw/vh, since there is no ScrollTrigger to drive them.
 */
export function DoorPanels({
  leftRef,
  rightRef,
  reducedMotion,
}: {
  leftRef: RefObject<HTMLDivElement | null>;
  rightRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  return (
    <>
      <div
        ref={leftRef}
        className="absolute left-0 z-10 bg-accent"
        style={{
          ...PANEL_BOX,
          transform: reducedMotion
            ? `translate(${-DOOR_REST_X * 100}vw, ${DOOR_REST_Y * 100}vh)`
            : undefined,
        }}
      />
      <div
        ref={rightRef}
        className="absolute right-0 z-10 bg-accent"
        style={{
          ...PANEL_BOX,
          transform: reducedMotion
            ? `translate(${DOOR_REST_X * 100}vw, ${-DOOR_REST_Y * 100}vh)`
            : undefined,
        }}
      />
    </>
  );
}

/**
 * The footage, seen through a rectangular hole in the orange. The box never moves
 * or resizes — only its clip does, and only on scroll. Starts fully open but
 * transparent, so the entrance is a plain fade (see the load timeline) and nothing
 * flashes before it runs; opacity rather than a `scale-0` class because GSAP must
 * not have to write a transform here, which would wipe the translate-centering.
 */
export function ClipWindow({
  boxRef,
  videoRef,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div
      ref={boxRef}
      className="absolute top-1/2 left-1/2 z-20 h-[78vh] w-[15vw] max-w-75 min-w-35 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
      style={{ clipPath: holeClip(0), opacity: 0 }}
    >
      {/* Not /video/section2.mp4, which is kept alongside as the master: that is
          1920×1080 and 18.5MB, and this box is at most 300px wide, so
          `object-cover` was discarding ~80% of every decoded frame. This is the
          same footage pre-cropped to the strip that shows, at 480×1080 and 3.53MB.

          `poster` is a plain URL, so it bypasses next/image and is served at
          whatever size it is on disk. It is the video's own first frame at 36KB,
          so the handoff to playback is invisible. */}
      <video
        ref={videoRef}
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
  );
}

/**
 * The circle cursor. Portaled out because `position: fixed` does not work inside
 * ScrollSmoother's transformed #smooth-content — a transformed ancestor becomes the
 * containing block, so a fixed child scrolls with the page.
 */
export function HeroCursor({
  cursorRef,
}: {
  cursorRef: RefObject<HTMLDivElement | null>;
}) {
  return createPortal(
    <div
      ref={cursorRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50 h-6 w-6 rounded-full bg-white opacity-0"
    />,
    document.body,
  );
}
