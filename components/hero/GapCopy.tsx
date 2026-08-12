"use client";

import { gsap } from "@/lib/gsap";
import { APERTURE } from "./doors";
import { GAP_LINES } from "./timeline";

/**
 * How many ems wide the lead line is. Measured, not guessed: summing the advance
 * widths in public/fonts/ZalandoSansSemiExpanded-VariableFont_wght.ttf, with the
 * HVAR deltas applied for weight 500 — `font-medium`, which is what this actually
 * renders at, and 1.4% wider than the font's default 400 instance — gives 10.791em
 * for "growth creates a gap". Kerning only ever subtracts, so taking the advance
 * sum as the width errs in the safe direction. Re-measure if the wording changes.
 */
const GAP_LEAD_EMS = 10.8;

/**
 * Clearance between the lead line's ends and the wedges' inner edges, as a share
 * of the aperture on each side.
 *
 * A share rather than a pixel count on purpose. The line's width and the gap's
 * width are both linear in the growth's progress (see leadSeat), so a proportional
 * margin is the *same* margin at every frame — the copy sits inside the opening
 * from the moment it appears, not merely once the doors have stopped.
 */
const GAP_COPY_INSET = 0.07;

/**
 * The gap copy's size, solved from the span it has to sit in rather than declared.
 * The aperture is a fraction of the viewport and a declared size is not, so any
 * fixed size is only right at one width: a flat `md:text-[60px]` is 647px of line
 * against a 605px gap at 1440 and a 430px gap at 1024, putting the ends on the
 * orange at every laptop size there is.
 *
 * The ceiling is that same 60px and the floor is the old mobile size, so the widest
 * screens and phones are both unchanged. Between them — roughly 700px to 1200px —
 * the floor binds and the line still overhangs, because the gap is too narrow for
 * this many words at a readable size. LEAP_EMS's clamp makes the same concession.
 *
 * Solved from the *lead* line alone, not the longest of the three: it is the one
 * locked to the aperture, so its fit is what is read frame by frame. Sizing to
 * "between who you've become" instead would put the whole statement at ~35px on a
 * 1440 screen. The other two still cross onto the wedges, but by far less, since
 * they shrink along with it.
 */
const GAP_COPY_MIN_PX = 40;
const GAP_COPY_MAX_PX = 60;
export const gapCopyFontSize = (stageW: number) =>
  gsap.utils.clamp(
    GAP_COPY_MIN_PX,
    GAP_COPY_MAX_PX,
    (APERTURE * stageW * (1 - 2 * GAP_COPY_INSET)) / GAP_LEAD_EMS,
  );

/**
 * `overlay` stacks every line in the same seat at the centre of the stage, so each
 * takes the last one's place rather than sitting beneath it. Positioning is left
 * entirely to GSAP (see `stackSeat`), which drives `yPercent` and would overwrite
 * any translate-based centring from the classes.
 *
 * Without it they stack in normal flow, which is the reduced-motion rendering: no
 * GSAP touches them there, so nothing may depend on a transform being written —
 * hence the flow-only `mt-5` between them.
 *
 * `lineRefs` is filled in line order, so index `i` here is index `i` in GAP_LINES
 * and the element being driven always matches the window driving it.
 */
export default function GapCopy({
  overlay = false,
  fontSize,
  lineRefs,
}: {
  overlay?: boolean;
  fontSize?: number;
  lineRefs?: { current: (HTMLParagraphElement | null)[] };
}) {
  // One class string for all of them: they are parts of one statement in the same
  // seat, so any difference in size or weight reads as a replacement rather than
  // the sentence carrying on. That is why the solved size is shared by all three
  // even though only the lead line's fit is what solves it. The max-width only
  // fixes where the longest line wraps; GSAP centres on the element's own width.
  //
  // The class-based sizes are the reduced-motion rendering only: there the copy is
  // a static column at the top of the stage rather than seated in the gap, so there
  // is no span to solve it against.
  const line = `w-full max-w-[1500px] leading-[1.15] font-medium text-ink ${fontSize === undefined ? "text-[40px] md:text-[60px]" : ""
    }`;
  const seat = overlay
    ? "absolute top-1/2 left-1/2 px-8 text-center"
    : "";
  return (
    <>
      {GAP_LINES.map(({ text }, i) => (
        <p
          key={text}
          ref={
            lineRefs
              ? (el) => {
                lineRefs.current[i] = el;
              }
              : undefined
          }
          className={`${seat} ${overlay || i === 0 ? "" : "mt-5"} ${line}`}
          style={fontSize === undefined ? undefined : { fontSize }}
        >
          {text}
        </p>
      ))}
    </>
  );
}
