"use client";

import type { RefObject } from "react";
import { useRevealOnView } from "@/lib/useRevealOnView";
import { MARK_WIDTH } from "./dots";

/**
 * The dictionary entry, and the two ways it is presented.
 *
 * One copy of the words, three renderings: the desktop panel that GSAP flies up the
 * right-hand side, the mobile block that sits in normal flow below the composition,
 * and the reduced-motion block that does the same. Splitting the words from the
 * placement is the whole point — they used to be written out once and referenced
 * three times from the section, which is the same thing said less clearly.
 */

/**
 * A block that fades and rises the first time it is scrolled into view. The site's
 * ordinary reveal, on an IntersectionObserver and a CSS transition — nothing here is
 * scroll-driven, which is exactly why the statement stopped using it (see
 * STATEMENT_LIFT_VH).
 */
export function RevealBlock({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, revealed } = useRevealOnView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        } ${className}`}
    >
      {children}
    </div>
  );
}

const DICTIONARY_CONTENT = (
  <>
    <p className="text-lg font-light text-ink/80 italic md:text-xl">
      /ɪˈkrɑ/ <span className="not-italic">noun, uncount.</span>
    </p>
    <p className="mt-2 text-base font-light text-ink/60">
      from Russian икра (caviar)
    </p>

    <p className="mt-8 text-[26px] leading-[1.3] font-medium text-accent md:text-[34px]">
      The rarest expression of refined taste
    </p>

    <p className="mt-6 text-base leading-[1.3] font-light text-ink/80 md:text-lg">
      it transforms a simple moment into an experience of true rarity and
      prestige.
    </p>

    <div className="mt-8 border-t border-ink/20 pt-4 text-sm font-light text-ink/60">
      <p>synonyms — rarity, distinction, upstream thinking</p>
      <p className="mt-1">antonyms — filler, mass-market, downstream</p>
    </div>
  </>
);

/**
 * The frame's own horizontal padding at the widths this panel is shown at, and the gap
 * it must leave beside the wordmark — both in px, because the panel's width is solved
 * against them below.
 *
 * PANEL_PAD_PX has to track the frame's `lg:px-36` in DefinitionSection. It is the one
 * figure here that is copied rather than derived, so there is an assertion on it in
 * ./measure that fires if the two drift apart.
 */
const PANEL_PAD_PX = 144;
const PANEL_GUTTER_PX = 32;

/**
 * The travelling panel — inside the pinned frame so its upward climb can be driven
 * against scroll rather than happening at page speed.
 *
 * Anchored at `top-0` with no vertical centring: GSAP drives `y` here, which
 * rewrites the whole transform, so a Tailwind `-translate-y-1/2` would be wiped the
 * instant the first frame ran.
 *
 * ## Why the width is solved and why this starts at `lg`
 *
 * The panel and the wordmark are the two halves of the settled composition, and they
 * used to collide — not by arriving at the wrong time, which the wordmark's lead
 * already handles (see MARK_LEAD_VH), but because their *resting boxes* overlapped.
 * With the wordmark fully slid hard-left the two still shared up to 83px of the same
 * horizontal band, so no amount of timing could separate them.
 *
 * They collided because they scale by different laws. MARK_WIDTH has a 240px floor,
 * which governs everything below ~828px, while this panel's left edge is
 * `100% − right − 42%` and keeps marching left as the viewport narrows. Measured
 * clearance was negative at every width under 993px and under 32px up to ~1100.
 *
 * Two things follow, and they fix different bands:
 *
 *  - **The width is capped against the wordmark**, not just at 42%/35rem. That turns
 *    9px of clearance at 1024 and 31px at 1100 into a guaranteed PANEL_GUTTER_PX. The
 *    cap stops binding at ~1102px, so every width from `xl` up is untouched — 42% or
 *    the 35rem ceiling still governs there, exactly as before.
 *  - **It starts at `lg`, not `md`.** Below that the room genuinely is not there
 *    rather than merely badly divided: 288px of a 768px frame is padding and the
 *    wordmark floors at 240px, which leaves 208px for this — five wrapped lines of a
 *    34px heading, which is worse than the overlap it would fix. So the tablet band
 *    joins the phone in taking the in-flow rendering below, which is the mechanism
 *    this codebase already chose for this exact condition; only the width it was
 *    thought to hold at was wrong.
 */
export function DictionaryPanel({
  panelRef,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      // `max-w-140` stays a class so the 35rem ceiling lives in one place — a
      // max-width still clamps an inline width.
      className="pointer-events-none absolute top-0 hidden lg:block lg:right-36 lg:max-w-140"
      style={{
        width: `min(42%, calc(100% - ${2 * PANEL_PAD_PX + PANEL_GUTTER_PX}px - ${MARK_WIDTH}))`,
      }}
    >
      {DICTIONARY_CONTENT}
    </div>
  );
}

/**
 * The same entry in normal flow, for the two cases with no climb to drive: below
 * `md`, where the panel would land on the wordmark, and under reduced motion, where
 * nothing is pinned at all. The caller supplies the gutters, since those are the one
 * thing the two cases do not share.
 */
export function DictionaryInFlow({ className }: { className: string }) {
  return (
    <div className={className}>
      <RevealBlock className="max-w-md">{DICTIONARY_CONTENT}</RevealBlock>
    </div>
  );
}
