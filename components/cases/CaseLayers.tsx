"use client";

import Image from "next/image";
import ArrowLink from "@/components/ArrowLink";
import type { ReactNode, RefObject } from "react";
import { CASE_EXPLORE, CASE_HEADING, type CaseProject } from "./projects";
import { IMAGE_ASPECT } from "./timeline";

/**
 * The track: one flex row of equal cells, translated by the paint in ./sequence.
 *
 * ## The heading is a cell, not chrome
 *
 * This is the structural finding from the reference, and it is what the earlier build got
 * most wrong: the section's title is not a banner pinned above the cards, it is the *first
 * cell of the track* and it slides away to the left with everything else. Measured, both
 * kinds of cell are one pitch wide — 952.4px against a 1905px viewport, i.e. exactly half of
 * it — so the track is a plain row and needs no per-kind arithmetic. A closing
 * call-to-action cell used to end the row on the same plan and has been removed by request;
 * see the note where it stood, above the tail run.
 *
 * ## The widths live here, the behaviour does not depend on them
 *
 * `w-[50vw]` and the image's `42vw` are the measured figures transcribed into classes; they
 * are documented and asserted as `CELL_VW` / `IMAGE_VW` in ./timeline. The paint never reads
 * either — it measures the cells back off the DOM (see ./measure) and its one width-relative
 * constant, `RISE_END_VW`, is a fraction of the *viewport* — so these two cannot drift out of
 * agreement with the animation, only with their own documentation.
 *
 * The image is `min(42vw, 89.9vh)` rather than a flat 42vw: 89.9vh is `IMAGE_MAX_VH × the
 * measured 1.45 aspect`, so the cap is applied to the *width* and the shape is never broken
 * to satisfy it. Below `md` a cell is a whole viewport, because half of a 390px screen is a
 * 195px card and no caption fits under one.
 */

/**
 * How a cell hands its elements back to the owner.
 *
 * A callback rather than the ref array itself: mutating a ref that arrived as a prop is what
 * `react-hooks/immutability` objects to, and the objection is sound — the component that
 * declares a ref should be the only thing that writes to it. CaseStudies owns both arrays and
 * passes down the two writers.
 */
export type CellRegistrar = (index: number, el: HTMLElement | null) => void;

/**
 * One cell. Every cell is the same box; only its contents differ.
 *
 * Two nested elements, and they cannot be collapsed: the cell holds the width and the
 * divider and never moves, and the content block inside it is what the rise writes `yPercent`
 * to. Written to one element, GSAP's transform would fight the flex centring.
 */
function Cell({
  index,
  registerCell,
  registerContent,
  reducedMotion,
  children,
}: {
  index: number;
  registerCell: CellRegistrar;
  registerContent: CellRegistrar;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  return (
    <div
      ref={(el) => registerCell(index, el)}
      className={
        (reducedMotion
          // `py-8` below `md`, `md:py-14` above it — tighter on a phone, where this
          // branch is now the mobile default rather than just the accessibility
          // fallback, and two cells' worth of padding stacking between cards read
          // as too much gap. Unchanged for a desktop reduced-motion viewer.
          ? "flex w-full shrink-0 justify-center px-[6vw] py-8 md:py-14"
          : "flex h-full w-[100vw] shrink-0 items-center justify-center md:w-[50vw]") +
        // The reference's cell divider: a hairline between cells, never before the first.
        (index > 0 ? " border-l border-ink/10" : "")
      }
    >
      <div
        ref={(el) => registerContent(index, el)}
        className="w-[88vw] md:w-[min(42vw,89.9vh)]"
        style={{ willChange: reducedMotion ? undefined : "transform" }}
      >
        {children}
      </div>
    </div>
  );
}

export function CaseTrack({
  projects,
  trackRef,
  registerCell,
  registerContent,
  reducedMotion,
}: {
  /** The cards, from the CMS by way of ./content — see `CaseStudies` for the thread. */
  projects: CaseProject[];
  trackRef: RefObject<HTMLDivElement | null>;
  registerCell: CellRegistrar;
  registerContent: CellRegistrar;
  reducedMotion: boolean;
}) {
  const cellProps = { registerCell, registerContent, reducedMotion };

  // The row's widest artwork, which is what sets everyone's height — see the note on the
  // project cells below. Derived rather than stated, so a new card cannot silently overflow
  // its cell by being wider than anything here anticipated.
  //
  // `IMAGE_ASPECT` is also the answer for an empty row: `Math.max()` of nothing is -Infinity,
  // which would be an `aspectRatio` of -Infinity on every frame in the row. The CMS cannot
  // actually deliver that (./content falls back to the in-repo cards before it gets here),
  // but the reference's own measured ratio is the honest floor either way.
  const widestAspect = Math.max(
    IMAGE_ASPECT,
    ...projects.map((p) => p.aspect ?? IMAGE_ASPECT),
  );

  return (
    <div
      ref={trackRef}
      className={
        reducedMotion
          ? "flex w-full flex-col items-center"
          : /* `w-max` so the row is exactly as wide as its content — that width minus the
               viewport is the pin's whole length, read straight off the DOM in ./measure.
               `relative` so the track is the cells' `offsetParent`, which is what makes
               their measured `offsetLeft` mean "distance from the track's left edge". */
          "relative flex h-full w-max flex-nowrap"
      }
      style={{ willChange: reducedMotion ? undefined : "transform" }}
    >
      {/* Cell 0 — the heading. Centred in its cell, like the closing panel. */}
      <Cell index={0} {...cellProps}>
        <div className="flex flex-col items-center text-center">
          <h2 className="text-[clamp(34px,4.1vw,84px)] leading-[1.09] font-light tracking-[-0.02em] text-ink">
            {CASE_HEADING.map((line, i) => (
              <span key={line} className="block">
                {line}
                {i === 0 ? "" : null}
              </span>
            ))}
          </h2>
          {/* <ArrowLink label={CASE_VIEW_ALL} href={null} className="mt-10 lg:mt-12" /> */}
        </div>
      </Cell>

      {/* One cell per project. */}
      {projects.map((project, i) => (
        <Cell key={project.id} index={i + 1} {...cellProps}>
          <article>
            {/*
              One frame for the whole row — same width, same height, so the captions sit on
              one line — and it is the *widest* artwork's ratio rather than the reference's
              measured 1.45. That choice is what keeps the captures whole: at 1.45 they lose
              ~12% off their sides, which on an interface is the CRM's right-hand panel and
              the edge of the QCIF page; at 1.687 the widest one is exact and the other loses
              2%, i.e. six pixels of browser chrome. What does give is the photograph, which
              is cropped top and bottom instead — the right way round, since a crop of a
              street is still a street.

              Feed the row artwork that shares one ratio and this collapses back to the
              reference's 1.45 with nothing cropped anywhere; see `aspect` in ./projects.

              No radius — the reference's frames are square cornered — and no overlay,
              gradient or scrim of any kind over the artwork.
            */}
            <div
              className={
                "relative w-full overflow-hidden bg-ink/5" +
                (project.rounded ? " rounded-xl" : "")
              }
              style={{ aspectRatio: widestAspect }}
            >
              {/* No `object-position` anywhere: every card centres its crop, which is what
                `object-cover` does unasked. A per-card focal point used to be a CMS column
                and is gone — one card ever used it, for 5% of its own height, against a
                client having to work out what "50% 45%" meant in a field beside their copy.
                If a card genuinely needs re-framing later it is a prop here and a column
                there again; it is not something the page should ask anyone to fill in. */}
              <Image
                src={project.imageSrc}
                alt={project.title}
                fill
                sizes="(min-width: 768px) 42vw, 88vw"
                className="object-cover"
                /* Only the first card is on screen when the pin engages, so it is the
                   only one worth fetching eagerly. */
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
              />
            </div>

            {/* The caption: title and description left, link right-aligned to the image's
                own right edge — from `md` up. Below that there isn't room for both side
                by side without squeezing the description into a sliver, which is what
                pushed "Explore project" hard against the edge; stacked instead, with the
                whole block capped to 75% of the card so it doesn't run the full width.
                `gap-4` below `md`: that gap is now vertical (description to button)
                rather than horizontal (description to button), so the original `gap-8`
                read as too much air between them; `md:gap-8` keeps the row's own
                horizontal gap unchanged. */}
            <div className="mt-6 flex w-[75%] flex-col items-start gap-4 md:w-full md:flex-row md:justify-between md:gap-8 xl:mt-8">
              <div>
                <h3 className="text-[clamp(18px,1.6vw,32px)] leading-tight font-normal text-ink">
                  {project.title}
                </h3>
                <p className="mt-2 max-w-[22em] text-[clamp(12px,0.85vw,17px)] leading-[1.45] font-light text-ink/55">
                  {project.description}
                </p>
              </div>
              <ArrowLink
                label={CASE_EXPLORE}
                href={project.link}
                className="mt-1 shrink-0"
              />
            </div>
          </article>
        </Cell>
      ))}

      {/* No closing cell. The track used to end on a call-to-action panel — three lines of
          copy and a "View all projects" link — and it is gone by request: the last project
          card is now the last thing the traverse passes, and the door opens on the contact
          panel straight after it. That reads better for the reason the panel exists at all,
          which is that it *is* the call to action; the cell in front of it was asking twice.

          Nothing about the section's timing had to change for it. Every length here is
          derived from the array the page is handed (see ./sequence), so the track is simply
          one pitch shorter, and `TRACK_TAIL_VW` is `(100 − CELL_VW) / 2` — it centres
          whichever cell happens to be last, so its assertion still holds with no closing
          panel to centre. */}

      {/* The tail run, so the last cell finishes its own travel and lands centred rather
          than parked at the right with its rise still short — see TRACK_TAIL_VW. Zero below
          `md`, where a cell is already a whole viewport and centred by definition. */}
      {reducedMotion ? null : (
        <div aria-hidden className="h-full w-0 shrink-0 md:w-[25vw]" />
      )}
    </div>
  );
}
