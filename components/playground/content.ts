import { ABOUT_INTRO_COLLECTION, wixParagraphs, wixQuery } from "@/lib/wix";

/**
 * The section's words.
 *
 * Kept apart from the layer that sets them for the reason `study/content.ts` is: the copy is
 * the one thing here anyone will want to edit without reading a line of geometry. Only the
 * first block is the client's to edit — see `playgroundCopyFromWix` below.
 */

/**
 * The copy the CMS row started as, and the fallback it falls back to.
 *
 * **It is still here on purpose, and this is the `caseStudiesFromWix` answer rather than the
 * `foundersFromWix` one.** The two bands further down this page return an empty array when Wix
 * is unreachable and simply do not render, because the page still scrolls without them. This
 * block cannot do that: it is the whole content of a pinned section whose height is derived and
 * whose one sequence climbs it up the screen, so an empty array leaves a black viewport with a
 * rule and a footnote floating in it — worse than the stale wording it would be replacing.
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
 * The same paragraphs out of the client's Wix CMS, so they can be reworded without a deploy —
 * the arrangement the founders and approach bands below already use, and this module is the
 * boundary in the same way: a CMS row is not typed and may not be there, so `wixParagraphs`
 * does the coercion and nothing downstream knows Wix exists.
 *
 * **`AboutIntro` holds one row and this reads the first one with anything in it.** A single row
 * rather than one per paragraph because a run of prose is one thing to edit, and the blank-line
 * convention this site already uses everywhere else is what separates the paragraphs — the field
 * says so in its own name, which is what the client reads in the CMS. Taking the first row with
 * text rather than an id means a row deleted and retyped still works.
 *
 * The section is handed the result as a prop: everything from `PlaygroundNarrative` down is a
 * client component, and a client component can neither hold the site's credential nor block on
 * a request.
 */
export async function playgroundCopyFromWix(): Promise<readonly string[]> {
  const rows = await wixQuery(ABOUT_INTRO_COLLECTION);
  const paragraphs = rows
    ?.map((row) => wixParagraphs(row.body))
    .find((p) => p.length > 0);
  return paragraphs ?? PLAYGROUND_COPY;
}

/**
 * The footnote under the rule. The asterisk is what the first paragraph's `ikra.agency*`
 * points at, so the two travel together.
 */
export const PLAYGROUND_NOTE = [
  "*/ɪˈkrɑ/ noun, uncount.",
  "from Russian икра (caviar)",
] as const;

/** The lockup under the wordmark, set on a line height of exactly 1 — see MARK_META. */
export const PLAYGROUND_DESCRIPTOR = ["rebranding", "agency"] as const;
