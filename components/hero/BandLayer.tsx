"use client";

import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";
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

/**
 * The same measurement for the two-line rendering, where the governing run is "make
 * the leap" alone — 7.009em at weight 400, so ~7.85em at the 700 this renders at, and
 * 9.5 carries the same ~1.22× headroom over that as LEAP_EMS does over 11.50.
 *
 * A phone needs the second line and cannot be talked out of it. The one-line solve
 * wants a 364px span to hold 14em at the 26px floor, which on a 390px screen leaves
 * 13px for both wedges — so no aperture that keeps a visible wedge can fit this
 * sentence on one line, and the old floor simply overflowed it across the orange in
 * `text-accent`, where half the words are the panels' own colour and vanish. Breaking
 * it is the only lever that does not either shrink the line under legibility or delete
 * the wedges the ribbon is pinned to.
 *
 * The ceiling is 44 rather than LEAP_EMS's 82 because two lines are twice as tall: the
 * solve reaches the ceiling by ~640px of stage, and 44px × 1.3 × 2 is already 114px of
 * copy standing where the ribbon was.
 */
const LEAP_EMS_STACKED = 9.5;
const LEAP_STACKED_PX = [24, 44] as const;
const LEAP_ONE_LINE_PX = [26, 82] as const;

// `whitespace-nowrap` because the size is solved for this width; wrapping where it was
// not asked for would only ever mean the fit is wrong. The break on a narrow stage is
// an explicit <br/>, which nowrap does not suppress, so the two lines are the two runs
// the size was solved for rather than wherever the box happened to run out.
//
// Deliberately carries NO font-size of its own. It used to say `text-3xl
// md:text-[60px]`, which silently overrode the size the container solves and pinned
// the line to a flat 60px — 741px wide, against a span that is 609px at 1440, so the
// ends sat on top of the wedges on every laptop. `text-accent` words over
// accent-coloured orange simply disappear, which is why the overlap has to be
// structurally impossible rather than merely unlikely.
const leapCopy = (stacked: boolean) => (
  <p className="leading-[1.3] font-normal whitespace-nowrap text-ink">
    until you
    {stacked ? <br /> : " "}
    <span className="font-bold text-accent">make the leap</span>
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
          left: band.inset,
          right: band.inset,
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
          Below that the sentence breaks in two and is solved against its longer
          run instead (see LEAP_EMS_STACKED), which is what keeps it off the wedges
          on a phone; the one-line floor used to overflow onto them, and half the
          words are `text-accent` over accent-coloured orange.

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
          fontSize: band.narrow
            ? gsap.utils.clamp(...LEAP_STACKED_PX, band.width / LEAP_EMS_STACKED)
            : gsap.utils.clamp(...LEAP_ONE_LINE_PX, band.width / LEAP_EMS),
          opacity: reducedMotion ? 1 : 0,
        }}
      >
        {leapCopy(band.narrow)}
      </div>
    </>
  );
}
