"use client";

import type { RefObject } from "react";
import { FOOTER_DOT_SIZE } from "./dots";

/**
 * The footer's type, sized against the viewport rather than fixed.
 *
 * It is the one block on the page with nothing above it, so on a large screen a
 * px-sized version reads as a small notice stranded at the bottom. Scaling with
 * vw keeps it the same *share* of the screen everywhere.
 */
const FOOTER_HEADING_SIZE = "clamp(19px, 1.9vw, 34px)";
const FOOTER_BODY_SIZE = "clamp(13px, 1.1vw, 19px)";

const FOOTER_COLUMNS = [
  {
    heading: "Brand strategy & creative direction",
    body: "We define the brand at the strategic level, then bring it all together—from the big picture to every message, visual, and asset.",
  },
  {
    heading: "Development & AI engineering",
    body: "Developing scalable digital products, intelligent systems, and working experiences.",
  },
  {
    heading: "Commercial strategy & growth opportunities",
    body: "Connects every decision to the business—clarifying the opportunity, guiding the transformation, and keeping it focused on growth.",
  },
];

/**
 * Screen two: the footer. It never *moves* under its own power — no slide, no rise,
 * no entrance of its own. It is already sitting here in the layout; the camera pans
 * onto it and the dots arrive, and that is the whole reveal. The one thing it does
 * do is resolve from transparent as the camera brings it up (see
 * FOOTER_REVEAL_EASE), which is a change of ink rather than of position, and so
 * leaves that intact — nothing here is anywhere it was not always going to be.
 *
 * Deliberately *not* h-screen. Its own content height is what the camera's travel is
 * measured from, so on a desktop it settles into the lower part of the frame and on
 * a phone — where the columns stack and it is nearly a screen tall by itself — it
 * fills almost all of it. One rule, two layouts, nothing to keep in sync.
 *
 * How high the columns can sit is not a free choice. The dots have to *fall* onto
 * them, and they leave from a wordmark on the frame's centre line, so a slot much
 * above that turns the fall into a lob. Because the footer is bottom-anchored, the
 * slots' height is set entirely by what is below them — the copy, the bar, and the
 * bottom padding — and not at all by the padding above. That is why the bar earns
 * its place: it fills the bottom of the screen, which is the only direction this
 * composition can grow without flattening the fall.
 *
 * Left on the site's own px-8/md:px-16 gutter while the frame above sits wider, and
 * the two are deliberately not one rhythm: the frame's padding is what the wordmark
 * comes to rest against and what the definition is inset by, so widening it was
 * about giving those two air. This is a three-column grid that wants the width.
 * Nothing animated reads either value — `padLeft` is measured off the frame, and the
 * dots' slots off their own elements on every refresh — so they can differ freely.
 *
 * `revealRefs` is filled in row order and the bottom bar takes the slot after the
 * last column, so the whole footer is one contiguous list for the single opacity
 * `renderTail` writes across all of them.
 */
export default function SiteFooter({
  footerRef,
  registerReveal,
  registerSlot,
  reducedMotion,
}: {
  footerRef: RefObject<HTMLDivElement | null>;
  /**
   * Callbacks rather than the ref arrays themselves, so the writes happen in the
   * owner's scope. Handing the arrays down and assigning into them here is a
   * component mutating its own props, which is what `react-hooks/immutability`
   * objects to — and it is right to: the rows are this component's business, but the
   * arrays the sequence reads are not.
   */
  registerReveal: (index: number, el: HTMLDivElement | null) => void;
  registerSlot: (index: number, el: HTMLSpanElement | null) => void;
  reducedMotion: boolean;
}) {
  return (
    <div
      ref={footerRef}
      className={`w-full px-8 md:px-16 ${reducedMotion ? "py-24" : "py-8 md:pt-[24vh] md:pb-8"}`}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-7 md:grid-cols-3 md:gap-10 lg:gap-14">
          {FOOTER_COLUMNS.map((col, i) => (
            /* Hidden from the first paint rather than only from the first
               render pass: the stage clips this away until the camera
               moves, so nothing would show anyway — but a restored scroll
               position lands mid-section, and this costs one attribute.
               Left alone under reduced motion, where no camera runs and
               the footer is simply part of the page. */
            <div
              key={col.heading}
              ref={(el) => registerReveal(i, el)}
              style={reducedMotion ? undefined : { opacity: 0 }}
            >
              {/* The landing pad, not the dot. It reserves the space and
                  is what `measure` reads the destination and the final
                  size from; the dot that ends up sitting in it fell here.
                  Under reduced motion nothing falls, so it is the dot. */}
              <span
                aria-hidden
                ref={(el) => registerSlot(i, el)}
                className={`block rounded-full ${reducedMotion ? "bg-accent" : ""}`}
                style={{
                  width: FOOTER_DOT_SIZE,
                  height: FOOTER_DOT_SIZE,
                }}
              />
              <h3
                className="mt-5 leading-[1.25] font-medium text-ink md:mt-8"
                style={{ fontSize: FOOTER_HEADING_SIZE }}
              >
                {col.heading}
              </h3>
              <p
                className="mt-3 leading-[1.55] font-light text-ink/70 md:mt-5 md:leading-[1.65]"
                style={{ fontSize: FOOTER_BODY_SIZE }}
              >
                {col.body}
              </p>
            </div>
          ))}
        </div>

        {/* Hidden below md, where the three stacked columns already run
            the full height of the frame and this would only be clipped
            off the bottom by the camera's own clamp. */}
        <div
          ref={(el) => registerReveal(FOOTER_COLUMNS.length, el)}
          style={reducedMotion ? undefined : { opacity: 0 }}
          className="mt-12 hidden border-t border-ink/15 pt-5 text-sm font-light text-ink/55 md:flex md:items-center md:justify-between"
        >
          <p>© {new Date().getFullYear()} ikra studio. All rights reserved.</p>
          <p>Rebranding agency for the most discerning ambitions.</p>
        </div>
      </div>
    </div>
  );
}
