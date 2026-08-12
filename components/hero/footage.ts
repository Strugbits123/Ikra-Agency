"use client";

import { useEffect, useState } from "react";

// The footage behind the doors. /img/hero-bg.jpg stays underneath it as the base
// layer rather than being replaced, and this is fetched on an idle callback.
const BACKGROUND_VIDEO_SRC: string | null = "/video/waves.mp4";
/** How long to wait for an idle moment before fetching the footage anyway, in ms. */
const BACKGROUND_VIDEO_IDLE_TIMEOUT = 2500;
// How far the doors must be open before the footage is worth decoding. Just
// inside the ~0.28 where the overlapping panels first clear each other.
export const BACKGROUND_VISIBLE_AT_DOOR = 0.25;

/**
 * Fetch the background footage once the browser is idle, and report when it has
 * frames so the layer can fade over the still.
 *
 * Nothing behind the doors is visible until ~1.3s after the first cue at 8vh — the
 * panels overlap for the whole seal and most of the crack — so loading it with the
 * page would put several megabytes against the assets that are actually on screen.
 * Arriving late costs a beat of a static image and not a gap: this is only the
 * *fetch*, the play/pause gate in paintStage is keyed to the doors independently,
 * and the still underneath covers every case where the frames aren't there yet.
 *
 * Skipped under reduced motion, where the doors start parked open and autoplaying
 * footage would be unrequested motion on arrival.
 */
export function useBackgroundFootage(mounted: boolean, reducedMotion: boolean) {
  // Null until the browser has a spare moment; `bgPlaying` then fades the footage
  // over the still once it has frames.
  const [bgSrc, setBgSrc] = useState<string | null>(null);
  const [bgPlaying, setBgPlaying] = useState(false);

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

  return { bgSrc, bgPlaying, setBgPlaying };
}
