"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useRevealOnView } from "@/lib/useRevealOnView";
import Logo from "./Logo";

function RevealBlock({
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
      className={`transition-all duration-1000 ease-out ${
        revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * How far this section stays pinned, in vh of actual scrolling, with every
 * phase below expressed in vh of it — same convention as HeroNarrative, and for
 * the same reason: the pin runs `top top` → `bottom bottom`, so progress 0→1
 * covers `height − 100vh`, not the whole height. Multiplying progress by the
 * section height would overstate every phase by half again.
 */
const PIN_VH = 260;
const SECTION_VH = PIN_VH + 100;

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
 * The editorial statement, with the round photo and the "ikra." wordmark
 * stacked below it, the wordmark layered over the photo.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH). Once the
 * statement is gone almost everything runs concurrently — the window, the
 * wordmark and the definition all start together at 50vh, and the phases are
 * listed by what they belong to rather than strictly by start time:
 *
 *     0–50vh  the statement slides up and out of frame, fading as it goes.
 *   50–110vh  the round window opens until it fills the screen. The photo
 *             behind it neither moves nor scales — it is already a full-bleed
 *             viewport-cover layer, counter-scaled each frame against the
 *             window's own scale (see placePhoto), so the window uncovers more
 *             of a sharp photo instead of magnifying a small one.
 *             "Fills the screen" is exact rather than eyeballed: the window
 *             scales to the farthest viewport corner from its own centre, so
 *             the frame is covered by ~101vh — see the fade below.
 *   80–110vh  the photo dissolves — starting at the halfway point of the zoom
 *             and finishing exactly as the zoom does. This deliberately begins
 *             *before* the window covers the frame: 20–34% of the screen is
 *             still gray at 80vh, so the photo reads as a circle blooming and
 *             dissolving rather than as a full-bleed frame that arrives, sits,
 *             and then leaves. It does still reach full coverage around 101vh,
 *             but by then it is down to ~30% opacity. This is a deliberate
 *             reversal of the older "never fade before coverage" rule, which
 *             existed to avoid exactly the gray this now shows on purpose.
 *   50–100vh  the wordmark slides left and up into the final composition,
 *             clearing the right half for the definition. It leaves with the
 *             definition rather than after it, so the two move together, and it
 *             lands while the photo is still dissolving. It then stays put for
 *             the rest of the pin.
 *   50–240vh  the definition travels up the right-hand side, from below the
 *             fold to clear off the top. It starts with the zoom, so it is
 *             already rising while the photo blooms behind it. No fade — a pure
 *             move, and the 190vh window means it crosses at 0.66–0.85× page-
 *             scroll speed (always slower than the page, so it can never rush)
 *             and holds fully visible for 45–114vh.
 *
 *             Together with the wordmark's 50–100vh slide, that leaves the two
 *             settled side by side — wordmark left, definition right — for
 *             45–102vh depending on viewport, which is the composition the
 *             whole section is built around. Shortening the definition's window
 *             or delaying the wordmark's eats into that overlap first.
 *  240–260vh  hold — the wordmark alone, then the pin releases into the footer.
 *
 * The photo used to be the wordmark's own dot, rendered inline after the
 * letters; it is now its own round image with the wordmark on top, so the
 * statement, the image and the wordmark read as one stacked composition.
 *
 * Pinned with GSAP rather than CSS `sticky`, which does not work under
 * ScrollSmoother's transform-based fake scroll (see the note in HeroNarrative).
 */
export default function DefinitionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const dictionaryRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const circle = circleRef.current;
    if (!section || !stage || !circle) return;

    const ctx = gsap.context(() => {
      // Circle's resting diameter, unaffected by the scale transform we're
      // about to apply to it.
      const baseSize = parseFloat(getComputedStyle(circle).width) || 1;
      // Circle centre, measured *relative to the stage* rather than assumed.
      // A viewport-absolute measurement would be wrong here: before the pin
      // engages, the stage still sits at its normal document position, possibly
      // thousands of pixels down the page. But once pinned its top is at the
      // viewport top — the pin starts at the section's `top top` and the stage
      // is the section's first child — so an offset inside the stage is the
      // on-screen position. The vertical centre used to be hardcoded to H/2,
      // which held only while the circle was centred in the stage; it now sits
      // below the statement, so it has to be measured.
      const stageRect = stage.getBoundingClientRect();
      const circleRect = circle.getBoundingClientRect();
      const cx = circleRect.left - stageRect.left + baseSize / 2;
      const cy = circleRect.top - stageRect.top + baseSize / 2;

      // Holds the photo layer exactly viewport-sized and viewport-aligned *on
      // screen* for any circle scale `s`, so the circle reads as a window
      // opening onto a still photo rather than as a photo being magnified.
      //
      // The circle scales about its own centre, which sits at viewport (cx, cy),
      // so a point at local coordinate p inside it lands on screen at
      // (cx, cy) + s·(p − baseSize/2). Solving that for "screen top-left =
      // (0, 0)" gives the offset below. Scaling the layer by 1/s then cancels
      // the circle's own scale, so its 100vw × 100vh box still measures
      // 100vw × 100vh on screen at every value of s — the photo is full-bleed
      // from the first frame and never changes size, which is the whole point:
      // it stays as sharp at full screen as it is inside the small circle.
      //
      // transformOrigin is set once, not per frame, and is the layer's top-left
      // so the translate above positions that exact corner.
      gsap.set(photoRef.current, { transformOrigin: "0 0" });
      const placePhoto = (s: number) => {
        gsap.set(photoRef.current, {
          x: baseSize / 2 - cx / s,
          y: baseSize / 2 - cy / s,
          scale: 1 / s,
        });
      };
      placePhoto(1);

      // How far the statement has to travel to clear the top of the stage:
      // exactly to where its own bottom edge meets the stage's top, so it is
      // fully gone rather than relying on the fade alone to hide a stub.
      const statementTravel = statementRef.current
        ? statementRef.current.getBoundingClientRect().bottom - stageRect.top
        : 0;

      // Where the wordmark has to travel to reach its final resting place:
      // hard left against the stage's own padding, and up to the vertical
      // middle now that the statement has gone. Measured rather than assumed so
      // it lands correctly whatever the wordmark's responsive size resolves to.
      const markRect = markRef.current?.getBoundingClientRect();
      const stagePadLeft =
        parseFloat(getComputedStyle(stage).paddingLeft) || 0;
      const markToLeft = markRect
        ? markRect.left - stageRect.left - stagePadLeft
        : 0;
      const markToMiddle = markRect
        ? markRect.top - stageRect.top + markRect.height / 2 - stageRect.height / 2
        : 0;

      // The definition's own height, so its travel can end with the whole block
      // clear of the top rather than at a guessed offset. Measured once — it is
      // a layout read, so keeping it out of the per-frame handler matters.
      const dictHeight = dictionaryRef.current?.offsetHeight ?? 0;

      // Parked below the fold before the first onUpdate, so it cannot flash over
      // the statement on the first paint.
      gsap.set(dictionaryRef.current, { y: stageRect.height });

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: stage,
        pinSpacing: false,
        onUpdate(self) {
          // Progress as real scroll distance through the pin, in vh.
          const vh = self.progress * PIN_VH;
          const W = document.documentElement.clientWidth;
          const H = window.innerHeight;
          // Exact farthest-corner distance from the circle's true centre,
          // not a generic diagonal-based guess — guarantees coverage with a
          // known, deliberate margin rather than hoping a heuristic holds
          // across every aspect ratio. Recomputed per frame because cy is
          // measured from the layout and H changes on resize.
          const corners = [
            [0, 0],
            [W, 0],
            [0, H],
            [W, H],
          ];
          const maxCornerDist = Math.max(
            ...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)),
          );
          const requiredDiameter = maxCornerDist * 2 * 1.15; // 15% margin
          const maxScale = requiredDiameter / baseSize;

          // --- Phase 1: the statement slides up and out (0 – 50vh) ---
          // Transform only, so it never disturbs the layout below it: the image
          // stays exactly where it was measured while the text leaves.
          const outP = gsap.utils.clamp(0, 1, vh / 50);
          gsap.set(statementRef.current, {
            y: -outP * statementTravel,
            opacity: 1 - outP,
          });

          // --- Phase 2: the window opens until it fills the screen (50–110vh) ---
          const growP = gsap.utils.clamp(0, 1, (vh - 50) / 60);

          // --- Phase 3: the photo dissolves (80 – 110vh) ---
          // 80 is the midpoint of the growth above, and that is the whole intent:
          // the dissolve starts while the window is still opening, so the photo
          // blooms and goes instead of arriving full-bleed and sitting there.
          //
          // It therefore starts well before coverage (~101vh) — at 80vh the disc
          // leaves 20–34% of the screen gray, depending on viewport, and that
          // gray is on purpose rather than a bug. An earlier version enforced
          // the opposite rule ("never fade before the frame is covered"); if the
          // brief ever swings back, the growth window is the knob, not this one:
          // coverage always lands at ~85% of the growth, whatever its length.
          const fadeP = gsap.utils.clamp(0, 1, (vh - 80) / 30);

          // One set, not two: a second gsap.set on the same element would
          // rewrite the whole transform and drop the scale.
          const scale = 1 + (maxScale - 1) * growP;
          gsap.set(circle, { scale, opacity: 1 - fadeP });

          // ...and the photo counter-scaled by exactly the inverse, so the
          // window opens over a photo that holds still. Without this the
          // circle's scale would drag the photo up to ~6× the size it was
          // rendered at, which is what made the full-screen frame look soft.
          placePhoto(scale);

          // --- Phase 4: the wordmark slides into place (50 – 100vh) ---
          // Left and up, clearing the right half of the screen for the
          // definition. Starts on the same frame as the definition below so the
          // two read as one movement, and lands at 100vh — early enough to be
          // settled before the definition is fully in frame on every viewport,
          // which is what gives the side-by-side composition its 45–102vh hold.
          // Safe to drive `x`/`y` here: the wordmark is placed by grid, not by a
          // Tailwind translate that this would overwrite.
          const markP = gsap.utils.clamp(0, 1, (vh - 50) / 50);
          gsap.set(markRef.current, {
            x: -markToLeft * markP,
            y: -markToMiddle * markP,
          });

          // --- Phase 5: the definition travels up (50 – 240vh) ---
          // A pure move, no fade: it starts below the fold the moment the window
          // begins opening, rises up the right-hand side while the photo blooms
          // and dissolves behind it, and finishes clear of the top.
          // `H` is read live rather than from the measurement above so the start
          // point stays correct after a resize.
          //
          // The 190vh window is the point. This used to sit outside the pin, so
          // it travelled at page speed and was gone before it had finished
          // arriving; driving the move against a window longer than the distance
          // means it crosses the frame slower than the page scrolls, and holds
          // fully visible for a long stretch in the middle. Each time the start
          // has moved earlier the end has stayed at 240, lengthening the window
          // rather than shifting it — which is why bringing the definition in
          // sooner has slowed it down (0.66–0.85× page scroll) instead of
          // rushing it. Shorten the window and the rush comes back.
          const dictP = gsap.utils.clamp(0, 1, (vh - 50) / 190);
          gsap.set(dictionaryRef.current, {
            y: gsap.utils.interpolate(H, -dictHeight, dictP),
          });

          // --- Phase 6: hold (240 – 260vh) — the wordmark alone, a beat before
          // the pin releases into the footer.
        },
      });
      /**
       * Section snapping for the handoff out of the hero, so this section
       * settles at the top of the screen instead of drifting halfway in.
       *
       * CSS scroll-snap cannot do this here, for the same reason `position:
       * sticky` doesn't work anywhere in this app: ScrollSmoother fakes
       * scrolling with a transform on #smooth-content (and sets
       * normalizeScroll), so the browser has no real scroll offset to snap to.
       * GSAP's snap drives ScrollTrigger.scroll itself, so it works regardless.
       *
       * Deliberately its own trigger covering ONLY the gap between the hero's
       * pin releasing and this section reaching the top — which is exactly the
       * 100vh where neither section's pin is active. Putting `snap` on the
       * scrubbed trigger above instead would yank the circle reveal to one end
       * whenever the user paused mid-way through it.
       */
      const handoff = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "top top",
        snap: {
          // Past a third of the way, commit to this section at the top;
          // before that, fall back to the finished hero. Never rests between.
          snapTo: (value) => (value > 0.34 ? 1 : 0),
          duration: { min: 0.25, max: 0.6 },
          delay: 0.06,
          ease: "power2.inOut",
        },
      });

      return () => {
        trigger.kill();
        handoff.kill();
      };
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-gray"
      style={{ height: reducedMotion ? "auto" : `${SECTION_VH}vh` }}
    >
      {/* One composition, not two layers. The statement used to be a sibling of
          the stage in normal flow, so once the stage was pinned — fixed, filling
          the viewport — its centred wordmark simply landed on top of the text.
          Both now live in the same flex column, which makes them siblings in a
          layout rather than independent layers, so they cannot overlap. */}
      <div
        ref={stageRef}
        className="relative flex h-screen w-full flex-col overflow-hidden px-8 pt-16 pb-10 md:px-16 md:pt-20"
      >
        {/* GSAP drives `y` on this wrapper while RevealBlock's own entrance
            transform stays on the element inside it — separate elements, so the
            two transforms compose instead of one clobbering the other. */}
        <div ref={statementRef}>
          <RevealBlock>
            <p className="max-w-4xl text-[26px] leading-[1.3] font-normal text-ink md:text-[39px]">
              We are rebranding agency for the most discerning ambitions. Our
              work transforms a simple idea into an experience of true rarity
              and prestige.
            </p>
          </RevealBlock>
        </div>

        {/* Takes whatever height the statement leaves. `min-h-0` lets it shrink
            rather than pushing back up into the text on a short viewport. */}
        <div className="relative mt-6 grid min-h-0 flex-1 place-items-center">
          {/* Grid stacking: both children sit in the same cell, so the brand
              name layers above the round image with no absolute positioning and
              no translate-centring for GSAP to overwrite later.

              Both are sized against vw *and* vh, capped in px, with a px floor.
              The vw term is what makes them big on a wide screen; the vh term
              stops them growing into the statement above on a short one — the
              only thing keeping the no-overlap guarantee honest, since the text
              takes its height first and this gets the remainder. The floor
              matters as much: on a phone the vw term alone collapses to under
              100px, which is the "so tiny it isn't visible" failure. */}
          {/* `relative` is load-bearing twice over: `<Image fill>` is absolute,
              so without it the photo would resolve against the grid group above
              and — because overflow only clips absolute descendants whose
              containing block is inside the clipper — escape the round mask
              entirely, rendering as a rectangle. */}
          <div
            ref={circleRef}
            aria-hidden
            className="relative col-start-1 row-start-1 overflow-hidden rounded-full"
            style={{
              width: "max(200px, min(24vw, 44vh, 420px))",
              height: "max(200px, min(24vw, 44vh, 420px))",
            }}
          >
            {/* The photo is deliberately NOT sized to the circle: it is a
                full-bleed viewport-cover layer, and the circle is only a window
                onto it. placePhoto counter-scales this against the circle's own
                scale every frame, so the window grows while the photo holds
                still. `w-screen h-screen` rather than measured pixels so a
                resize is the browser's job, not a stale measurement's — and
                `sizes` can honestly say 100vw, which is the other half of the
                sharpness fix (at 50vw Next served a ~960px file for what ends
                up a full-width frame).

                Reduced motion never runs placePhoto, so there it falls back to
                simply filling the circle. */}
            <div
              ref={photoRef}
              className={
                reducedMotion
                  ? "absolute inset-0"
                  : "absolute top-0 left-0 h-screen w-screen"
              }
            >
              <Image
                src="/img/section3-spoon.jpg"
                alt=""
                fill
                className="object-cover"
                sizes={reducedMotion ? "50vw" : "100vw"}
              />
            </div>
          </div>

          {/* Wider than the circle on purpose, so the wordmark overhangs it on
              both sides the way the reference does. Wrapped so the width can be
              a multi-term min() without relying on an arbitrary Tailwind value;
              Logo takes its height from its own aspect ratio. */}
          {/* `relative` here purely for paint order, and it is load-bearing:
              positioned siblings paint above non-positioned ones regardless of
              DOM order, so once the circle above became `relative` it started
              covering this. Making both positioned puts them back under plain
              tree order — circle, then wordmark, then the definition below.
              Deliberately no z-index: the definition must stay above this, and
              on a phone the two do overlap. */}
          <div
            ref={markRef}
            className="relative col-start-1 row-start-1"
            style={{ width: "max(300px, min(36vw, 66vh, 640px))" }}
          >
            <Logo className="w-full" color="var(--color-accent)" />
          </div>
        </div>

        {/* Inside the pinned stage so its upward travel can be driven against
            scroll rather than happening at page speed.

            Anchored at `top-0` with no vertical centring and no starting
            opacity: GSAP drives `y` on this element, which rewrites the whole
            transform, so a Tailwind `-translate-y-1/2` here would be wiped the
            instant the first frame ran. The travel itself puts it in place. */}
        {!reducedMotion && (
          <div
            ref={dictionaryRef}
            className="pointer-events-none absolute inset-x-8 top-0 md:inset-x-auto md:right-16 md:w-[42%] md:max-w-140"
          >
            {DICTIONARY_CONTENT}
          </div>
        )}
      </div>

      {/* Reduced motion only: nothing pins or fades, so the definition simply
          follows the stage in normal flow. The scrolled version renders its own
          copy inside the stage above — there must only ever be one, since both
          carry `dictionaryRef`. */}
      {reducedMotion && (
        <div className="px-8 pb-24 md:px-16">
          <RevealBlock className="max-w-md">{DICTIONARY_CONTENT}</RevealBlock>
        </div>
      )}
    </section>
  );
}
