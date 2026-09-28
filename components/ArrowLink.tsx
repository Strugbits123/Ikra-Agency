"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { showRouteCover } from "@/components/routeTransition";

/**
 * A small-caps link with the reference's underline rule and a nudging arrow. A link only
 * when there is a href.
 *
 * **This was `CaseLink`, private to `cases/CaseLayers`, and it moved here when a second
 * section needed the same affordance** — the "more about us" link under `DefinitionSection`'s
 * statement. Nothing about it changed in the move; it is the case-study cards' own link,
 * drawn from one definition so the two cannot drift into being almost-the-same button. The
 * type sizing is deliberately viewport-relative rather than fixed (`clamp(10px, 0.63vw, 13px)`,
 * measured off the reference's cards), so it holds its proportion against whatever copy sits
 * above it at any width.
 *
 * It is `components/` rather than `components/cases/` for the same reason `Footer.tsx` is:
 * once a second route draws it, it is the site's chrome and not one section's.
 *
 * ## Two variants, because the type it sits under is not the same size
 *
 * `card` is the measured default and the reference's own figure: 10–13px at `font-normal`,
 * under a card title that runs 18–32px, i.e. a little over a third of it. `display` exists
 * because that ratio does not travel — under `DefinitionSection`'s 26/35px statement the same
 * link reads as a footnote rather than an invitation, which is what was reported.
 *
 * **`display` steps at `md` rather than scaling with the viewport, and that is the whole point
 * of it being a second variant rather than a bigger clamp.** `card` is fluid because the title
 * above it is fluid (`clamp(18px, 1.6vw, 32px)`), so a `vw` term keeps the pair in a constant
 * relation. The statement is not: it is a flat 26px, then a flat 35px from `md`. A `vw` size
 * under it therefore *drifts against the thing it is sized for* — measured at `0.95vw`, the
 * link came out 0.37x the statement at 1280 and 0.51x at 1920, i.e. a visibly different
 * relationship on two ordinary desktops. Mirroring the statement's own two steps holds it at
 * 0.50x and 0.46x instead, which is the same figure at every width the statement is.
 *
 * It also takes `font-medium` rather than `font-normal`, and the step is deliberately one
 * notch. Small caps at 0.2em tracking already read lighter than their weight suggests, so at
 * this size `font-normal` goes thin before it goes elegant; `font-semibold` is the other
 * failure, turning a quiet rule into a button. 500 is the one that holds the reference's tone
 * while carrying the extra size.
 *
 * **The gap and the underline's drop stay in px on purpose.** They are the reference's
 * measurements and they are about the *rule*, not about the type — an `em` gap would grow the
 * empty space between label and arrow by the same 40% and the link would read as two
 * separate things.
 */
const VARIANT = {
  card: "text-[clamp(10px,0.63vw,13px)] font-normal",
  // 13/26 and 16/35 — the statement's own two sizes, halved and rounded.
  display: "text-[13px] font-medium md:text-[16px]",
} as const;

export default function ArrowLink({
  label,
  href,
  size = "card",
  className = "",
}: {
  label: string;
  href: string | null;
  size?: keyof typeof VARIANT;
  className?: string;
}) {
  const inner = (
    <>
      <span>{label}</span>
      <span
        aria-hidden
        className="transition-transform duration-300 group-hover/link:translate-x-1"
      >
        →
      </span>
    </>
  );
  const cls =
    "group/link inline-flex items-center gap-6 border-b border-ink/25 pb-2.5 " +
    `${VARIANT[size]} tracking-[0.2em] text-ink/70 uppercase ` +
    "transition-colors duration-300 hover:border-ink/60 hover:text-ink " +
    className;

  // A span, not an `href="#"`: a link to nowhere is worse for a keyboard or a screen reader
  // than no link at all. Give it a `href` and this becomes a link unchanged.
  //
  // `next/link` rather than a bare anchor, so the destination opens without tearing the page
  // down and rebuilding ScrollSmoother — see SmoothScrollProvider, which resets the
  // smoother and refreshes every trigger when the route changes.
  //
  // The click raises the route cover, and the click rather than a router event because it is
  // the earliest signal there is: in development the destination segment has not been
  // compiled at this point, so nothing the router exposes fires until well after the screen
  // has already gone cream. `SmoothScrollProvider` takes it off again once the new page is
  // up, reset and re-measured — see `components/RouteCover`.
  //
  // Only for a plain left click, though — the same guard `next/link` uses internally to
  // decide whether *it* will navigate. A modified click (Ctrl/Cmd/Shift/middle-button) opens
  // the destination in a new tab and leaves this one exactly where it was, so raising the
  // cover there covers a page whose route never changes — and the only thing that ever takes
  // the cover down is `SmoothScrollProvider`'s effect on `pathname`, which then never fires.
  // That's a black screen stuck up forever in the original tab.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    showRouteCover();
  };

  return href ? (
    <Link href={href} className={cls} onClick={onClick}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}
