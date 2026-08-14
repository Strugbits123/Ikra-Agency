"use client";

import type { RefObject } from "react";
import { useRevealOnView } from "@/lib/useRevealOnView";

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
 * The travelling panel — inside the pinned frame so its upward climb can be driven
 * against scroll rather than happening at page speed.
 *
 * Anchored at `top-0` with no vertical centring: GSAP drives `y` here, which
 * rewrites the whole transform, so a Tailwind `-translate-y-1/2` would be wiped the
 * instant the first frame ran.
 */
export function DictionaryPanel({
  panelRef,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      className="pointer-events-none absolute top-0 hidden md:block md:right-36 md:w-[42%] md:max-w-140"
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
