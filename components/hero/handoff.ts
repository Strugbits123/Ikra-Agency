/**
 * The one value the hero and DefinitionSection have to agree on at runtime.
 *
 * Everything else between the two sections is a constant that one imports from the
 * other (see HERO_GRAY_TAIL_VH), because constants are enough when both ends are
 * *positions*. The wash to gray is not a position. It is a cue: crossing
 * DOOR_CLOSE_AT starts a clock, and if the reader stops the doors still shut and the
 * stage still goes gray, wherever they happen to be. So "how gray is the hero" cannot
 * be worked out from the scroll offset by anyone — including the hero.
 *
 * That mattered because the next section's statement was keyed to a scroll position
 * while the thing it has to arrive with was keyed to a clock. Stop just past the cue
 * and the gray landed at once while the text waited another 31vh for its mark: a
 * blank gray screen with the wordmark on it, which is precisely what it was reported
 * as. And in reverse the same gap ran the other way, leaving the text on screen while
 * the doors were already parting under it.
 *
 * Publishing the wash makes them one gesture. The statement's *travel* stays on the
 * scroll, where it belongs — it has to keep station with a section edge that is
 * moving — but its *presence* is this, so the words are there whenever the gray is
 * and gone whenever it is not, at any scroll speed and in both directions.
 *
 * A plain mutable object rather than an event or a store: it is read once per frame
 * inside an existing paint, and both writers and readers are effects that already own
 * their own teardown.
 */
export const heroWash = {
  /** 0 while the stage still shows orange, 1 once it is fully the next section's gray. */
  p: 0,
  /**
   * False until the hero's sequence has mounted and started writing `p`.
   *
   * Read as "is there a hero in front of me at all". Without it, DefinitionSection
   * rendered on its own — or under reduced motion, where the hero registers no
   * ScrollTrigger — would gate its statement on a value nobody ever sets and never
   * show it. Consumers fall back to 1, i.e. "assume nothing is covering me".
   */
  active: false,
};
