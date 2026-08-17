import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import {
  ANT_SPAN,
  DOT_PENETRATE_PX,
  DOT_PHYSICS,
  KICK_SPAN,
  LOGO_DOTS,
  bump,
  fallAt,
  penetrationAt,
} from "./dots";
import { heroWash } from "../hero/handoff";
import { createMeasure } from "./measure";
import {
  DICT_AT,
  DICT_VH,
  DROP_SECONDS,
  FADE_AT,
  FADE_VH,
  FOOTER_REVEAL_EASE,
  GROW_AT,
  GROW_VH,
  LOGO_FADE_AT,
  LOGO_FADE_EASE,
  LOGO_FADE_VH,
  IMAGE_IN,
  IMAGE_IN_EASE,
  IMAGE_MERGE_EASE,
  MARK_APPROACH_FRAC,
  MARK_CLEAR_PX,
  PAN_EASE,
  PAN_SECONDS,
  PIN_VH,
  STATEMENT_FADE_EASE,
  STATEMENT_LIFT_END_PCT,
  STATEMENT_LIFT_VH,
  STATEMENT_REVEAL_AT_PCT,
  STATEMENT_VH,
  TAIL_AT,
  TAIL_BACK_SECONDS,
  TAIL_SECONDS,
  VEIL_VH,
} from "./timeline";

/**
 * The elements resolved before the sequence is built. All five are guarded by the
 * caller, so they are values rather than refs — the pin, the clip and every
 * measurement need them on the first frame.
 */
/**
 * 0 before the span, 1 after it, linear in between — the hero's `ramp` by another
 * name, and deliberately a second copy rather than an import. Everything this section
 * borrows from `../hero/timeline` is a *number the two must agree on*; a shared helper
 * would be neither, and would put a change to one section's arithmetic inside the
 * other's blast radius.
 */
const spanP = (v: number, [from, to]: readonly [number, number]) =>
  gsap.utils.clamp(0, 1, (v - from) / (to - from));

export type SequenceEls = {
  /** Pinned by the ScrollTrigger: one viewport, clipping the track. */
  stage: HTMLDivElement;
  /** Both screens. The camera moves this. */
  track: HTMLDivElement;
  /** The track's first screen, and the composition's coordinate space. */
  frame: HTMLDivElement;
  /** The round window. Scaled by `render`, measured by `measure`. */
  circle: HTMLDivElement;
};

/**
 * Everything else the sequence drives, as refs rather than resolved elements —
 * the definition and the falling dots do not render at all under reduced motion,
 * and the footer's rows fill in as React commits them.
 */
export type SequenceRefs = {
  /** The full-bleed layer inside the round window, counter-scaled every frame. */
  photo: RefObject<HTMLDivElement | null>;
  /** The statement's wrapper, which carries the exit. */
  statement: RefObject<HTMLDivElement | null>;
  /** The element inside it, which carries the entrance — see paintStatement. */
  statementReveal: RefObject<HTMLDivElement | null>;
  /** The gray slab dissolving the hero out. */
  veil: RefObject<HTMLDivElement | null>;
  mark: RefObject<HTMLDivElement | null>;
  dictionary: RefObject<HTMLDivElement | null>;
  footer: RefObject<HTMLDivElement | null>;
  /** The footer's rows, faded as one — see FOOTER_REVEAL_EASE. */
  reveals: RefObject<(HTMLDivElement | null)[]>;
  /** The three photographs above the footer's columns, merged in the tail. */
  images: RefObject<(HTMLDivElement | null)[]>;
  /** The landing pads the dots aim at. */
  slots: RefObject<(HTMLSpanElement | null)[]>;
  /** The dots themselves. */
  dots: RefObject<(HTMLSpanElement | null)[]>;
};

/**
 * The section's scroll-driven sequence: one pinned stage, one ScrollTrigger for the
 * scrubbed phases, and a second clock for the tail that scroll only *cues*. The
 * beat-by-beat map is in ./timeline.
 *
 * Two smaller triggers sit alongside the pin because neither can be a phase of it:
 * the veil and the statement's entrance both have to run *before* the pin exists,
 * while this section's top edge is still crossing the screen.
 *
 * A plain function rather than a hook: the caller owns the effect and its
 * dependencies, and everything created here is collected by the returned context.
 */
export function createDefinitionSequence(
  section: HTMLElement,
  els: SequenceEls,
  refs: SequenceRefs,
) {
  const { stage, track, frame, circle } = els;

  return gsap.context(() => {
    const { m, measure } = createMeasure(
      { circle, frame, track },
      {
        statement: refs.statement,
        mark: refs.mark,
        dictionary: refs.dictionary,
        footer: refs.footer,
        images: refs.images,
        slots: refs.slots,
        dots: refs.dots,
      },
    );
    measure();

    // Holds the photo layer exactly viewport-sized and viewport-aligned *on
    // screen* for any circle scale `s`, so the circle reads as a window opening
    // onto a still photo rather than a photo being magnified.
    //
    // The circle scales about its own centre at viewport (cx, cy), so a point
    // at local coordinate p lands at (cx, cy) + s·(p − baseSize/2); solving for
    // "screen top-left = (0, 0)" gives the offset. Scaling by 1/s cancels the
    // circle's own scale, so the layer's 100vw × 100vh box still measures
    // 100vw × 100vh at every s — full-bleed and as sharp at full screen as it
    // is inside the small circle.
    //
    // It is aligned to a measured centre, so it must be re-placed after any
    // re-measure, not just on scroll. transformOrigin is the layer's top-left,
    // set once, so the translate positions that exact corner.
    gsap.set(refs.photo.current, { transformOrigin: "0 0", force3D: true });
    const placePhoto = (s: number) => {
      gsap.set(refs.photo.current, {
        x: m.baseSize / 2 - m.cx / s,
        y: m.baseSize / 2 - m.cy / s,
        scale: 1 / s,
        force3D: true,
      });
    };
    placePhoto(1);

    // Parked below the fold before the first render, so it cannot flash over
    // the statement on the first paint.
    gsap.set(refs.dictionary.current, { y: m.frameH });

    // One frame of the sequence, from the pin's progress. Named rather than
    // inline in the trigger because it has to be callable after a re-measure:
    // waiting for the next scroll event would leave the photo visibly out of
    // register in the meantime.
    // The scroll clock's last reading, kept because `paintDots` is driven from
    // both clocks and only one of its two callers has this to hand.
    let vhNow = 0;

    function render(progress: number) {
      // Progress as real scroll distance through the pin, in vh.
      const vh = progress * PIN_VH;
      vhNow = vh;
      const W = document.documentElement.clientWidth;
      const H = window.innerHeight;
      // Exact farthest-corner distance from the circle's true centre rather
      // than a diagonal-based guess, so coverage is guaranteed with a known
      // margin on every aspect ratio. Recomputed per frame because cy is
      // measured from the layout and H changes on resize.
      const corners = [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ];
      const maxCornerDist = Math.max(
        ...corners.map(([x, y]) => Math.hypot(x - m.cx, y - m.cy)),
      );
      const requiredDiameter = maxCornerDist * 2 * 1.15; // 15% margin
      const maxScale = requiredDiameter / m.baseSize;

      // --- Phase 1: the statement slides up and out (0 – 50vh) ---
      // Transform only, so it never disturbs the layout below it: the image
      // stays exactly where it was measured while the text leaves.
      const outP = gsap.utils.clamp(0, 1, vh / STATEMENT_VH);
      gsap.set(refs.statement.current, {
        y: -outP * m.statementTravel,
        opacity: 1 - outP,
      });

      // --- Phase 2: the window opens until it fills the screen ---
      const growP = gsap.utils.clamp(0, 1, (vh - GROW_AT) / GROW_VH);

      // --- Phase 3: the photo dissolves ---
      // FADE_AT is the growth's midpoint, so the dissolve starts while the
      // window is still opening and the photo blooms and goes rather than
      // arriving full-bleed and sitting there. The gray it leaves showing is
      // on purpose; the growth window is the knob if that has to change, since
      // coverage always lands at ~85% of it.
      const fadeP = gsap.utils.clamp(0, 1, (vh - FADE_AT) / FADE_VH);

      // One set, not two: a second gsap.set on the same element would rewrite
      // the whole transform and drop the scale.
      const scale = 1 + (maxScale - 1) * growP;
      gsap.set(circle, { scale, opacity: 1 - fadeP, force3D: true });

      // ...and the photo counter-scaled by exactly the inverse, so the window
      // opens over a photo that holds still. Without this the circle's scale
      // would drag the photo to ~6× the size it was rendered at.
      placePhoto(scale);

      // --- Phase 5: the definition travels up (50 – 300vh) ---
      // A pure move, no fade: it starts below the fold as the window begins
      // opening, rises while the photo blooms behind it, and finishes clear of
      // the top. `H` is read live so the start point survives a resize.
      //
      // Computed before the wordmark, even though it happens after it on
      // screen, because the wordmark's cue derives from where this has got to.
      const dictP = gsap.utils.clamp(0, 1, (vh - DICT_AT) / DICT_VH);
      gsap.set(refs.dictionary.current, {
        y: gsap.utils.interpolate(H, -m.dictHeight, dictP),
      });

      // --- Phase 4: the wordmark slides aside, and is *finished* doing so before
      // the definition reaches it ---
      // Left, and barely up at all: the grid centres the composition on the
      // frame, so it starts within ~20px of its final height.
      //
      // Two things about this were wrong together, and they are why the
      // definition climbed across the logo.
      //
      // The reference point was the definition's top edge drawing level with the
      // wordmark's *centre* line, which is already half a wordmark too late: the
      // block is wider than the space beside the letterforms, so it is on them
      // well before its top edge is anywhere near their middle. It is now the
      // moment that edge would first touch the wordmark's *box* at all.
      //
      // And the slide had a window in vh, which is the deeper fault — a window
      // cannot know where the definition is, and that is the only thing this move
      // is about. Anchored to its near end it finished 35vh after the definition
      // arrived; re-anchored to its far end it opened at ~48vh against a
      // definition that does not start climbing until 50, so the wordmark drifted
      // off centre with nothing on screen to explain it. Same fault twice.
      //
      // So it is driven off the *gap between the two* instead. `markP` is the
      // definition's own approach, measured from where it clears the bottom of the
      // screen to where it touches the wordmark, and the slide is spread over the
      // last MARK_APPROACH_FRAC of it. Three things come out of that shape at once:
      // it cannot start before the definition does (at dictP 0 the numerator is
      // negative), it lands exactly as the definition arrives at every viewport,
      // and how far off the wordmark reacts from is one legible fraction rather
      // than a vh figure that has to be re-derived whenever anything above it
      // moves.
      //
      // What actually has to hold is horizontal: the wordmark's right edge clear
      // of the panel's left edge. That threshold is a different fraction of the
      // slide at every width — 72% at 1024, 53% at 1440, ~0 at 1920, because the
      // wordmark floors at 240px while the panel's edge is a percentage — so
      // rather than track it, the slide simply finishes.
      //
      // Safe to drive `x`/`y` here: the wordmark is placed by grid, not by a
      // Tailwind translate that this would overwrite.
      //
      // Its lowest edge across the whole slide, since it drifts a little
      // vertically too: whichever of the two positions sits further down is the
      // one contact happens against.
      const markBottom =
        Math.max(m.markY, m.markY - m.markToMiddle) + m.markH;
      // The definition's own progress when its top edge reaches that, less the
      // clearance it keeps. Measured, so it is right on any viewport — when the
      // two meet depends on the screen's height and on how tall the definition
      // renders, neither of which a fixed vh mark can know.
      const touchP = gsap.utils.clamp(
        0,
        1,
        (H - markBottom - MARK_CLEAR_PX) / (H + m.dictHeight),
      );
      // The stretch of that approach the slide occupies, guarded against a zero
      // span on a viewport where the two are already in contact at dictP 0.
      const markSpan = Math.max(1e-4, touchP * MARK_APPROACH_FRAC);
      const markP = gsap.utils.clamp(0, 1, (dictP - (touchP - markSpan)) / markSpan);

      // --- Phase 7: the wordmark dissolves (330 – 422vh) ---
      // In place, not away: it does not move, shrink or rise, it just stops
      // being there. The three dots are separate elements standing on top of
      // the artwork's own at full opacity, so the letterforms thin out from
      // under them and leave the dots hanging. Nothing is masked and nothing
      // is cut out of the PNG — the dots are simply the part that does not
      // fade.
      const markFadeP = LOGO_FADE_EASE(
        gsap.utils.clamp(0, 1, (vh - LOGO_FADE_AT) / LOGO_FADE_VH),
      );
      gsap.set(refs.mark.current, {
        x: -m.markToLeft * markP,
        y: -m.markToMiddle * markP,
        opacity: 1 - markFadeP,
      });

      paintDots();

      // --- Phase 8: the tail is cued, and from here it is on its own clock.
      // A threshold rather than a span, crossed in either direction, latched
      // inside runTail — so this is the last thing scroll has any say over.
      runTail(vh >= TAIL_AT);
    }

    /**
     * One frame of the tail, from its own clock in seconds — the camera onto
     * the footer and the three falls. Everything here is deliberately off the
     * scrub (see TAIL_AT): a thrown ball frozen between two bounces stops
     * being a ball, and that is the one state in this section that has no
     * reading as a still image.
     *
     * Nothing about the motion changed in moving it here. The pan is the same
     * eased travel over the same measured distance; each fall is the same
     * solved trajectory read at the same relative rate, since a flight's share
     * of DROP_SECONDS is the same share of the whole it used to have of the
     * scroll budget.
     */
    function renderTail(t: number) {
      // --- the camera pans onto the footer (0 – 0.9s) ---
      const panP = PAN_EASE(gsap.utils.clamp(0, 1, t / PAN_SECONDS));
      gsap.set(track, { y: panP * m.camEnd });

      // --- and its contents resolve in, over exactly the dots' flight ---
      // One value for all of them: the whole footer is always at one opacity,
      // so there is no frame where some of it has resolved and the rest has
      // not. It outlasts the camera by more than a second, which is the point —
      // a fade that fits inside the pan is spent while the footer is still
      // rising and over before there is anything settled to look at.
      const revealP = FOOTER_REVEAL_EASE(
        gsap.utils.clamp(0, 1, (t - m.releaseAt) / DROP_SECONDS),
      );
      for (const el of refs.reveals.current) {
        if (el) gsap.set(el, { opacity: revealP });
      }

      // --- the three photographs resolve, then close into one ---
      //
      // On this clock rather than the scrub, so the close is frame-locked to the
      // fall below it — see IMAGE_IN for why that is not a shortcut. Two windows
      // on the one clock: they come up with the camera and finish resolving
      // before it stops, which leaves a beat where they are plainly three
      // separate images; then the gaps close over exactly the dots' flight, so
      // the row seals as the last dot settles.
      //
      // `x` is the only thing written. No scale and no opacity of its own — the
      // panels keep their width, height and proportions for the whole gesture and
      // simply slide until their edges meet, which is what makes the end state one
      // continuous photograph in three panels rather than a stack. The middle one
      // is the anchor and its `dx` is 0, so the row closes inward symmetrically
      // and the finished image stays centred over the columns.
      const imageInP = IMAGE_IN_EASE(spanP(t / PAN_SECONDS, IMAGE_IN));
      const mergeP = IMAGE_MERGE_EASE(
        gsap.utils.clamp(0, 1, (t - m.releaseAt) / DROP_SECONDS),
      );
      for (let i = 0; i < refs.images.current.length; i++) {
        const el = refs.images.current[i];
        const g = m.images[i];
        if (!el || !g) continue;
        gsap.set(el, { x: g.dx * mergeP, opacity: imageInP });
      }


      // --- the dots fall (from m.releaseAt) ---
      //
      // The vertical is not an interpolation. `fallAt` returns a *position
      // under acceleration* — thrown up as it lets go, accelerating down,
      // then a parabola per bounce, each one shorter and lower than the last
      // (see planFall). Reading the trajectory against a clock is what makes
      // it read as weight instead of as a tween: the dot is genuinely moving
      // fastest just before each impact and slowest at the top of each hop,
      // which no easing curve applied to a lerp will do, because a lerp has
      // one arrival and gravity has four.
      //
      // Only the sideways travel is eased, and only because horizontal motion
      // has no equivalent story — it is launched and bleeds off.
      //
      // Both ends are fixed points *on screen*, with the camera in neither.
      // That matters, and the obvious alternative does not work: interpolate
      // between the dot's live position on the wordmark and its slot's live
      // position on the rising footer, and both endpoints race upward while
      // the dot crosses between them, which throws it off the bottom of the
      // screen and back. Fixed endpoints mean the dots hang in the viewport
      // and fall through it while the page pans behind them.
      const driftScale = Math.min(1, document.documentElement.clientWidth / 1440);
      for (let i = 0; i < LOGO_DOTS.length; i++) {
        const dot = refs.dots.current[i];
        const d = m.dots[i];
        if (!dot || !d) continue;

        // One release for all three (see DROP_SECONDS), solved in `measure`.
        // Each flight then runs at its own length — that is the one gravity.
        const p = gsap.utils.clamp(
          0,
          1,
          (t - m.releaseAt) / (DROP_SECONDS * d.fall.share),
        );
        const ph = DOT_PHYSICS[i];
        // Its own exponent, so the lateral travel is not a shared curve
        // either: launched with some speed and bleeding it off, still drifting
        // through the first bounce and laying down the last of it as it rests.
        const glide = 1 - (1 - p) ** ph.drag;

        gsap.set(dot, {
          xPercent: -50,
          yPercent: -50,
          // Bow, then the release kick, then the ring. The bow rides raw
          // progress so it closes exactly as the dot comes to rest; the other
          // two are spent long before that, so none of them can leave the dot
          // parked beside its column.
          x:
            gsap.utils.interpolate(d.fromX, d.toX, glide) +
            Math.sin(Math.PI * p) * ph.drift * driftScale +
            bump(p, KICK_SPAN) * ph.kick,
          // The solved trajectory, plus the load-up before it — a few px back
          // into the wordmark while the launch is still winding up — plus the
          // give as it hits.
          y:
            d.fromY +
            fallAt(d.fall, p) +
            bump(p, ANT_SPAN) * ph.anticipate +
            penetrationAt(d.fall, p),
          // Squash, on the two occasions a rubber ball has one: winding up to
          // launch, and again on each impact — where it rides the same pulse
          // as the penetration, because they are the same event. As a counter
          // -move in `y` the load-up was invisible; the launch velocity buries
          // it inside the first frame. On scale it reads, and it cannot fight
          // gravity. Both terms are zero by p = 1, so the dot still settles at
          // exactly the footer's own dot size.
          scale:
            gsap.utils.interpolate(d.scale0, 1, glide) *
            (1 -
              0.09 * bump(p, ANT_SPAN) -
              (0.11 * penetrationAt(d.fall, p)) / DOT_PENETRATE_PX),
        });
      }

      // Presence depends on this clock as well as the scroll's, and this one
      // keeps running after the scrolling stops — so it has to be rewritten
      // here too, or a dot would hold whatever opacity the last scroll event
      // left it at while it flew.
      paintDots();
    }

    /**
     * The dots' *presence* — visibility and opacity — as opposed to their
     * movement. It reads from both clocks, and that is the whole point.
     *
     * The crossfade belongs to the scrubbed dissolve: each dot is a solid
     * element standing on the artwork's own, and it fades up across the back
     * of the wordmark's fade so the two together always paint one solid dot.
     * Snapping it on at full opacity instead made the second and third glitch
     * — any sub-pixel difference in size between overlay and artwork reads as
     * the dot jumping just as the letterforms start to go.
     *
     * But that crossfade only means anything while a dot is still *on* the
     * wordmark. Once it has let go it has to be solid, and putting it on the
     * scroll clock alone got that wrong in one direction: scrolling back up,
     * the fade runs home across 74vh of scroll while the flight home takes a
     * fixed TAIL_BACK_SECONDS, so anything faster than about 67vh per second
     * faded the dot out from under itself and it arrived invisible. `detached`
     * holds it opaque for exactly as long as it is away, and hands it back to
     * the dissolve as it lands — continuously, since the two agree at t = 0.
     *
     * Scrolling *down* this changes nothing at all: the dissolve is already
     * complete at the moment the tail is cued, so both terms are 1 throughout.
     */
    function paintDots() {
      const detached =
        m.releaseAt > 0
          ? gsap.utils.clamp(0, 1, tail.t / m.releaseAt)
          : Number(tail.t > 0);
      const opacity = gsap.utils.interpolate(
        gsap.utils.clamp(
          0,
          1,
          (vhNow - (LOGO_FADE_AT + LOGO_FADE_VH * 0.2)) /
          (LOGO_FADE_VH * 0.8),
        ),
        1,
        detached,
      );
      // Hidden before the dissolve begins — these are children of the stage,
      // so they paint above the frame's entire contents, including the
      // definition, which has to pass *over* the wordmark where the two
      // overlap on a phone. `tail.t` keeps them alive through a fast scroll
      // back up, which can cross that mark while they are still on their way
      // home.
      const lit = vhNow >= LOGO_FADE_AT || tail.t > 0;
      for (const dot of refs.dots.current) {
        if (!dot) continue;
        gsap.set(dot, { visibility: lit ? "visible" : "hidden", opacity });
      }
    }

    /**
     * The tail's clock, and the latch that starts it. `t` is seconds into the
     * gesture; crossing TAIL_AT tweens it to the end, crossing back tweens it
     * home. Latched on a boolean rather than restarted per scroll event, and
     * the duration is scaled by how far there is left to go, so an interrupted
     * run reverses at the same speed it was playing rather than taking a full
     * TAIL_SECONDS to cover whatever is left.
     */
    const tail = { t: 0 };
    let tailOn = false;
    let tailTween: gsap.core.Tween | null = null;
    function runTail(go: boolean) {
      if (go === tailOn) return;
      tailOn = go;
      tailTween?.kill();
      const to = go ? TAIL_SECONDS : 0;
      const left = Math.abs(to - tail.t) / TAIL_SECONDS;
      tailTween = gsap.to(tail, {
        t: to,
        duration: (go ? TAIL_SECONDS : TAIL_BACK_SECONDS) * left,
        // The trajectory carries its own acceleration; easing the clock as
        // well would be gravity twice.
        ease: "none",
        overwrite: "auto",
        onUpdate: () => renderTail(tail.t),
      });
    }
    renderTail(0);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      pin: stage,
      pinSpacing: false,
      onUpdate: (self) => render(self.progress),
      // A resize is the one thing a measure-once-at-mount could never survive,
      // and ScrollTrigger already recalculates on exactly that signal.
      // Re-rendering immediately puts the photo layer back in register instead
      // of leaving it offset until the next scroll event arrives.
      onRefresh: (self) => {
        measure();
        render(self.progress);
        // The tail's endpoints all came from that measurement, so it has to be
        // redrawn at wherever its own clock has got to — it is not on the
        // scrub, so nothing else would ever put it back in register.
        renderTail(tail.t);
      },
    });

    // The other thing that moves the layout after mount: the webfont landing.
    // It changes the statement's height, and on a short viewport that takes the
    // whole composition with it — so `cy` was measured against a layout that no
    // longer exists. It also reflows the footer headings, which moves the dots'
    // targets.
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      measure();
      render(trigger.progress);
      renderTail(tail.t);
    });

    /**
     * And the element's own size, which fails worst of all. The others go stale
     * as a fixed offset; `baseSize` does not — work through placePhoto and the
     * layer's screen position is `(cx − cx_measured) + s·(baseSize_measured −
     * baseSize)/2`, so the error is *multiplied by the window's scale*. The
     * photo then appears to slide as the window opens, drifting further off
     * register the bigger it gets.
     *
     * Watching the element is the only way to catch it: a disc resized by
     * anything other than the window moves no event ScrollTrigger or the font
     * loader knows about. A ResizeObserver watches the layout box, so scaling
     * the circle every frame never fires it — only a real size change does.
     * The frame goes in the same observer for the vh terms in that size
     * expression, which the window's resize event can lag behind on mobile, and
     * the footer because a heading rewrapping moves every dot's destination.
     */
    const sizeObserver = new ResizeObserver(() => {
      measure();
      render(trigger.progress);
      renderTail(tail.t);
    });
    sizeObserver.observe(circle);
    sizeObserver.observe(frame);
    if (refs.footer.current) sizeObserver.observe(refs.footer.current);

    /**
     * The cross-fade out of the hero: scrubs the veil's opacity 0→1 across the
     * hero's dead tail, so the hero's last frame dissolves into this section's
     * gray while it is still pinned and filling the screen. Fully opaque before
     * the boundary crossing begins, which is what keeps the two sections from
     * ever being visible at once.
     *
     * A scrubbed opacity rather than a CSS gradient, which cannot do this job:
     * a gradient is anchored to the section's top edge, so its transparent end
     * sits at the top of the screen exactly when the boundary appears at the
     * bottom. Opacity is independent of position, so it can be fully committed
     * before the crossing.
     *
     * onLeave/onLeaveBack pin the end states, since onUpdate only fires inside
     * the range and jumping past it would leave the veil at whatever it held.
     */
    const veil = refs.veil.current;
    // Eased, and the *reverse* direction is why: scrolling back up a linear
    // ramp reads as the hero snapping in, because detail is arriving and the
    // eye locks onto it. sine is the gentlest of the inOut curves through the
    // middle (1.6× the linear rate against 2× for power1), and for a
    // full-screen dissolve a rushed middle is its own kind of pop. f(1) is
    // exactly 1, which the no-two-sections guarantee depends on.
    const veilEase = gsap.parseEase("sine.inOut");
    const veilTrigger = ScrollTrigger.create({
      trigger: section,
      start: `top ${VEIL_VH}%`,
      end: "top bottom",
      onUpdate: (self) => gsap.set(veil, { opacity: veilEase(self.progress) }),
      onLeave: () => gsap.set(veil, { opacity: 1 }),
      onLeaveBack: () => gsap.set(veil, { opacity: 0 }),
    });

    /**
     * And the statement resolving in on the frame it becomes visible, as one timed
     * move rather than a scrub (see STATEMENT_LIFT_VH).
     *
     * Its own trigger rather than a phase of `render`, because it has to run
     * *before* that one exists: `render` is driven by the pin, which does not
     * start until this section's top edge reaches the viewport top, and this has
     * to fire the moment that edge clears the *bottom*. A trigger keyed to the
     * section's top edge crossing the screen can do that; the pin cannot.
     *
     * It writes the inner element, while `render` writes the wrapper for the
     * exit — one element cannot carry both, since either write rebuilds the
     * whole transform and would drop the other.
     *
     * `onToggle` rather than onEnter/onLeaveBack so both directions go through one
     * latched call, and the ease stays in `paintStatement` with the tween linear —
     * putting it on the tween as well would apply it twice.
     */
    const paintStatement = (progress: number) => {
      const raw = gsap.utils.clamp(0, 1, progress);
      gsap.set(refs.statementReveal.current, {
        // Travel: raw, so it is linear in scroll and the net motion is monotonically
        // upward. Easing this as well made the curve leave at twice its average rate,
        // which is faster than the page itself and therefore *downward* for the first
        // third — the up-then-down that was reported. See the assertion in ./timeline.
        y: -(1 - raw) * STATEMENT_LIFT_VH * window.innerHeight,
        // Presence: the hero's wash, not the scroll. The wash is cued, so it finishes
        // wherever the reader stops, and a scroll-mapped fade could not keep up with
        // it in either direction — the gray landed 31vh before the words did going
        // down, and the words outlived the doors going up. On the same clock the two
        // are one gesture at any speed. See hero/handoff.
        opacity: STATEMENT_FADE_EASE(heroWash.active ? heroWash.p : 1),
      });
    };

    /**
     * The wash runs on its own clock, so a frame where it moved is not necessarily a
     * frame where this section's ScrollTrigger fired — a reader who stops on the cue
     * gets the whole wash with no further scroll events at all. Repainting off the
     * ticker is what lets the statement arrive with it; it is one `gsap.set`, and only
     * when the value has actually moved.
     */
    // `active` is part of the key, not just `p`. This section's sequence is built a
    // commit *before* the hero's — that one waits on `mounted` — so the first paint
    // here runs against `active: false` and falls back to 1. Keyed on `p` alone, the
    // hero then coming up with `p` still 0 was not a change, no repaint happened, and
    // the paragraph sat at full opacity over the orange until the wash first moved.
    let lastWash = -1;
    let lastActive = false;
    const syncStatement = () => {
      if (heroWash.p === lastWash && heroWash.active === lastActive) return;
      lastWash = heroWash.p;
      lastActive = heroWash.active;
      paintStatement(statementTrigger.progress);
    };
    gsap.ticker.add(syncStatement);
    const statementTrigger = ScrollTrigger.create({
      trigger: section,
      start: `top ${STATEMENT_REVEAL_AT_PCT}%`,
      end: `top ${STATEMENT_LIFT_END_PCT}%`,
      scrub: 1,
      onUpdate: (self) => paintStatement(self.progress),
      onLeave: () => paintStatement(1),
      onLeaveBack: () => paintStatement(0),
    });
    // The resting state for a restored scroll position. `scrub` does not paint until
    // the reader moves, so a page opening halfway down would leave the paragraph at
    // its inline start state — a third of a viewport low and transparent — until the
    // first scroll event arrived.
    paintStatement(statementTrigger.progress);

    return () => {
      cancelled = true;
      gsap.ticker.remove(syncStatement);
      sizeObserver.disconnect();
      // Created inside runTail, so the context never collected it.
      tailTween?.kill();
      trigger.kill();
      veilTrigger.kill();
      statementTrigger.kill();
    };
  }, section);
}
