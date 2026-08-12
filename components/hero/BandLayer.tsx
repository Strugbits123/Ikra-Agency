"use client";

import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { BAND_INSET } from "./doors";
import { BAND_CLIP_UNDRAWN, LEAP_GAP, type BandGeometry } from "./band";
import WavyBand from "./WavyBand";

// How many ems wide the closing line is, so its size can be solved from the span
// between the wedges rather than picked — widen the wedges and the line shrinks to
// suit.
//
// Not a guess: summing the advance widths in
// public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf gives 4.494em for
// "until you " and 7.009em for "make the leap", so 11.50em at weight 400. The bold
// run renders at 700 and the font ships HVAR, so its advances are wider than that —
// 14 leaves room for the bold run being up to ~12% wider *and* still clears the span
// at every width from 768px up. Keep it above ~12.4 if the wording changes.
const LEAP_EMS = 14;

// `whitespace-nowrap` because the size is solved for this width; wrapping would only
// ever mean the fit is wrong.
//
// Deliberately carries NO font-size of its own. It used to say `text-3xl
// md:text-[60px]`, which silently overrode the size the container solves and pinned
// the line to a flat 60px — 741px wide, against a span that is 609px at 1440, so the
// ends sat on top of the wedges on every laptop. `text-accent` words over
// accent-coloured orange simply disappear, which is why the overlap has to be
// structurally impossible rather than merely unlikely.
const LEAP_COPY = (
  <p className="leading-[1.3] font-normal whitespace-nowrap text-ink">
    until you <span className="font-bold text-accent">make the leap</span>
  </p>
);

/**
 * The wavy ribbon bridging the two door wedges, and the closing line that takes
 * the space it vacates. Both are placed against the ribbon's measured geometry, so
 * they mount only once the stage has been measured.
 */
export default function BandLayer({
  band,
  reducedMotion,
  ribbonRef,
  leapRef,
}: {
  band: BandGeometry | null;
  reducedMotion: boolean;
  ribbonRef: RefObject<HTMLDivElement | null>;
  leapRef: RefObject<HTMLDivElement | null>;
}) {
  if (!band) return null;

  return (
    <>
      {/* Placed at the geometry's own `top`, not centred, because its ends have
          to meet the wedge corners exactly.

          Sits *below* the doors (z-5 against z-10), which changes nothing about
          the finished composition but does mean panels sliding back in on an
          upward scroll cover a ribbon that is still closing rather than leaving
          it on top of the orange. */}
      <div
        ref={ribbonRef}
        className="pointer-events-none absolute z-[5]"
        style={{
          left: BAND_INSET,
          right: BAND_INSET,
          top: band.top,
          clipPath: reducedMotion ? undefined : BAND_CLIP_UNDRAWN,
        }}
      >
        <WavyBand g={band} animate={!reducedMotion} />
      </div>

      {/* Centred on the stage rather than boxed inside the band's inset: sized to
          its own content and pulled back half its width, so its midpoint is the
          screen's at any font size. Being unboxed is what keeps any overhang even
          rather than all on one side — it is not a licence to overhang.

          On the ribbon's centre line, since it takes over that space once the
          ribbon clears — and sized to the span between the wedges (see LEAP_EMS)
          so it sits between them, with 26–64px of clearance a side from 768px up.
          The clamp's floor still overflows below ~700px, where the span is far too
          narrow to fit this many words at any readable size; that is the one place
          the overhang is accepted.

          Translate-centring is GSAP's here (xPercent, from leapSeat), not the
          class list's. Reduced motion has no GSAP, so it keeps the class and stays
          below the band — where it must be, since the ribbon is drawn in full
          there and never clears. */}
      <div
        ref={leapRef}
        className={`pointer-events-none absolute left-1/2 z-20 text-center ${reducedMotion ? "-translate-x-1/2" : ""
          }`}
        style={{
          top: reducedMotion
            ? band.top + band.height + LEAP_GAP
            : band.top + band.height / 2,
          fontSize: gsap.utils.clamp(26, 82, band.width / LEAP_EMS),
          opacity: reducedMotion ? 1 : 0,
        }}
      >
        {LEAP_COPY}
      </div>
    </>
  );
}
