import type { RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { DOT_PHYSICS, LOGO_DOTS, planFall, type Fall } from "./dots";
import {
  DROP_LEAD_MIN,
  DROP_MARGIN_SECONDS,
  DROP_SECONDS,
  PAN_SECONDS,
} from "./timeline";

/** The elements the composition is measured against. */
export type MeasureEls = {
  /** The round window, whose computed width is the composition's base size. */
  circle: HTMLElement;
  /** The track's first screen — the composition's coordinate space. */
  frame: HTMLElement;
  /** Both screens, which is the space the footer's slots are measured in. */
  track: HTMLElement;
};

/** Everything else `measure` reads, as refs — none of it is guaranteed to exist. */
export type MeasureRefs = {
  statement: RefObject<HTMLDivElement | null>;
  mark: RefObject<HTMLDivElement | null>;
  dictionary: RefObject<HTMLDivElement | null>;
  footer: RefObject<HTMLDivElement | null>;
  slots: RefObject<(HTMLSpanElement | null)[]>;
  dots: RefObject<(HTMLSpanElement | null)[]>;
};

/**
 * Everything the per-frame handler needs from the layout, re-read whenever it can
 * have moved rather than measured once at mount. `cy` is why that matters: it aligns
 * the photo layer with the viewport, so a stale one leaves the growing window
 * uncovering the section background past the layer's edge — which reads as a
 * straight-edged crop on the photo.
 */
export type Measurements = {
  baseSize: number;
  cx: number;
  cy: number;
  frameH: number;
  statementTravel: number;
  markX: number;
  markY: number;
  markW: number;
  markH: number;
  markToLeft: number;
  markToMiddle: number;
  markCentreY: number;
  dictHeight: number;
  camEnd: number;
  /** Seconds into the tail at which the dots let go — solved in `measure`. */
  releaseAt: number;
  slots: ({ x: number; y: number; size: number } | null)[];
  dots: ({
    fromX: number;
    fromY: number;
    toX: number;
    scale0: number;
    fall: Fall;
  } | null)[];
};

/**
 * Position within `root`, accumulated up the offsetParent chain.
 *
 * Deliberately not getBoundingClientRect: rects include transforms, so a
 * rect-based measurement is only meaningful before anything has animated.
 * offsetTop/offsetLeft are layout values, so this can run mid-scroll with
 * the circle scaled six times over and still report where things *live*.
 *
 * Two roots are used. The composition is measured against `frame`, which
 * is the track's first screen and so sits at track origin — before the pin
 * engages the frame is still at its document position, and once pinned its
 * top is the viewport top, so an offset inside it *is* the on-screen
 * position. The footer's dot slots are measured against `track`, which
 * folds in the frame's own height, and the camera's `y` converts both to
 * the same screen space.
 */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (
    let node: HTMLElement | null = el;
    node && node !== root;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

/**
 * The layout figures and the function that refreshes them, handed back together
 * because that is how they are used: `measure()` writes into the same `m` every
 * caller reads, so the object identity is the contract and nothing ever re-reads a
 * stale copy.
 *
 * Called on ScrollTrigger's refresh, on `document.fonts.ready`, and from a
 * ResizeObserver — see ./sequence for why each of those is load-bearing.
 */
export function createMeasure(els: MeasureEls, refs: MeasureRefs) {
  const { circle, frame, track } = els;

  const m: Measurements = {
    baseSize: 1,
    cx: 0,
    cy: 0,
    frameH: 1,
    statementTravel: 0,
    markX: 0,
    markY: 0,
    markW: 1,
    markH: 1,
    markToLeft: 0,
    markToMiddle: 0,
    markCentreY: 0,
    dictHeight: 0,
    camEnd: 0,
    releaseAt: PAN_SECONDS + DROP_MARGIN_SECONDS,
    slots: [],
    dots: [],
  };

  function measure() {
    // Computed style rather than a rect, so the scale transform on the circle
    // doesn't affect it.
    m.baseSize = parseFloat(getComputedStyle(circle).width) || 1;
    const circleAt = offsetIn(circle, frame);
    m.cx = circleAt.x + m.baseSize / 2;
    m.cy = circleAt.y + m.baseSize / 2;
    m.frameH = frame.offsetHeight || 1;

    // Exactly to where the statement's own bottom edge meets the frame's top,
    // so it is fully gone rather than relying on the fade to hide a stub.
    const statement = refs.statement.current;
    m.statementTravel = statement
      ? offsetIn(statement, frame).y + statement.offsetHeight
      : 0;

    // The wordmark's final resting place: hard left against the frame's
    // padding, and up to the vertical middle. Its centre line is kept too,
    // since the wordmark's cue is derived from where the definition is
    // relative to it, and its box because the dots are placed inside it.
    const mark = refs.mark.current;
    const padLeft = parseFloat(getComputedStyle(frame).paddingLeft) || 0;
    if (mark) {
      const markAt = offsetIn(mark, frame);
      m.markX = markAt.x;
      m.markY = markAt.y;
      m.markW = mark.offsetWidth || 1;
      m.markH = mark.offsetHeight || 1;
      m.markToLeft = markAt.x - padLeft;
      m.markCentreY = markAt.y + mark.offsetHeight / 2;
      m.markToMiddle = m.markCentreY - m.frameH / 2;
    }

    // So the definition's travel can end with the whole block clear of the
    // top rather than at a guessed offset.
    const dict = refs.dictionary.current;
    m.dictHeight = dict?.offsetHeight ?? 0;

    // The settled composition's one hard geometric requirement: the panel's resting
    // box has to clear the wordmark's. Asserted on the measured boxes rather than on
    // the constants they were solved from, which makes this the real property and not
    // a proxy for it — a change to the frame's padding, to MARK_WIDTH, or to the
    // panel's own width all show up here, and they move one box without the other
    // because the two scale by different laws (see DictionaryPanel).
    //
    // `offsetWidth > 0` is the visibility gate: below `lg` the panel is `hidden` and
    // the definition renders in normal flow instead, where there is nothing to clear.
    // offsetLeft is a layout value, so this reads correctly mid-flight with GSAP's `y`
    // on the element.
    if (
      process.env.NODE_ENV !== "production" &&
      dict &&
      dict.offsetWidth > 0
    ) {
      const clearance = offsetIn(dict, frame).x - (padLeft + m.markW);
      if (clearance < 0) {
        console.error(
          "[DefinitionSection] the definition's resting box overlaps the wordmark's " +
          `by ${(-clearance).toFixed(0)}px, so the words will climb across the logo ` +
          "however the two are timed — the wordmark's lead can only separate them in " +
          "time, not in space. Narrow the panel against MARK_WIDTH, widen the frame, " +
          "or move the panel's breakpoint up so this width takes the in-flow " +
          "rendering. See DictionaryPanel.",
          {
            panelLeft: offsetIn(dict, frame).x,
            markRestRight: padLeft + m.markW,
            markW: m.markW,
            padLeft,
          },
        );
      }
    }

    // How far the camera travels: enough to bring the footer's bottom edge
    // onto the viewport's. Measured rather than "one viewport" so the footer
    // can be whatever height its own content makes it — a low band on a
    // desktop, most of the screen once the columns stack on a phone — and
    // still come to rest properly seated.
    //
    // Both clamps matter. Zero, so a footer shorter than the space below it
    // cannot pan backwards. And the footer's own top, because a footer
    // *taller* than the viewport cannot seat both edges: it has to lose one,
    // and it must be the bottom. Losing the top would take the first
    // column's dot off the screen with it, and a dot that lands somewhere
    // the reader cannot see is the one failure this whole sequence cannot
    // survive. On a short phone that trims a little of the bottom padding.
    const footer = refs.footer.current;
    if (footer) {
      const footerTop = offsetIn(footer, track).y;
      const seated = m.frameH - (footerTop + footer.offsetHeight);
      m.camEnd = Math.min(0, Math.max(seated, -footerTop));
    } else {
      m.camEnd = 0;
    }

    // Where each dot is going. The dot element takes the slot's size, and the
    // slot is itself derived from the wordmark's dot (see FOOTER_DOT_SIZE), so
    // this is the size the dot had on the wordmark — the flight neither grows nor
    // shrinks it, whatever the viewport resolves those terms to.
    m.slots = LOGO_DOTS.map((_, i) => {
      const slot = refs.slots.current[i];
      if (!slot) return null;
      const at = offsetIn(slot, track);
      const size = slot.offsetWidth || 1;
      const dot = refs.dots.current[i];
      if (dot) gsap.set(dot, { width: size, height: size });
      return { x: at.x + size / 2, y: at.y + size / 2, size };
    });

    // Both ends of every fall, and the trajectory between them, solved here
    // rather than per frame — none of it changes until the layout does.
    //
    // The release point is the wordmark at rest, i.e. after its slide left,
    // which is settled 150vh before any of this begins. Taking the rest
    // position rather than the live one is what lets the trajectory be
    // planned ahead: a dot cannot be handed a fall if its floor is still
    // being decided.
    const restX = m.markX - m.markToLeft;
    const restY = m.markY - m.markToMiddle;
    m.dots = LOGO_DOTS.map((d, i) => {
      const slot = m.slots[i];
      if (!slot) return null;
      const fromY = restY + d.cy * m.markH;
      const phys = DOT_PHYSICS[i];
      return {
        fromX: restX + d.cx * m.markW,
        fromY,
        toX: slot.x,
        // 1 by construction now that the slot is sized from this same product
        // (see FOOTER_DOT_SIZE), so the glide below is a no-op on scale. Kept as
        // a ratio rather than dropped: it is the thing that guarantees the dot
        // leaves at the wordmark's size, and a rounded slot measurement or a
        // future change at either end should be absorbed here, not seen.
        scale0: (d.d * m.markW) / slot.size,
        fall: planFall(
          slot.y + m.camEnd - fromY,
          phys.lift,
          phys.restitution,
        ),
      };
    });

    // One gravity for all three: the longest trajectory gets the whole
    // budget and the others get the same fraction of it that their own
    // flight time is of that one. A dot with half the drop then finishes
    // early and sits there, which is what actually happens when you drop two
    // balls from different heights.
    const longest = Math.max(
      1,
      ...m.dots.map((d) => d?.fall.total ?? 0),
    );
    for (const d of m.dots) {
      if (d) d.fall.share = d.fall.total / longest;
    }

    // And when they may let go: as late as they can, but early enough that
    // the *soonest* of them to touch down still does so after the camera has
    // stopped. Since each flight lasts DROP_SECONDS·total/longest, a dot's
    // lead to its own first landing is DROP_SECONDS·land/longest — exact,
    // and free, because the falls are already solved.
    //
    // Solved here rather than written as a constant because the lead swings
    // by more than a fixed margin can absorb: it is about a third of a fall
    // on a desktop and an eighth on a short phone, where the stacked footer
    // can leave a slot almost level with its own dot. A single hand-set
    // release has to be conservative enough for the worst of those, which
    // then leaves the dots hanging that much longer on every other viewport.
    const lead = Math.min(
      ...m.dots.map((d) =>
        d ? (DROP_SECONDS * d.fall.land) / longest : Infinity,
      ),
    );
    m.releaseAt = Math.max(
      0,
      PAN_SECONDS +
      DROP_MARGIN_SECONDS -
      (Number.isFinite(lead) ? lead : DROP_LEAD_MIN * DROP_SECONDS),
    );

    if (
      process.env.NODE_ENV !== "production" &&
      lead < DROP_LEAD_MIN * DROP_SECONDS
    ) {
      console.error(
        "[DefinitionSection] a dot would land before the camera stops: " +
        `measured lead ${lead.toFixed(2)}s is under DROP_LEAD_MIN ` +
        `(${(DROP_LEAD_MIN * DROP_SECONDS).toFixed(2)}s). Lower that ` +
        "constant — TAIL_SECONDS is derived from it, so the gesture grows " +
        "as it falls.",
        { lead, releaseAt: m.releaseAt },
      );
    }
  }

  return { m, measure };
}
