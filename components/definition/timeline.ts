import { gsap } from "@/lib/gsap";
import { CLOSE_VH, HERO_GRAY_TAIL_VH } from "../hero/timeline";

/**
 * The definition section's timeline, in vh of actual scrolling through the pin —
 * same convention as the hero's, and for the same reason: the pin runs `top top` →
 * `bottom bottom`, so progress 0→1 covers `height − 100vh`, not the whole height.
 *
 * Written as a chain of derivations rather than a list of numbers, so retiming any
 * beat carries the rest along instead of quietly opening a gap or an overlap.
 *
 * Everything here is scrubbed except the tail, which is a *cue*: crossing TAIL_AT
 * starts a move that plays to completion on its own clock. See TAIL_AT for why that
 * one stretch cannot be scroll-driven.
 *
 * Phases, in vh of actual scrolling through the pin (see PIN_VH). Once the
 * statement is gone the window and the definition run concurrently, so the phases
 * are listed by what they belong to rather than strictly by start time:
 *
 *   (before)  the statement is already resolving as this section arrives. Its
 *             reveal is cued off the hero's wash to gray — the same instant, ~10vh
 *             before that section's pin releases — so the gray arriving and the
 *             text arriving are one movement, and the first line is legible on the
 *             frame it clears the bottom edge rather than after a wait on an empty
 *             screen. See STATEMENT_LIFT_VH. It finishes 55vh before the
 *             pin, which is the settled beat this next phase then interrupts.
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
 *             its own, and it must stay that way: it is driven off the definition's
 *             *position*, spread over the last MARK_APPROACH_FRAC of that block's
 *             run at it and finishing as it arrives. Lands around 62–66vh, later
 *             on a tall viewport, which is why it is not a constant. See
 *             MARK_APPROACH_FRAC for the two vh-window versions that failed.
 *   50–220vh  the definition travels up the right-hand side, from below the fold
 *             to clear off the top. No fade — a pure move, and the window still
 *             being longer than the distance is what keeps it from rushing —
 *             but only by 20% now rather than 70% (DICT_VH). Shortening it costs
 *             the settled side-by-side composition first, since the wordmark's
 *             cue cannot fire until the definition has climbed most of the way
 *             up; 28–51vh of that beat is left, by viewport.
 *  173–195vh  the wordmark alone — what is left of the hold that used to sit
 *             here, now a consequence of the two windows rather than a phase.
 *  195–245vh  the wordmark dissolves where it stands, starting at 85% of the
 *             climb above so the two overlap (LOGO_FADE_FRAC) rather than queue —
 *             the letterforms are going while the last of the definition is still
 *             leaving. Its three dots are separate solid elements standing on the
 *             artwork's own, so the letterforms thin out from under them and the
 *             dots are left hanging in mid-air.
 *      245vh  the tail is cued — the dots let go here, and this is as early as
 *             that can be: it is the end of the dissolve, because the dots have
 *             to outlast the wordmark rather than leave while it is still there.
 *             Everything past this point comes off the
 *             scrub. Crossing the mark starts a timed gesture that runs to
 *             completion whether or not the scrolling continues, and rewinds if
 *             it is crossed back. See TAIL_AT for why this one stretch cannot be
 *             scroll-driven: every earlier phase holds a pose when the scroll
 *             stops, and a thrown ball does not.
 *      0–0.9s the camera pans down the track onto the footer. Nothing there
 *             moves under its own power: it is already sitting in the layout,
 *             and this is the page arriving at it.
 *   ~0.5–2.8s its contents resolve from transparent — all of it as one, over
 *             exactly the span the dots are in the air, so the falls and the
 *             footer are one gesture with one ending. No stagger, deliberately:
 *             staggering guarantees frames where part of the footer has resolved
 *             and part has not. Most of it plays after the camera has stopped,
 *             which is the point — a fade that fits inside the pan is spent
 *             while the footer is still rising.
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
 *  245–269vh  the last of the scroll, and all the gesture gets (TAIL_VH). It drives
 *             none of it. Deliberately shorter than the ~2.8s it takes, because
 *             this is the end of the page: the reader reaches the bottom and the
 *             dots land there, rather than landing early and leaving a screen of
 *             finished footer to scroll through. See TAIL_VH for why losing the pin
 *             mid-flight costs nothing while this section is last.
 */

/** The statement slides up and out of frame, fading as it goes. */
export const STATEMENT_VH = 50;

/**
 * The statement's *entrance* — the rise and fade it arrives on.
 *
 * The move itself is unchanged: 32px of rise and an opacity, out of a CSS
 * `ease-out`, which is exactly what RevealBlock does everywhere else on the page.
 * What changed is the clock under it.
 *
 * It used to be RevealBlock: an IntersectionObserver waiting for 35% of the
 * paragraph to be on screen, then a fixed 1s CSS transition. Both halves of that
 * are wrong for a block that arrives on a hand-off. The threshold cannot be met
 * until the statement is already climbing the screen, so it is preceded by a
 * stretch of blank gray with nothing in it; and the transition then runs on
 * wall-clock time, so the paragraph resolves whether or not the reader is still
 * scrolling and cannot be scrubbed back. It reads as an event that happened near
 * the text rather than as the text arriving.
 *
 * It was scrubbed for a while, across the hand-off from the hero's wash to this
 * section's top edge reaching 55%. That fixed the threshold half of the problem but
 * kept the other one in a new form: the paragraph resolved at the reader's scroll
 * rate, so stopping anywhere in the window left it posed at 40% — visible, half
 * faded, plainly waiting for more input. On a gray screen with nothing else on it,
 * that is the one place a half-finished pose has nowhere to hide.
 *
 * So it is a *travel* now rather than a reveal, and scrubbed rather than cued. It was a
 * cue for a while, matching the hero's own hand-off moves, and that was wrong for one
 * reason: a cue resolves the paragraph wherever it happens to be, and where it happens
 * to be is ~20vh below its section's top edge — which itself only clears the bottom of
 * the screen as the hero unpins. So it faded in perfectly, below the fold, and the
 * reader had to scroll again to reach it. It has to stay level with an edge that is
 * moving, which is a job for scroll position and not for a clock.
 *
 * That mark sits *behind* the viewport's bottom edge, halfway through the hero's gray
 * tail, and being behind it is the whole point. It used to be 98 — the section's top
 * edge just clearing the bottom, the first frame the paragraph could be seen in —
 * which put it strictly *after* the veil had finished dissolving the hero's wordmark
 * out. Three things that belong to one hand-off then needed three separate scrolls:
 * gray arrives, scroll, logo fades, scroll, text begins.
 *
 * It is the tail's *full* length now — the earliest this can be placed at all, since
 * before it the hero is still pinned and this section is not merely below the fold but
 * behind a fixed, opaque stage. So the veil's fade and this reveal start on the same
 * frame, and the paragraph is most of the way up by the time its first line clears the
 * bottom edge: whatever of the section can be seen has text in it.
 *
 * Which is the honest limit of what timing can do here. The stretch of bare gray that
 * is left is not this cue waiting — it is the section physically rising into view, and
 * no cue can put a paragraph on screen while a fixed full-viewport stage is over it.
 * Removing it means overlapping this section up into the hero's tail and sliding the
 * pinned stage with it, which re-bases every offset measured in this file.
 *
 * The move itself is unchanged from the RevealBlock it began as: 32px of rise and an
 * opacity out of an `ease-out`. Only its clock has changed, twice.
 */
// Negative: the paragraph starts *above* its resting place, not below it, and that sign
// is the fix rather than the size. It sits ~20vh below its section's top edge, and that
// edge only clears the bottom of the screen as the hero unpins — so starting it low put
// it further off screen still, and every version of "rise into place" made the reader
// scroll further to find it. Starting it high puts it on screen the moment the edge
// arrives; the page then carries it up faster than this settles it down, so the net
// travel is still upward, just gentle. That is what "already coming from the bottom"
// has to mean when the thing it is arriving over is a pinned, full-viewport stage.
//
// A fraction of the viewport, not a fixed 32px, and the difference is the whole point.
// The paragraph sits ~20vh below its section's top edge, and that edge only clears the
// bottom of the screen when the hero unpins — so a 32px rise resolved it *in place*,
// still below the fold, and the reader had to scroll again to reach it. Lifting it by a
// real slice of the viewport brings it up into view as the edge arrives instead: it
// travels up while the page does, and lands as the gray settles.
//
// Sized against the hero rather than picked, and this is the constraint that was
// missing. The paragraph has to be on screen at the *earliest* offset the wash can
// finish at, which is the hero's DOOR_CLOSE_AT — the wash is cued there, so a reader
// who stops on that mark is looking at a completed gray screen. At that offset this
// section's top edge is CLOSE_VH + HERO_GRAY_TAIL_VH below the fold, and the
// paragraph sits STATEMENT_PAD_VH under that edge, so the lift has to clear the sum
// of the three or there is nothing to fade in. See the assertion below.
export const STATEMENT_LIFT_VH = 0.62;

/**
 * How far the paragraph sits below its section's top edge, in vh, at the smallest
 * viewport worth budgeting for. The frame's `md:pt-12` is 48px, which is 5.3vh on a
 * 900px screen and 8vh on a 600px one; the larger figure is the one the lift has to
 * clear.
 */
const STATEMENT_PAD_VH = 8;
/**
 * Where the paragraph's *travel* starts, as the section's top edge against the
 * viewport. Its fade is not on this at all — see STATEMENT_LIFT_VH.
 *
 * Placed at the hero's DOOR_CLOSE_AT, which is the earliest scroll offset at which
 * the reader can be looking at a finished wash: crossing that mark starts a clock,
 * and if they stop there the doors shut and the stage goes gray without another pixel
 * of scrolling. The paragraph therefore has to be *on screen already* by then, or
 * there is a stretch of gray with nothing on it however the fade is timed.
 *
 * `100 + CLOSE_VH + HERO_GRAY_TAIL_VH` is that mark expressed from this section's own
 * top edge: the hero's pin releases at 100%, its close ends CLOSE_VH before that plus
 * the tail, so this is DOOR_CLOSE_AT exactly. Written as a sum of the hero's own
 * constants so retuning either carries this along.
 */
export const STATEMENT_REVEAL_AT_PCT = 100 + CLOSE_VH + HERO_GRAY_TAIL_VH;
// Scrubbed across the section's arrival rather than cued, because what it is doing now
// is travel rather than a reveal — it has to stay level with the edge coming up, and a
// timed move cannot. Position-mapped, so a fast scroll gets the same journey, faster.
export const STATEMENT_LIFT_END_PCT = 60;

/** The scroll the lift is spread over, in vh. */
export const STATEMENT_LIFT_VH_SPAN =
  STATEMENT_REVEAL_AT_PCT - STATEMENT_LIFT_END_PCT;

/**
 * The lift must not exceed the span it is spread over, or the paragraph moves *down*
 * the screen while the reader scrolls down.
 *
 * Its position is `sectionTop + pad + y`, and sectionTop falls 1vh per vh of scroll
 * while `y` climbs LIFT/SPAN per vh, so the net rate is `LIFT/SPAN − 1`. Above 1 the
 * sign flips. That was visible with the ease applied to the travel as well as the
 * fade: `power1.out` leaves the curve at twice the average rate, making the first
 * third of the reveal run at 2·40/60 − 1 = +0.33 — the paragraph sinking as the page
 * came up, then turning round and rising. Hence raw progress for `y` and the ease for
 * opacity only (see paintStatement), and hence this floor under the ratio.
 */
if (process.env.NODE_ENV !== "production") {
  const lift = STATEMENT_LIFT_VH * 100;
  const rate = lift / STATEMENT_LIFT_VH_SPAN;
  if (rate > 1) {
    console.error(
      `[DefinitionSection] the statement will move downward as the reader scrolls ` +
      `down: a ${lift}vh lift over a ${STATEMENT_LIFT_VH_SPAN}vh span is ` +
      `${rate.toFixed(2)}× the page's own rate. Lengthen the span or shorten the lift.`,
    );
  }
  // The other side of it: too *short* a lift and the paragraph is still below the fold
  // at the offset the hero's wash can already have finished, which is the blank gray
  // screen this whole arrangement exists to remove.
  const needed = CLOSE_VH + HERO_GRAY_TAIL_VH + STATEMENT_PAD_VH;
  if (lift <= needed) {
    console.error(
      `[DefinitionSection] the statement is still below the fold when the hero's ` +
      `wash can already be complete: a ${lift}vh lift against ${needed.toFixed(1)}vh ` +
      "of section edge + padding. Raise STATEMENT_LIFT_VH, or shorten CLOSE_VH / " +
      "HERO_GRAY_TAIL_VH.",
    );
  }
}

// The round window opens until it covers the frame, and the photo inside
// dissolves across the second half of that — derived from the growth rather than
// stated separately, so "starts at the halfway point" cannot drift.
export const GROW_AT = 20;
export const GROW_VH = 50;
export const FADE_AT = GROW_AT + GROW_VH / 2;
export const FADE_VH = GROW_VH / 2;

/**
 * The definition's climb up the right-hand side, from below the fold to clear off
 * the top.
 *
 * Longer than the distance it covers, which is the property that matters rather
 * than the number: the block travels H + its own height, so a *longer* window
 * means it crosses slower than the page scrolls and holds visible in the middle
 * instead of being carried off with the layout. That travel is about 147vh on a
 * 16:9 desktop and about 171vh on a short viewport or a phone, where the block is
 * taller relative to the screen.
 *
 * It came down from 250 because the climb was costing two and a half viewports of
 * scrolling to move one block out of the way. At 170 the rate is 0.86× page speed
 * on a 16:9 desktop, 0.82× on a tall one — and about 1.0× on the short cases,
 * which is the one thing worth knowing before changing it again: there the window
 * has met the travel, so the block now keeps pace with the layout instead of
 * lagging it, and the "holds visible in the middle" property is spent. It reads
 * fine — a block moving with the page still crosses the screen over a viewport of
 * scrolling — but going below about 150 would put it genuinely *faster* than the
 * page there, which stops reading as a climb and starts reading as being flung
 * off. That is the floor.
 *
 * Most of what the old length used to buy is recovered elsewhere rather than
 * given up: the 30vh hold that followed it is gone, and the wordmark's dissolve
 * now overlaps its last 15% (LOGO_FADE_FRAC), so the stretch from the statement
 * leaving to the dots letting go is 145vh rather than 280.
 *
 * Shortening it squeezes the composition as well, since the wordmark's slide is
 * measured against this window — see MARK_APPROACH_FRAC. The settled side-by-side beat
 * runs 25–47vh at this length depending on the viewport, against 60–75 before,
 * and that is the real cost — it is why this is not shorter still. The narrow end
 * of that range is a tall desktop, where the definition is short relative to the
 * screen and so crosses the wordmark soonest.
 */
export const DICT_AT = STATEMENT_VH;
export const DICT_VH = 90;

/**
 * The wordmark's slide out of the centre and over to the left. It has no cue of its
 * own — the move is a response to the definition arriving alongside it, so its timing
 * is computed per frame from where the two actually are (see the phase in ./sequence).
 *
 * **It has no window in vh, and it must not be given one.** The move is a response to
 * the definition coming up at it, so it is driven off the *gap between the two* rather
 * than off the clock — see the phase in ./sequence. That is the whole of what these two
 * constants say, and both are shaped so no arithmetic can put the slide before the
 * thing it is responding to.
 *
 * Two vh-window versions came before it and each failed at one end. The first started
 * the slide MARK_LEAD_VH (15vh) before the two came level and ran it for MARK_VH
 * (50vh), so it *finished* 35vh after the definition had arrived — the wordmark was
 * still 70% out in the middle of the frame with the body text painted over it, which
 * at 1024×1366 was 114px of shared band. Anchoring the same window to the far end
 * instead fixed the landing and broke the opening: the slide then began at ~48vh
 * against a definition that does not start climbing until 50, so the wordmark drifted
 * off centre with nothing on screen to explain it.
 *
 * Both are the same fault. A window in vh cannot know where the definition is, and
 * "when the wordmark should move" is a question about exactly that. The definition's
 * own progress can be read directly, so it is.
 *
 * MARK_APPROACH_FRAC is the share of the definition's run at the wordmark — from
 * clearing the bottom of the screen to touching it — that the slide is spread over. At
 * 0.5 the wordmark holds still for the first half of the climb and then moves aside
 * over the second, finishing exactly as the definition arrives. Raise it and the
 * wordmark reacts from further away; lower it and it leaves the move later and
 * quicker. It cannot be raised into trouble: at 1 the slide starts on the frame the
 * definition does, never before.
 *
 * MARK_CLEAR_PX is the gap the definition's top edge keeps from the wordmark's bottom
 * edge on the frame the slide completes. In px rather than vh because it is a gap
 * between two boxes, not a beat.
 */
export const MARK_APPROACH_FRAC = 0.5;
export const MARK_CLEAR_PX = 24;

/**
 * The wordmark dissolves in place — letterforms only. The three dots are
 * separate solid elements sitting exactly on top of the artwork's own, so what
 * the eye sees is the "ikra." melting away and leaving its dots behind, hanging
 * in mid-air. Nothing is masked or cut out; the dots simply outlast the thing
 * they came from.
 *
 * This is where the dots begin — the dissolve is what puts them there — so where
 * it is cued is where the whole footer gesture is cued. It is now a fraction of
 * the definition's climb rather than a mark after it, which used to be
 * `DICT_AT + DICT_VH + 30`: the definition had to be entirely gone, and then a
 * further 30vh of hold had to pass, before anything else would move. Reading it
 * off the climb instead ties the two together — the letterforms start going as
 * the definition is on its way out, and the beat between them is a chosen
 * overlap rather than a leftover gap.
 *
 * Below 1, so the dissolve starts while the definition is still on its way out
 * rather than after it: at 0.85 the block still has its last 15% of climb to make,
 * which puts it above the frame's top edge with only a band of its own tail still
 * showing. It was 0.95, and the letterforms now start going about 17vh earlier.
 *
 * There is a hard floor under this, and it is a paint-order one rather than a
 * matter of taste. The dots are children of the stage, so they paint above the
 * frame's entire contents including the definition, and `lit` turns them on at
 * exactly this mark — set it while the definition is still crossing the wordmark
 * and they would show through the text. That crossing finishes between 71% and
 * 77% of the climb depending on the viewport (latest on a short one, where the
 * block is tallest relative to the screen), so **0.78 is the floor** and 0.85
 * leaves about 13vh of margin at the worst viewport.
 *
 * There is a second, softer margin behind it: paintDots does not ramp a dot's
 * opacity up from this mark but from 20% into the dissolve, so for the first
 * fifth of it the dots are switched on and still fully transparent. Going under
 * the floor would therefore not show anything immediately — which is exactly why
 * the floor is written down here rather than left to be discovered.
 *
 * LOGO_FADE_VH is the dissolve's own length, and it is what gates the dots
 * *leaving*: TAIL_AT sits at the end of it, so the fall cannot be cued any earlier
 * than the letterforms are gone. That ordering is not negotiable — the whole read
 * is that the dots outlast the thing they came from, and a dot that detaches from
 * a wordmark still visible underneath it is just a dot sliding off a logo.
 *
 * So bringing the fall earlier means making the dissolve quicker, not overlapping
 * it, and 92 came down to 50 for that reason. It was close to a full viewport of
 * scrolling to fade one element out — three or four seconds at a reading pace,
 * most of it spent below 10% opacity where there is nothing left to watch. At 50
 * it is under two seconds and the fall is cued 42vh sooner. The two ratios
 * paintDots reads off this (the 20% lead and the 80% span of the dots' own
 * crossfade) are fractions, so they follow it down and the crossfade stays in
 * proportion.
 */
export const LOGO_FADE_FRAC = 0.85;
export const LOGO_FADE_AT = DICT_AT + DICT_VH * LOGO_FADE_FRAC;
export const LOGO_FADE_VH = 30;

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
export const TAIL_AT = LOGO_FADE_AT + LOGO_FADE_VH;

/**
 * Pinned scroll the gesture is given. Not a scrub: the animation is over in
 * TAIL_SECONDS (~2.8s) whatever happens here. It is only the room that keeps an
 * ordinary scroll from outrunning it — cross this faster than
 * TAIL_VH/TAIL_SECONDS and the pin releases while the dots are still in the air.
 *
 * 24, down from 180 by way of 80 — and small enough that it is no longer really a
 * guard. That is deliberate, because as a guard it could never have worked: the
 * gesture is on a clock and this is scroll, so a reader who crosses TAIL_AT and stops
 * gets the animation for free and still has every remaining vh of this to grind
 * through on a finished footer. At 180 that was up to ~170vh of nothing, at the very
 * end of the page. The buffer only ever helped the reader who kept moving, and
 * punished the one who stopped to watch.
 *
 * Being outrun is close to harmless *here specifically*, which is what makes the guard
 * dispensable. The pin ends at `bottom bottom`, and since this section is last in the
 * document that instant is also the end of the scroll: the unpinned stage sits exactly
 * where the pinned one did, so there is no jump and nothing beneath is uncovered, and
 * the tail plays out in full view on its own clock — `tailTween` paints through
 * `renderTail`, not through the ScrollTrigger, so losing the pin does not stop it.
 * The reader simply arrives at the bottom of the page and watches the dots land.
 *
 * `scrub: 1` helps rather than hurts at this length: it lags the cue by up to a
 * second, so the gesture tends to fire right as the scroll runs out, which is where it
 * wants to be seen.
 *
 * All of that is load-bearing and conditional — it holds while nothing follows this
 * section. `Footer` is currently commented out in app/page.tsx; if it comes back, the
 * stage will scroll away and uncover it mid-flight, and this has to go back up toward
 * a rate no gesture can beat (~180).
 */
export const TAIL_VH = 24;

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
export const PAN_SECONDS = 0.9;

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
export const DROP_SECONDS = 2;

/** Slack between the camera stopping and the first touchdown. */
export const DROP_MARGIN_SECONDS = 0.1;

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
export const DROP_LEAD_MIN = 0.11;

/**
 * The gesture's length, derived: the latest a release can be placed, plus the
 * longest fall that then has to play out from it.
 */
export const TAIL_SECONDS =
  PAN_SECONDS + DROP_MARGIN_SECONDS - DROP_LEAD_MIN * DROP_SECONDS +
  DROP_SECONDS;

/**
 * Rewinding is quicker than playing, on the same reasoning as HeroNarrative's
 * wash: scrolling back up, this is racing the wordmark fading in underneath it,
 * and the dots have to be home before it arrives. Rate is held constant either
 * way — a reversal from halfway takes half as long — so the gesture always moves
 * at one speed rather than at whatever speed the interruption implies.
 */
export const TAIL_BACK_SECONDS = 1.1;

export const PIN_VH = TAIL_AT + TAIL_VH;
export const SECTION_VH = PIN_VH + 100;

/**
 * The cross-fade out of the hero, in vh — see the veil in the markup.
 *
 * HERO_GRAY_TAIL_VH is the pinned scroll the hero has left once it begins washing
 * over to gray. The dissolve runs across exactly that, so it costs no extra
 * scroll and needs no constant of its own — and it is imported rather than
 * copied, which it used to be (as the hero's HOLD_VH), because a copy is only
 * right until one of the two moves.
 *
 * Spanning the wash rather than only the dead tail after it is deliberate, and it
 * is what makes the hero's tail safe to be as short as it now is. The wash is a
 * timed tween, so a reader crossing those few vh quickly un-pins that section
 * while it is still part orange; this fade covers the rest of the distance to the
 * same --color-gray. Two ramps to one colour compose into one monotonic ramp —
 * there is no frame where the stage moves back toward orange — so what the eye
 * gets is the gray arriving, possibly a little faster at the end, and never a
 * hand-over. Without it, that last stretch would be a snap.
 *
 * VEIL_VH adds the 100vh after that, where the hero's released stage scrolls up
 * and this section's top edge scrolls in — the crossing where the two sections
 * would otherwise both be visible.
 */
export const VEIL_VH = HERO_GRAY_TAIL_VH + 100;

/**
 * How far the veil overhangs past this section's own top edge, in px. Without it
 * a hairline of the hero's bright orange background flickers along that edge:
 * three separately-rounded boxes meet there, and ScrollSmoother scrolls by
 * fractional pixels so the rounding lands differently frame to frame.
 */
export const VEIL_OVERHANG_PX = 4;

/**
 * CSS `ease-out`, which is what RevealBlock used and therefore what this has to
 * keep: cubic-bezier(0, 0, 0.58, 1) sits within a couple of percent of power1.out
 * across the whole curve, and on a fade that difference is not visible.
 */
export const STATEMENT_REVEAL_EASE = gsap.parseEase("power1.out");

/**
 * The statement's fade, read off the hero's wash rather than off scroll.
 *
 * Ease-*in*, which is the opposite of what a reveal normally wants, and deliberate:
 * the wash is already `sine.inOut`, so it comes up quickly through its middle. A
 * reveal curve on top of that would put the words at half strength while the stage
 * behind them was still half orange. Easing in holds the paragraph back until the
 * gray is most of the way home, so the text arrives *onto* gray rather than over the
 * turn-over, and the two still finish together.
 */
export const STATEMENT_FADE_EASE = gsap.parseEase("power2.in");

/** Soft at both ends, so the camera starts and stops like a scroll would. */
export const PAN_EASE = gsap.parseEase("power1.inOut");

/** A dissolve wants no accent at either end. */
export const LOGO_FADE_EASE = gsap.parseEase("sine.inOut");

/**
 * The footer's contents resolving in — on the tail's clock, across exactly the
 * span the dots spend in the air.
 *
 * Tied to the falls rather than given a window of its own, so the two are one
 * gesture and cannot drift: the dots let go and the footer begins to resolve;
 * the last dot settles and the footer is finished. One ending, one reading. That
 * also means there is nothing to keep in sync — it reads m.releaseAt and
 * DROP_SECONDS, the same two numbers the falls do.
 *
 * All of it together, with no stagger, and the stagger was the defect. Spreading
 * four items across a window guarantees a stretch where some are resolved and
 * others are not, which is precisely the half-finished state this exists to
 * avoid — the same defect the dots had before their release was made
 * simultaneous, and removed for the same reason. Nothing is lost: a stagger
 * across four blocks of text at this size reads as unevenness rather than as
 * choreography, and the whole footer resolving as one is a larger, plainer event
 * than four pieces arriving in turn.
 *
 * It runs to completion, being on that clock, so no stopping place leaves the
 * footer part-resolved for longer than the gesture has left to play.
 *
 * The dots land on the slots, which sit *above* each heading and are invisible —
 * they only reserve the pad. So nothing a dot touches is being faded.
 *
 * Opacity only, deliberately — no rise, no scale. The dots aim at slots measured
 * out of this layout, and a transform here would move them on screen without
 * moving what was measured, so every landing would be off by however far the
 * reveal still had to travel. It is also why nothing here disturbs `measure`:
 * opacity is the one visual change that costs no geometry.
 */
/** No accent at either end, same as the wordmark's dissolve. */
export const FOOTER_REVEAL_EASE = gsap.parseEase("sine.inOut");
