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
      className={`transition-all duration-1000 ease-out ${revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The timeline, in vh of actual scrolling through the pin — same convention as
 * HeroNarrative, and for the same reason: the pin runs `top top` → `bottom
 * bottom`, so progress 0→1 covers `height − 100vh`, not the whole height.
 */

/** The statement slides up and out of frame, fading as it goes. */
const STATEMENT_VH = 50;

// The round window opens until it covers the frame, and the photo inside
// dissolves across the second half of that — derived from the growth rather than
// stated separately, so "starts at the halfway point" cannot drift.
const GROW_AT = 20;
const GROW_VH = 100;
const FADE_AT = GROW_AT + GROW_VH / 2;
const FADE_VH = GROW_VH / 2;

// The definition's climb up the right-hand side, from below the fold to clear off
// the top. Long on purpose: a window longer than the distance means it crosses
// slower than the page scrolls and holds visible in the middle. Shortening it
// also squeezes the composition, since the wordmark's cue is measured against it.
const DICT_AT = STATEMENT_VH;
const DICT_VH = 250;

// The wordmark's slide out of the centre and over to the left. It has no cue of
// its own — the move is a response to the definition arriving alongside it, so
// the start is computed per frame from where the two actually are. MARK_LEAD_VH
// is how far ahead of coming level it begins.
const MARK_LEAD_VH = 15;
const MARK_VH = 50;

/** Hold on the finished composition once the definition has fully cleared. */
const HOLD_VH = 30;

/**
 * The wordmark dissolves in place — letterforms only. The three dots are
 * separate solid elements sitting exactly on top of the artwork's own, so what
 * the eye sees is the "ikra." melting away and leaving its dots behind, hanging
 * in mid-air. Nothing is masked or cut out; the dots simply outlast the thing
 * they came from.
 */
const LOGO_FADE_AT = DICT_AT + DICT_VH + HOLD_VH;
const LOGO_FADE_VH = 92;

/**
 * The tail — the camera onto the footer, and the dots' fall — is the one thing
 * here that is NOT scrubbed. Crossing TAIL_AT fires a timed timeline that runs
 * to completion on its own clock, exactly like HeroNarrative's ribbon and its
 * orange→gray wash, and for exactly the same reason: there is no stopping place
 * that can leave it half done.
 *
 * That is not a preference, it is what the content demands. Everything before
 * this point holds a *pose* when the scroll stops — a half-risen statement, a
 * part-open window, a half-faded wordmark all read as compositions. A thrown
 * ball does not. Frozen between two bounces it stops being a ball with weight
 * and becomes an orange circle parked in mid-air, and no amount of retiming
 * fixes that, because a scrubbed animation freezes by definition.
 *
 * The camera is inside the same timeline rather than left on the scrub, because
 * the fall must not begin until the footer has stopped moving (see below). Two
 * clocks would mean that ordering could be broken by how fast someone happened
 * to be scrolling; on one clock it holds by construction.
 *
 * Relative timings are carried over unchanged — the pan is the same fraction of
 * the gesture it used to be of the scroll, and so is every fall — so this is the
 * same animation on a different clock, not a new one.
 */
const TAIL_AT = LOGO_FADE_AT + LOGO_FADE_VH;

/**
 * Pinned scroll the gesture is given. Not a scrub: the animation is over in
 * TAIL_SECONDS whatever happens here. It is the room that keeps an ordinary
 * scroll from outrunning it — cross this faster than TAIL_VH/TAIL_SECONDS ≈
 * 64vh per second and the pin releases while the dots are still in the air,
 * which is the same trade HeroNarrative's ribbon makes with BAND_HOLD_VH. A
 * reading pace is nowhere near that. Whatever is left over after the gesture
 * lands is the beat on the finished footer before the pin lets go.
 */
const TAIL_VH = 180;

/**
 * The camera onto the footer.
 *
 * The footer is not animated. It is the second screen of a track inside the
 * pinned stage, and this is the camera moving down onto it — travelling a
 * *measured* distance, so it comes to rest with the footer's bottom edge on the
 * viewport's whatever height its own content makes it.
 *
 * It has to be finished before the earliest dot touches down: the dots fall to
 * where the columns come to rest, so a column still creeping upward underneath
 * one is a dot landing on a moving floor.
 */
const PAN_SECONDS = 0.9;

/**
 * The longest fall. Every other dot's flight is a fraction of this, in
 * proportion to how long its own trajectory takes — which is what puts all three
 * under one gravity rather than three (see planFall).
 *
 * All three let go at the same instant. They used to be staggered, and that
 * stagger was the one thing that could put the composition in a state with no
 * reading: the wordmark gone, one dot falling, the other two hanging in mid-air.
 * Nothing of the choreography is lost — they still separate on the first frame
 * and land at different times, because their lift, restitution, drift, drag and
 * kick all differ and their flights are different lengths. What is lost is the
 * state where only *some* of them are moving.
 */
const DROP_SECONDS = 2;

/** Slack between the camera stopping and the first touchdown. */
const DROP_MARGIN_SECONDS = 0.1;

/**
 * How much of a fall has gone by the time it first touches down, at its smallest
 * across every viewport — the room the camera has to fit into.
 *
 * Small because a dot spends only about a third of its flight descending and the
 * rest bouncing. The binding case is a short phone, where the stacked footer can
 * leave the middle slot almost exactly level with its own dot, so that fall is
 * over almost immediately while another dot's flight is what sets the length of
 * the whole thing.
 *
 * A floor on the measured value, used only to size TAIL_SECONDS. The real
 * release is solved per viewport in `measure`; if a layout ever comes in under
 * this, the dev assertion there fires.
 */
const DROP_LEAD_MIN = 0.11;

/**
 * The gesture's length, derived: the latest a release can be placed, plus the
 * longest fall that then has to play out from it.
 */
const TAIL_SECONDS =
  PAN_SECONDS + DROP_MARGIN_SECONDS - DROP_LEAD_MIN * DROP_SECONDS +
  DROP_SECONDS;

/**
 * Rewinding is quicker than playing, on the same reasoning as HeroNarrative's
 * wash: scrolling back up, this is racing the wordmark fading in underneath it,
 * and the dots have to be home before it arrives. Rate is held constant either
 * way — a reversal from halfway takes half as long — so the gesture always moves
 * at one speed rather than at whatever speed the interruption implies.
 */
const TAIL_BACK_SECONDS = 1.1;

const PIN_VH = TAIL_AT + TAIL_VH;
const SECTION_VH = PIN_VH + 100;

/**
 * The cross-fade out of the hero, in vh — see the veil in the markup.
 *
 * HERO_TAIL_VH is the hero's dead tail, between its last phase finishing and its
 * pin releasing. Borrowing it means the dissolve costs no extra scroll. It is the
 * one number here coupled to HeroNarrative — if that tail changes, this must
 * follow, or the fade eats into the hero's last motion. It tracks that section's
 * HOLD_VH, which is where the tail is set.
 *
 * The hero now washes itself over to this section's gray before releasing, so
 * this veil fades gray over gray and has nothing left to dissolve. It is kept
 * anyway, as the cover for the crossing itself: it costs one composited layer,
 * and it is what stops a mismatch showing if either side's timings move again.
 *
 * VEIL_VH adds the 100vh after that, where the hero's released stage scrolls up
 * and this section's top edge scrolls in — the crossing where the two sections
 * would otherwise both be visible.
 */
const HERO_TAIL_VH = 15;
const VEIL_VH = HERO_TAIL_VH + 100;

/**
 * How far the veil overhangs past this section's own top edge, in px. Without it
 * a hairline of the hero's bright orange background flickers along that edge:
 * three separately-rounded boxes meet there, and ScrollSmoother scrolls by
 * fractional pixels so the rounding lands differently frame to frame.
 */
const VEIL_OVERHANG_PX = 4;

/**
 * Where the wordmark's three dots sit inside its own box — the tittle on the
 * "i", the terminal on the "r", and the full stop. Measured off the alpha
 * channel of public/img/logo-white.png (each is a separate connected shape in
 * it), so they are exact rather than eyeballed: `cx` and `d` are fractions of
 * the wordmark's width, `cy` a fraction of its height. The mask is `contain` and
 * the box carries the asset's own aspect ratio, so the artwork fills it exactly
 * and these map straight onto the rendered element.
 *
 * Left to right, they map onto footer columns 1, 2, 3.
 */
const LOGO_DOTS = [
  { cx: 0.04708, cy: 0.11494, d: 0.09443 },
  { cx: 0.58527, cy: 0.45083, d: 0.09417 },
  { cx: 0.95082, cy: 0.88442, d: 0.09443 },
] as const;

/**
 * The footer's type, sized against the viewport rather than fixed.
 *
 * It is the one block on the page with nothing above it, so on a large screen a
 * px-sized version reads as a small notice stranded at the bottom. Scaling with
 * vw keeps it the same *share* of the screen everywhere. FOOTER_DOT_SIZE is also
 * the size each falling dot settles at.
 */
const FOOTER_DOT_SIZE = "clamp(24px, 2.4vw, 36px)";
const FOOTER_HEADING_SIZE = "clamp(19px, 1.9vw, 34px)";
const FOOTER_BODY_SIZE = "clamp(13px, 1.1vw, 19px)";

/** Soft at both ends, so the camera starts and stops like a scroll would. */
const PAN_EASE = gsap.parseEase("power1.inOut");

/** A dissolve wants no accent at either end. */
const LOGO_FADE_EASE = gsap.parseEase("sine.inOut");

/**
 * Three balls of the same material thrown slightly differently, which is the
 * whole point — identical arcs read as one animation played three times.
 *
 * The solved trajectory (planFall) supplies weight and momentum. These supply
 * the imperfection around it, and each is a separate beat of the gesture:
 *
 *   `anticipate`  a few px *back* into the wordmark before letting go — the
 *                 load-up. Without it the dot is simply already moving on the
 *                 first frame, which is the single biggest tell of a tween.
 *   `kick`        a sideways shove at the moment of release, spent within the
 *                 first fifth of the flight, so the dot pops away from the mark
 *                 rather than setting off toward its column.
 *   `restitution` speed kept at each impact, so it sets both bounce height and
 *                 how quickly the dot gives up.
 *   `drift`       a sideways bow across the whole flight, in px at 1440 wide.
 *   `drag`        the exponent on its horizontal ease-out. Different per dot so
 *                 that even the lateral travel is not a shared curve.
 */
const DOT_PHYSICS = [
  { lift: 18, restitution: 0.85, drift: 18, drag: 2.6, kick: 10, anticipate: 4 },
  { lift: 14, restitution: 0.90, drift: -13, drag: 3.1, kick: -7, anticipate: 3 },
  { lift: 20, restitution: 0.95, drift: 22, drag: 2.3, kick: 12, anticipate: 5 },
] as const;

/** How far past its slot the dot carries on the first impact, in px. */
const DOT_PENETRATE_PX = 6;

/** Fractions of a flight: the load-up, the sideways kick, one penetration. */
const ANT_SPAN = 0.09;
const KICK_SPAN = 0.2;
const PEN_SPAN = 0.035;

/**
 * A single 0 → 1 → 0 bump across [0, span], squared so it leaves and returns to
 * zero with zero *slope* as well as zero value. That matters at the moment of
 * release: a plain sine starts at full speed, so the dot snapped sideways on the
 * frame it detached instead of easing out of the wordmark.
 */
const bump = (p: number, span: number) =>
  p <= 0 || p >= span ? 0 : Math.sin(Math.PI * (p / span)) ** 2;

/**
 * Impacts before the dot is allowed to be still. Four, because at this
 * restitution the third is still worth seeing — the heights fall off as the
 * square of the ratio, so 0.55 gives roughly 30%, 9% and 3% of the drop, and
 * only the fourth is genuinely too small to notice.
 */
const DOT_BOUNCES = 2;

/** A settled tail on the end of each fall, as a fraction of its descent. */
const DOT_REST = 0.08;

type Fall = {
  /** Upward launch speed. */
  v0: number;
  /** When it first reaches the slot. */
  land: number;
  /** Launch speed of each bounce, which is also that bounce's duration. */
  hops: number[];
  /** The whole trajectory, including the settled tail. */
  total: number;
  /** Normalized time of each impact, for the penetration pulse. */
  impacts: number[];
  /**
   * This flight's length as a share of the longest of the three, which is how
   * one gravity is imposed on all of them — assigned once all three are planned.
   */
  share: number;
  /** Net descent, in px. Negative when the slot is above the release point. */
  drop: number;
};

/**
 * Solves a dot's trajectory once, so the per-frame work is a lookup.
 *
 * Everything is in a unit system where the acceleration is 2, which makes a drop
 * from rest exactly `t²` px and keeps the algebra free of constants. `t`
 * therefore carries units of √px, and that is the useful part: a fall twice as
 * far takes √2 times as long. Handing each dot a scroll window proportional to
 * its own `total` — see the caller — is what puts all three under *one* gravity
 * instead of three, so they read as the same material rather than as three
 * separately-tuned animations. Without it the shortest fall looks like a
 * feather.
 *
 * The trajectory: rise `lift` px, fall to the slot, then DOT_BOUNCES parabolic
 * hops each keeping `restitution` of the impact speed, then rest.
 */
function planFall(drop: number, lift: number, restitution: number): Fall {
  // Thrown up hard enough to still be coming *down* onto the slot even when the
  // slot is above the release point — which is the case on a phone, where the
  // stacked footer puts the first column higher than the wordmark. Below this
  // the descent has no real solution at all and the dot would have to climb.
  const rise = Math.max(lift, lift - drop);
  const v0 = 2 * Math.sqrt(rise);
  const impact = Math.sqrt(v0 * v0 + 4 * drop);
  const land = (v0 + impact) / 2;

  const hops: number[] = [];
  let u = impact * restitution;
  for (let k = 0; k < DOT_BOUNCES; k++) {
    hops.push(u);
    u *= restitution;
  }

  const total = land + hops.reduce((a, b) => a + b, 0) + DOT_REST * land;

  // Contact times, normalized. Only the first two are ever used — by the third
  // the dot has no energy left to squash with, and leaving the last one out is
  // also what guarantees the pulse cannot still be running at p = 1 and leave
  // the dot resting a pixel below its column.
  const impacts: number[] = [];
  let at = land;
  for (const u of hops) {
    impacts.push(at / total);
    at += u;
  }

  return { v0, land, hops, total, impacts, share: 1, drop };
}

/**
 * How far *past* the slot the dot is at time `p` — the give on impact. A ball
 * does not stop dead on contact; it carries a little way in, then comes back.
 * Halved at each successive impact, along with everything else.
 */
function penetrationAt(f: Fall, p: number) {
  let out = 0;
  for (let k = 0; k < Math.min(2, f.impacts.length); k++) {
    const d = Math.abs(p - f.impacts[k]) / PEN_SPAN;
    if (d < 1) {
      out += DOT_PENETRATE_PX * 0.5 ** k * (1 + Math.cos(Math.PI * d)) * 0.5;
    }
  }
  return out;
}

/** How far below its release point the dot is, at progress `p` of its fall. */
function fallAt(f: Fall, p: number) {
  const t = p * f.total;
  // The descent: thrown up at v0 against an acceleration of 2. Reaches exactly
  // `drop` at `land`, by construction.
  if (t <= f.land) return t * t - f.v0 * t;
  // Then one parabola per bounce, each leaving and returning to the slot.
  let r = t - f.land;
  for (const u of f.hops) {
    if (r < u) return f.drop - (u - r) * r;
    r -= u;
  }
  return f.drop;
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
 * The editorial statement, with the round photo and the "ikra." wordmark stacked
 * below it, the wordmark layered over the photo — and then the wordmark's own
 * dots carrying the page into the footer.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH). Once the
 * statement is gone the window and the definition run concurrently, so the phases
 * are listed by what they belong to rather than strictly by start time:
 *
 *     0–50vh  the statement slides up and out of frame, fading as it goes.
 *   20–120vh  the round window opens until it fills the screen. The photo behind
 *             it neither moves nor scales — it is a full-bleed viewport-cover
 *             layer, counter-scaled each frame against the window's own scale
 *             (see placePhoto), so the window uncovers more of a sharp photo
 *             instead of magnifying a small one. Coverage is exact rather than
 *             eyeballed: the window scales to the farthest viewport corner from
 *             its own centre.
 *   70–120vh  the photo dissolves, starting at the growth's midpoint. That is
 *             deliberately *before* coverage, so a fifth to a third of the screen
 *             is still gray and the photo reads as a circle blooming and
 *             dissolving rather than a full-bleed frame that arrives and sits.
 *   measured  the wordmark slides left into the final composition, clearing the
 *             right half for the definition. The only phase with no vh window of
 *             its own: it is cued off the definition's *position*, starting
 *             MARK_LEAD_VH before the definition's top edge reaches the
 *             wordmark's centre line. That lands around 130vh on a 16:9 desktop
 *             and closer to 85vh on a short viewport, which is why it is not a
 *             constant.
 *   50–300vh  the definition travels up the right-hand side, from below the fold
 *             to clear off the top. No fade — a pure move, and the window being
 *             far longer than the distance is what keeps it from rushing.
 *             Shorten it and the settled side-by-side composition is the first
 *             thing to go, since the wordmark's cue cannot fire until the
 *             definition has climbed most of the way up.
 *  300–330vh  hold — the wordmark alone, the last beat before the footer.
 *  330–422vh  the wordmark dissolves where it stands. Its three dots are
 *             separate solid elements standing on the artwork's own, so the
 *             letterforms thin out from under them and the dots are left
 *             hanging in mid-air.
 *      422vh  the tail is cued — and everything past this point comes off the
 *             scrub. Crossing the mark starts a timed gesture that runs to
 *             completion whether or not the scrolling continues, and rewinds if
 *             it is crossed back. See TAIL_AT for why this one stretch cannot be
 *             scroll-driven: every earlier phase holds a pose when the scroll
 *             stops, and a thrown ball does not.
 *      0–0.9s the camera pans down the track onto the footer. The footer has no
 *             entrance of its own — it is already sitting there in the layout,
 *             and this is the page arriving at it.
 *   ~0.7–2.8s the dots fall — all three released together, on a moment solved
 *             per viewport (see `measure`) so the beat before it is only as long
 *             as the camera needs. Not an interpolation with a bounce ease on
 *             it: the vertical is a solved ballistic trajectory — thrown up as
 *             it lets go, accelerating down, three decaying parabolic bounces,
 *             then still. Each dot's flight lasts its own share of DROP_SECONDS
 *             so all three obey one gravity, and they are given different lift,
 *             restitution and sideways drift so no two paths are the same. Both
 *             endpoints are fixed points on screen with the camera in neither,
 *             so the dots hang in the viewport and fall through it while the
 *             page pans behind them.
 *  422–602vh  the scroll the gesture is given (TAIL_VH). It is not driving any
 *             of it — it is the room that stops an ordinary scroll outrunning
 *             the ~2.8s it takes, and whatever is left once the dots have landed
 *             is the beat on the finished footer before the pin releases.
 *
 * Pinned with GSAP rather than CSS `sticky`, which does not work under
 * ScrollSmoother's transform-based fake scroll (see the note in HeroNarrative).
 */
export default function DefinitionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const dictionaryRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
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
    const track = trackRef.current;
    const frame = frameRef.current;
    const circle = circleRef.current;
    if (!section || !stage || !track || !frame || !circle) return;

    const ctx = gsap.context(() => {
      // Everything the per-frame handler needs from the layout, re-read whenever
      // it can have moved rather than measured once at mount. `cy` is why that
      // matters: it aligns the photo layer with the viewport, so a stale one
      // leaves the growing window uncovering the section background past the
      // layer's edge — which reads as a straight-edged crop on the photo.
      const m = {
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
        /** Seconds into the tail at which the dots let go — solved in `measure`. */
        releaseAt: PAN_SECONDS + DROP_MARGIN_SECONDS,
        slots: [] as ({ x: number; y: number; size: number } | null)[],
        dots: [] as ({
          fromX: number;
          fromY: number;
          toX: number;
          scale0: number;
          fall: Fall;
        } | null)[],
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
      const offsetIn = (el: HTMLElement, root: HTMLElement) => {
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
      };

      // An arrow function rather than a declaration purely so TypeScript keeps
      // the non-null narrowing from the guard above.
      const measure = () => {
        // Computed style rather than a rect, so the scale transform on the circle
        // doesn't affect it.
        m.baseSize = parseFloat(getComputedStyle(circle).width) || 1;
        const circleAt = offsetIn(circle, frame);
        m.cx = circleAt.x + m.baseSize / 2;
        m.cy = circleAt.y + m.baseSize / 2;
        m.frameH = frame.offsetHeight || 1;

        // Exactly to where the statement's own bottom edge meets the frame's top,
        // so it is fully gone rather than relying on the fade to hide a stub.
        const statement = statementRef.current;
        m.statementTravel = statement
          ? offsetIn(statement, frame).y + statement.offsetHeight
          : 0;

        // The wordmark's final resting place: hard left against the frame's
        // padding, and up to the vertical middle. Its centre line is kept too,
        // since the wordmark's cue is derived from where the definition is
        // relative to it, and its box because the dots are placed inside it.
        const mark = markRef.current;
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
        m.dictHeight = dictionaryRef.current?.offsetHeight ?? 0;

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
        const footer = footerRef.current;
        if (footer) {
          const footerTop = offsetIn(footer, track).y;
          const seated = m.frameH - (footerTop + footer.offsetHeight);
          m.camEnd = Math.min(0, Math.max(seated, -footerTop));
        } else {
          m.camEnd = 0;
        }

        // Where each dot is going. Sized from the slot too, so the falling dot
        // settles at exactly the footer's own dot size whatever the viewport
        // resolves that clamp() to.
        m.slots = LOGO_DOTS.map((_, i) => {
          const slot = slotRefs.current[i];
          if (!slot) return null;
          const at = offsetIn(slot, track);
          const size = slot.offsetWidth || 1;
          const dot = dotRefs.current[i];
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
      };
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
      gsap.set(photoRef.current, { transformOrigin: "0 0" });
      const placePhoto = (s: number) => {
        gsap.set(photoRef.current, {
          x: m.baseSize / 2 - m.cx / s,
          y: m.baseSize / 2 - m.cy / s,
          scale: 1 / s,
        });
      };
      placePhoto(1);

      // Parked below the fold before the first render, so it cannot flash over
      // the statement on the first paint.
      gsap.set(dictionaryRef.current, { y: m.frameH });

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
        gsap.set(statementRef.current, {
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
        gsap.set(circle, { scale, opacity: 1 - fadeP });

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
        gsap.set(dictionaryRef.current, {
          y: gsap.utils.interpolate(H, -m.dictHeight, dictP),
        });

        // --- Phase 4: the wordmark slides aside, once the definition is level
        // with it ---
        // Left, and barely up at all: the grid centres the composition on the
        // frame, so it starts within ~20px of its final height.
        //
        // Its cue is the moment the definition's top edge reaches the wordmark's
        // centre line — where the two are unmistakably side by side and the
        // definition has not yet climbed past. Both positions are measured, so
        // it lands correctly on any viewport; a fixed vh mark cannot, because
        // when they come level depends on viewport height and how tall the
        // definition renders.
        //
        // MARK_LEAD_VH pulls the start ahead of that, so the wordmark is already
        // travelling as the definition comes level. Which side it errs on
        // matters: the definition paints above the wordmark (deliberately), so
        // being late reads as body text sitting on the logo.
        //
        // Safe to drive `x`/`y` here: the wordmark is placed by grid, not by a
        // Tailwind translate that this would overwrite.
        const levelP = gsap.utils.clamp(
          0,
          1,
          (H - m.markCentreY) / (H + m.dictHeight),
        );
        const markAt = DICT_AT + levelP * DICT_VH - MARK_LEAD_VH;
        const markP = gsap.utils.clamp(0, 1, (vh - markAt) / MARK_VH);

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
        gsap.set(markRef.current, {
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
          const dot = dotRefs.current[i];
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
        for (const dot of dotRefs.current) {
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
      if (footerRef.current) sizeObserver.observe(footerRef.current);

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
      const veil = veilRef.current;
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

      return () => {
        cancelled = true;
        sizeObserver.disconnect();
        // Created inside runTail, so the context never collected it.
        tailTween?.kill();
        trigger.kill();
        veilTrigger.kill();
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
      {/* The veil: a slab of this section's own gray reaching VEIL_VH *above* its
          top edge, so it blankets the whole viewport for the entire hand-off out
          of the hero. Its opacity is scrubbed by `veilTrigger` above; flat gray,
          not a gradient, so the dissolve is uniform and in place rather than a
          wash sweeping up the screen.

          Sizing it rather than pinning it is what removes the "two sections at
          once" problem: across that whole range the viewport is covered by veil
          above and this section's identical `bg-gray` below, so there is no
          scroll position where a boundary is visible. A `fixed` overlay would
          have been the obvious way to blanket the screen, but `fixed` does not
          work inside ScrollSmoother's transformed #smooth-content.

          z-40 because HeroNarrative's layers go up to z-30 and its section never
          establishes a stacking context, so those z-indexes compete directly
          with this one. The stage then has to beat it.

          Skipped under reduced motion, where the hero collapses to 100vh and the
          veil would gray it out permanently. */}
      {!reducedMotion && (
        <div
          ref={veilRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-40 bg-gray opacity-0"
          style={{
            top: `-${VEIL_VH}vh`,
            // Overhangs rather than stopping on the edge — see VEIL_OVERHANG_PX.
            height: `calc(${VEIL_VH}vh + ${VEIL_OVERHANG_PX}px)`,
          }}
        />
      )}

      {/* The stage is the camera: exactly one viewport, pinned, clipping a track
          that is two screens tall. The flying dots are its direct children
          rather than the track's, so their coordinates are plain screen
          coordinates and the camera's own movement only enters where it is
          wanted — through the endpoints, which are recomputed per frame. */}
      <div
        ref={stageRef}
        className={`relative z-50 w-full ${reducedMotion ? "" : "h-screen overflow-hidden"}`}
      >
        <div ref={trackRef} className="relative w-full">
          {/* Screen one. One composition, not two layers: the statement and the
              composition used to be siblings in normal flow, so once the stage
              was pinned its centred wordmark simply landed on top of the text.
              Both now live in the same grid, so they cannot overlap.

              Three rows — 1fr, auto, 1fr — with the statement first and the
              composition second. The two 1fr rows take equal shares of what the
              middle leaves, which puts the circle on the frame's own centre line
              instead of in the middle of the space *below* the statement.

              A grid rather than absolute positioning because it degrades in the
              right direction: a 1fr row cannot shrink below its content, so on a
              viewport too short for both, the third row gives up its share and
              the composition slides *down*, never up into the copy.

              `overflow-hidden` is load-bearing now that the footer is the next
              screen down: the definition is parked a full frame-height below the
              top, which is exactly where the footer begins. */}
          <div
            ref={frameRef}
            className="relative grid h-screen w-full grid-rows-[1fr_auto_1fr] items-start overflow-hidden px-8 pt-16 pb-10 md:px-16 md:pt-20"
          >
            {/* GSAP drives `y` on this wrapper while RevealBlock's own entrance
                transform stays on the element inside it, so the two compose
                instead of one clobbering the other.

                `items-start` keeps this hugging its text rather than stretching
                to fill its row, which matters beyond looks: `statementTravel` is
                measured from this element's bottom edge, and a stretched box
                would send the statement flying further than it needs to. */}
            <div ref={statementRef} className="row-start-1">
              <RevealBlock>
                <p className="max-w-4xl text-[26px] leading-[1.3] font-normal text-ink md:text-[35px]">
                  We are rebranding agency for the most discerning ambitions.
                  Our work transforms a simple idea into an experience of true
                  rarity and prestige.
                </p>
              </RevealBlock>
            </div>

            {/* The middle row: sized to its own content, so the 1fr rows either
                side can balance it on the frame's centre line. */}
            <div className="relative row-start-2 grid place-items-center">
              {/* Grid stacking: both children sit in the same cell, so the
                  wordmark layers over the photo with no absolute positioning and
                  no translate-centring for GSAP to overwrite later.

                  Both are sized against vw *and* vh, capped in px, with a px
                  floor. The vw term makes them big on a wide screen; the vh term
                  stops them growing into the statement on a short one, which is
                  what keeps the no-overlap guarantee honest; the floor stops the
                  vw term collapsing them below 100px on a phone.

                  The wordmark stays a consistent 1.5× the circle at every
                  breakpoint, because the overhang either side of the disc is the
                  composition rather than a coincidence. The resting size is
                  genuinely free to change: `baseSize` is read from the computed
                  style and `maxScale` is solved from it, so a smaller disc simply
                  scales further to reach the same full-bleed frame at the same
                  sharpness. */}
              {/* `relative` is load-bearing: `<Image fill>` is absolute, so
                  without it the photo would resolve against the grid group above
                  and — since overflow only clips absolute descendants whose
                  containing block is inside the clipper — escape the round mask
                  entirely. */}
              <div
                ref={circleRef}
                aria-hidden
                className="relative col-start-1 row-start-1 overflow-hidden rounded-full"
                style={{
                  width: "max(160px, min(19vw, 35vh, 340px))",
                  height: "max(160px, min(19vw, 35vh, 340px))",
                }}
              >
                {/* Deliberately NOT sized to the circle: it is a full-bleed
                    viewport-cover layer, and the circle is only a window onto it.
                    `w-screen h-screen` rather than measured pixels so a resize is
                    the browser's job — and `sizes` can honestly say 100vw, which
                    is the other half of the sharpness fix.

                    Reduced motion never runs placePhoto, so there it falls back
                    to simply filling the circle. */}
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
                    priority
                  />
                </div>
              </div>

              {/* Wider than the circle on purpose — 1.5× it in every term — so
                  the wordmark overhangs it on both sides. Wrapped so the width
                  can be a multi-term min(); Logo takes its height from its own
                  ~2.44:1 aspect ratio, which is why the circle sets the
                  composition's height. */}
              {/* `relative` here for paint order, and it is load-bearing:
                  positioned siblings paint above non-positioned ones regardless
                  of DOM order, so once the circle became `relative` it started
                  covering this. Making both positioned restores plain tree order.
                  Deliberately no z-index — the definition must stay above this,
                  and on a phone the two do overlap. */}
              <div
                ref={markRef}
                className="relative col-start-1 row-start-1"
                style={{ width: "max(240px, min(29vw, 53vh, 520px))" }}
              >
                <Logo className="w-full" color="var(--color-accent)" />
              </div>
            </div>

            {/* Inside the pinned frame so its upward travel can be driven against
                scroll rather than happening at page speed.

                Anchored at `top-0` with no vertical centring: GSAP drives `y`
                here, which rewrites the whole transform, so a Tailwind
                `-translate-y-1/2` would be wiped the instant the first frame
                ran. */}
            {!reducedMotion && (
              <div
                ref={dictionaryRef}
                className="pointer-events-none absolute inset-x-8 top-0 md:inset-x-auto md:right-16 md:w-[42%] md:max-w-140"
              >
                {DICTIONARY_CONTENT}
              </div>
            )}
          </div>

          {/* Reduced motion only: nothing pins or fades, so the definition
              follows the composition in normal flow, above the footer. There must
              only ever be one of these, since both carry `dictionaryRef`. */}
          {reducedMotion && (
            <div className="px-8 pb-24 md:px-16">
              <RevealBlock className="max-w-md">
                {DICTIONARY_CONTENT}
              </RevealBlock>
            </div>
          )}

          {/* Screen two: the footer. Entirely static — no entrance of its own,
              by design. It is already sitting here in the layout; the camera
              pans onto it and the dots arrive, and that is the whole reveal.

              Deliberately *not* h-screen. Its own content height is what the
              camera's travel is measured from, so on a desktop it settles into
              the lower part of the frame and on a phone — where the columns
              stack and it is nearly a screen tall by itself — it fills almost
              all of it. One rule, two layouts, nothing to keep in sync.

              How high the columns can sit is not a free choice. The dots have
              to *fall* onto them, and they leave from a wordmark on the frame's
              centre line, so a slot much above that turns the fall into a lob.
              Because the footer is bottom-anchored, the slots' height is set
              entirely by what is below them — the copy, the bar, and the bottom
              padding — and not at all by the padding above. That is why the
              bar earns its place: it fills the bottom of the screen, which is
              the only direction this composition can grow without flattening
              the fall. */}
          <div
            ref={footerRef}
            className={`w-full px-8 md:px-16 ${reducedMotion ? "py-24" : "py-8 md:pt-[24vh] md:pb-8"}`}
          >
            <div className="mx-auto w-full max-w-7xl">
              <div className="grid gap-7 md:grid-cols-3 md:gap-10 lg:gap-14">
                {FOOTER_COLUMNS.map((col, i) => (
                  <div key={col.heading}>
                    {/* The landing pad, not the dot. It reserves the space and
                        is what `measure` reads the destination and the final
                        size from; the dot that ends up sitting in it fell here.
                        Under reduced motion nothing falls, so it is the dot. */}
                    <span
                      aria-hidden
                      ref={(el) => {
                        slotRefs.current[i] = el;
                      }}
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
              <div className="mt-12 hidden border-t border-ink/15 pt-5 text-sm font-light text-ink/55 md:flex md:items-center md:justify-between">
                <p>© {new Date().getFullYear()} ikra studio. All rights reserved.</p>
                <p>Rebranding agency for the most discerning ambitions.</p>
              </div>
            </div>
          </div>
        </div>

        {/* The falling dots. Children of the stage rather than the track so the
            camera does not move them, and outside the frame so its clip cannot
            cut them off. Sized by `measure`, and hidden until the wordmark
            begins to dissolve — see the phase for why that is not optional. */}
        {!reducedMotion &&
          LOGO_DOTS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              className="pointer-events-none invisible absolute top-0 left-0 rounded-full bg-accent"
            />
          ))}
      </div>
    </section>
  );
}
