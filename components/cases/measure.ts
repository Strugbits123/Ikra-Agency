import type { CaseRefs } from "./sequence";

/**
 * The layout figures every frame of the case studies is computed against. Reads the DOM;
 * writes nothing to it.
 *
 * Re-read on every ScrollTrigger refresh rather than once on mount, because all of it is
 * viewport-relative: a resize, a rotation or a mobile URL bar collapsing changes the
 * viewport width and therefore every figure below.
 */
export type CaseMeasure = {
  /** The viewport's width in px — the frame the track travels across. */
  viewportW: number;
  /**
   * The track's overflow, and therefore the pin's whole length: scroll this many pixels and
   * the track's right edge arrives at the viewport's right edge. One px of scrolling is one
   * px of horizontal travel, which is the reference's own relation and what makes the cells
   * move at the speed of the reader's hand rather than at some multiple of it.
   *
   * `0` when the track fits the viewport, which the sequence treats as "nothing to do".
   */
  distance: number;
  /** Per cell, in DOM order: its resting left edge within the track. */
  cellLeft: number[];
};

/**
 * `offsetLeft`, deliberately, and not `getBoundingClientRect().left`.
 *
 * `offsetLeft` is a *layout* value: it ignores transforms. The rect does not — and the track
 * carries the horizontal translation while each cell's content carries the rise, so a
 * refresh that happened mid-scroll would measure the cells wherever they had been painted
 * and bake the reader's position into the geometry. That is the same class of fault as
 * measuring from where a cued move landed, and it is silent.
 *
 * The track is `position: relative` in the markup so that it is the cells' `offsetParent`,
 * which is what makes `offsetLeft` mean "distance from the track's left edge" rather than
 * from some arbitrary ancestor.
 */
export function measureCases(refs: CaseRefs): CaseMeasure {
  const track = refs.track.current;
  const viewportW = document.documentElement.clientWidth;

  if (!track) return { viewportW, distance: 0, cellLeft: [] };

  const cellLeft = refs.cells.current.map((el) => el?.offsetLeft ?? 0);

  // `scrollWidth` rather than `offsetWidth`: the track is `w-max`, so the two agree, but
  // scrollWidth is the one that stays honest if a cell ever overflows it.
  const distance = Math.max(0, track.scrollWidth - viewportW);

  return { viewportW, distance, cellLeft };
}
