import {
  ABOUT_INTRO_COLLECTION,
  wixLines,
  wixParagraphs,
  wixQuery,
} from "@/lib/wix";

/**
 * The section's words.
 *
 * Kept apart from the layer that sets them for the reason `study/content.ts` is: the copy is
 * the one thing here anyone will want to edit without reading a line of geometry. Both blocks
 * of it are the client's now — see `aboutIntroFromWix` below.
 */

export type AboutIntro = {
  /** The paragraphs that climb the screen. */
  copy: readonly string[];
  /** The footnote under the rule, one entry per line. */
  note: readonly string[];
};

/**
 * The copy the CMS row started as, and the fallback it falls back to.
 *
 * **It is still here on purpose, and this is the `caseStudiesFromWix` answer rather than the
 * `foundersFromWix` one.** The two bands further down this page return an empty array when Wix
 * is unreachable and simply do not render, because the page still scrolls without them. This
 * block cannot do that: it is the whole content of a pinned section whose height is derived and
 * whose one sequence climbs it up the screen, so an empty array leaves a black viewport with a
 * rule and nothing above it — worse than the stale wording it would be replacing.
 */
export const PLAYGROUND_COPY = [
  "After the journey against the current, a new genesis begins. That's how we work. " +
  "We go back to the source of a business to find what makes it strong, and shape " +
  "what comes next from there.",
  "ikra.agency* began with the belief that strategy, creative direction and development " +
  "belong in the same conversation. It was built to keep all three perspectives " +
  "together: three co-founders, one to lead each direction.",
] as const;

/**
 * The footnote under the rule, and the same fallback arrangement as the copy above.
 *
 * The asterisk is what the first paragraph's `ikra.agency*` points at, so the two travel
 * together — which is the one thing the CMS cannot enforce, and is why both fields say so in
 * their own descriptions. It is also the only copy on this site made of characters that are
 * hard to retype: `ɪˈkrɑ` is IPA and `икра` is Cyrillic, and a client who types over them by
 * hand will not get them back. The field's description says to paste rather than retype.
 */
export const PLAYGROUND_NOTE = [
  "*/ɪˈkrɑ/ noun, uncount.",
  "from Russian икра (caviar)",
] as const;

/**
 * Both blocks out of the client's Wix CMS, so they can be reworded without a deploy — the
 * arrangement the founders and approach bands below already use, and this module is the
 * boundary in the same way: a CMS row is not typed and may not be there, so `wixParagraphs`
 * and `wixLines` do the coercion and nothing downstream knows Wix exists.
 *
 * **`AboutIntro` holds one row and this reads the first one with copy in it.** A single row
 * rather than one per paragraph because a run of prose is one thing to edit, and the two
 * conventions this site already uses everywhere else separate the parts — a blank line between
 * paragraphs in `body`, a single newline between the footnote's lines in `note`. Both fields
 * say which in their own names, which is what the client reads in the CMS. Taking the first row
 * with text rather than an id means a row deleted and retyped still works.
 *
 * **The two fields fall back independently**, because they fail independently: a client can
 * empty the footnote while leaving the copy alone, and a row that has lost only its note should
 * not also revert its prose to whatever shipped.
 *
 * The section is handed the result as props: everything from `PlaygroundNarrative` down is a
 * client component, and a client component can neither hold the site's credential nor block on
 * a request.
 */
export async function aboutIntroFromWix(): Promise<AboutIntro> {
  const rows = (await wixQuery(ABOUT_INTRO_COLLECTION)) ?? [];
  const row = rows.find((r) => wixParagraphs(r.body).length > 0);

  const copy = row ? wixParagraphs(row.body) : [];
  const note = row ? wixLines(row.note) : [];

  return {
    copy: copy.length > 0 ? copy : PLAYGROUND_COPY,
    note: note.length > 0 ? note : PLAYGROUND_NOTE,
  };
}

/** The lockup under the wordmark, set on a line height of exactly 1 — see MARK_META. */
export const PLAYGROUND_DESCRIPTOR = ["rebranding", "agency"] as const;
