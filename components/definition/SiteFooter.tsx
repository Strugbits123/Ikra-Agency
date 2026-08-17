"use client";

import Image from "next/image";
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

/**
 * The three photographs above the columns, in the order they sit across the row.
 *
 * Filenames carry spaces, which `next/image` encodes for the optimiser — but they are
 * a hazard worth knowing about rather than tidying silently, since renaming them would
 * touch whatever else references them.
 *
 * `object-position` is per image and is doing real work: each box is a wide crop of a
 * portrait frame (see IMAGE_ROW_H), so the subject has to be aimed at deliberately. The
 * caviar and the hand are the point of all three, and in the first and third they sit
 * low in the original.
 */
const FOOTER_IMAGES = [
  {
    src: "/img/caviar luxury.jpg",
    alt: "Caviar spooned onto a guest's hand at a table",
    position: "50% 62%",
  },
  {
    src: "/img/caviar bumps.jpg",
    alt: "Guests in black tie with caviar served on the hand, champagne in hand",
    position: "50% 45%",
  },
  {
    src: "/img/caviar luxury 2.jpg",
    alt: "A guest tasting caviar from the back of her hand",
    position: "50% 68%",
  },
];

/**
 * The image row's height, as a custom property so the merged box below can be a
 * multiple of it rather than a second clamp restating the same arithmetic.
 *
 * **A height, not an aspect ratio, and that is load-bearing.** Each box is as wide as
 * the column beneath it and all three originals are portrait, so honouring their aspect
 * would make the row ~490px tall on a desktop. This footer has to stay inside one
 * viewport: it is the second screen of the camera's track, `camEnd` seats its bottom
 * edge, and anything that overflows is trimmed off the bottom — which is where the
 * columns are, and therefore where the dots are trying to land. Fixing the height and
 * cropping with `object-cover` bounds the row by construction at every viewport, which
 * an aspect ratio cannot.
 *
 * Much shorter below `md`, because that is where the budget is tight rather than where
 * the screen is small: the columns *stack* there, so they are three times as tall and
 * the footer already overflows the viewport on its own. 12vh keeps this row's
 * contribution to about 100px.
 *
 * 24vh on `md` and up, from 17. The binding case is not a big screen but a short one —
 * a 1024×600 window leaves the least slack of any desktop size, and 24vh clears it with
 * ~40px to spare while a 1440×900 has ~220px. The gain is in the crop rather than the
 * size: at 17vh a panel was a 2.5:1 slice of a portrait original, and at 24vh it is
 * 1.4–1.8:1 on a desktop and actually portrait on a tablet, which is what these
 * photographs want.
 *
 * None of this moves the dots. Their landing slots sit at `frameH − columnsHeight −
 * bottomPadding`, which is independent of everything above the columns — so the row can
 * be retuned freely without touching the fall. See the note in the component below.
 */
const IMAGE_ROW_VAR =
  "[--img-h:clamp(80px,12vh,160px)] md:[--img-h:clamp(120px,24vh,340px)]";

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
  registerImage,
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
  registerImage: (index: number, el: HTMLDivElement | null) => void;
  reducedMotion: boolean;
}) {
  return (
    <div
      ref={footerRef}
      /* `pt` is smaller now that the image row stands in the space it used to hold
         open. The row plus this is about what 24vh was, so the columns — and with
         them the dots' landing slots — sit where they always did. */
      className={`w-full px-8 md:px-16 ${IMAGE_ROW_VAR} ${reducedMotion ? "py-24" : "py-8 md:pt-[7vh] md:pb-8"}`}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* The three photographs, directly above the dots.

            Same grid as the columns below — same track count and the same gaps at
            every breakpoint — so each box is exactly its column's width without
            that width ever being restated. That is the whole reason this is a grid
            rather than three absolutely-placed boxes: "as wide as its column" then
            holds through both breakpoints and any later change to the gaps.

            Three across even below `md`, where the text columns stack. A stacked
            image row would be three full-width portraits tall, which no camera
            window can hold, and the merge would be a vertical collapse rather than
            the coming-together it is meant to read as.

            Under reduced motion the *same* row renders at zero gap, because that
            state is exactly the end state — three panels edge to edge making one
            continuous image. Nothing is substituted or hidden, which is why there is
            one branch here rather than two renderings to keep in step. */}
        <div
          className={`mb-6 grid grid-cols-3 md:mb-14 ${reducedMotion ? "gap-0" : "gap-7 md:gap-10 lg:gap-14"
            }`}
        >
          {FOOTER_IMAGES.map((img, i) => (
            /* `willChange` because all three carry a transform for the whole
               gesture, and the close runs alongside three falling dots and a
               panning camera — this is the frame budget's tightest moment.

               Hidden from the first paint for the same reason the columns are:
               the stage clips this away until the camera moves, but a restored
               scroll position lands mid-section. Left visible under reduced
               motion, where no clock ever runs to raise it. */
            <div
              key={img.src}
              ref={(el) => registerImage(i, el)}
              className="relative overflow-hidden"
              style={{
                height: "var(--img-h)",
                opacity: reducedMotion ? 1 : 0,
                willChange: reducedMotion ? undefined : "transform, opacity",
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                /* A third of the row at every breakpoint, since the row is
                   `grid-cols-3` throughout — so this is honest rather than the
                   usual `100vw` hedge. */
                sizes="33vw"
                className="object-cover"
                style={{ objectPosition: img.position }}
              />
            </div>
          ))}
        </div>

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
        {/* <div
          ref={(el) => registerReveal(FOOTER_COLUMNS.length, el)}
          style={reducedMotion ? undefined : { opacity: 0 }}
          className="mt-12 hidden border-t border-ink/15 pt-5 text-sm font-light text-ink/55 md:flex md:items-center md:justify-between"
        >
          <p>© {new Date().getFullYear()} ikra studio. All rights reserved.</p>
          <p>Rebranding agency for the most discerning ambitions.</p>
        </div> */}
      </div>
    </div>
  );
}
