/**
 * The case studies' type, and the cards the page falls back to.
 *
 * **The cards' content lives in the client's Wix CMS now** (`CaseStudies`, read through
 * ./content) — this is where their *shape* is defined and where the standing copy below it
 * still lives. The track is one cell per project plus the heading and the closing panel, and
 * the pin's length is that track's measured overflow (see ./sequence), so a card added in the
 * CMS retimes the section and needs no change here at all. Nothing else in ./cases knows how
 * many there are, or where they came from.
 *
 * **`CASE_PROJECTS` is the fallback, not the source.** It is the live cards, pointing at the
 * copies in `/public`, and it renders only when the CMS yields nothing usable — see ./content
 * for why this section in particular cannot simply render nothing in that case. Editing it
 * changes what a reader sees when Wix is down, which is worth keeping truthful, and nothing
 * else.
 *
 * **Which is why the Auto Maxx card came out of it.** That study is not deleted — its rows in
 * both CMS collections are set to `DRAFT` through Wix's own Publish plugin, so the client still
 * has every field and can republish it without a deploy. But a fallback that still carried the
 * card would put a study back on the home page at exactly the moment nobody could check it: a
 * Wix outage. The fallback has to say what is live, not what once was. Putting the study back
 * means republishing the two rows, and restoring this entry and its `STUDY_SLUGS` slug so the
 * offline copy and the build manifest agree with the CMS again.
 *
 * ## The schema is the reference's caption, and nothing more
 *
 * Frame analysis of the reference shows a caption of exactly three parts under each image —
 * a title, a two-line description, and a right-aligned link. There is no category line, no
 * tag row and no per-project accent colour; earlier versions of this file carried all three
 * and they were inventions. They are gone rather than hidden.
 *
 * ## Both entries are real, and the stand-ins are gone
 *
 * Café Technica and QCIF each point at a full page built from that client's own material —
 * `app/work/cafe-technica` and `app/work/qcif`. The two caviar stand-ins that used to sit
 * under them have been removed rather than left unlinked: an unclickable card next to two
 * clickable ones reads as a broken link, and naming clients this studio may not have is a
 * claim rather than a layout.
 *
 * **The count is whatever the CMS hands over, and the section retimes itself for it.** The
 * track's length, the pin's length and every cell's entrance are all derived from the array
 * the page is handed — see `./sequence` — so a study added or drafted is a CMS row and nothing
 * else. The reference recording happens to show three, which is why `TRACK_TAIL_VW` and the
 * pace knob were tuned against that count; at two the traverse is simply shorter, and the dev
 * assertions in `./timeline` are written in vw rather than in cells so they still hold. It is
 * at two now, Auto Maxx having been drafted in the CMS.
 */
export type CaseProject = {
  id: string;
  /** The display title, set immediately under the image. */
  title: string;
  /** Two lines under the title. The reference wraps at two; three would push the rule down. */
  description: string;
  imageSrc: string;
  /**
   * `null` until there is somewhere to go. The link renders as a `<span>` while it is null
   * and as an `<a>` once it is a path — an `href="#"` is worse for a keyboard or a screen
   * reader than no link at all, and a link to a route that 404s is worse still.
   *
   * **Not a CMS field.** ./content derives it as `/work/<the row's id>`, and only for a row
   * that has a study page at that slug — see the note there on the `link` column that was
   * deleted. In the fallback entries below it is written out, because they are what renders
   * when the CMS cannot be reached at all and there is then nothing to derive from.
   */
  link: string | null;
  /**
   * The frame's own ratio, when the artwork must not be cropped. Defaults to the reference's
   * measured `IMAGE_ASPECT` of 1.45, which is what a photograph takes: a crop of a street is
   * still a street, and holding one ratio across the row is the reference's own choice.
   *
   * A screen capture is the exception, twice over. Both site captures are wider than 1.45
   * (1.653 and 1.687), so covering scales them to the frame's height and takes ~12% off their
   * sides — on an interface that is the CRM's right-hand panel and the edge of the QCIF page
   * simply missing, and no amount of re-framing helps, because the subject is the whole screen.
   * And `object-contain` inside a 1.45 box is no answer either: it shows the capture whole but
   * stands it on a slab of `bg-ink/5` that reads as a grey mat around the picture. Giving the
   * frame the asset's own ratio is the one arrangement with neither a crop nor a mat — the
   * image *is* the frame. The cost is that a wider card is shorter, so its caption sits a
   * little higher than its neighbour's; the width cap in ./CaseLayers is unaffected, being
   * derived from the tallest ratio.
   *
   * From the CMS this is the `aspect` column, and **leaving it empty is the photograph case**,
   * which is the right default and the one thing worth knowing before adding a card whose
   * image is a screenshot rather than a picture.
   */
  aspect?: number;
  /**
   * Round this card's frame corners. The frame is square by default, matching the
   * reference's own square-cornered cards (see ./CaseLayers) — this is an opt-in per card,
   * not a global style.
   *
   * Café Technica needs it because its photo has no rounding of its own. QCIF needs it for a
   * subtler reason: its screenshot *did* originally show a browser window's
   * own rounded chrome, but only because the raw export had slack canvas around the mockup
   * for the curve to read against. Once that mockup is trimmed edge-to-edge to fill the card
   * with no margin (see the imageSrc notes below — the fix for the white/grey mat those
   * exports had baked in), the image *is* the frame, pixel for pixel, so there is no longer
   * any surrounding canvas left for a baked-in corner curve to be visible over — a few
   * differently-shaded corner pixels inside an otherwise edge-to-edge rectangle just reads
   * as a hard rectangle. Full-bleed and a visibly rounded corner are mutually exclusive
   * without an actual clip, so all three cards opt in here for the same final look.
   */
  rounded?: boolean;
};

/**
 * The cards as they stand today, and what ./content serves if the CMS gives it nothing. Not
 * the page's source of truth — see the file's docblock.
 */
export const CASE_PROJECTS: CaseProject[] = [
  {
    id: "cafe-technica",
    title: "Café Technica",
    description:
      "Naming, brand and a new website for the coffee-machine service Tasmania calls first.",
    imageSrc: "/img/Coffee-Shop-Vibes.avif",
    link: "/work/cafe-technica",
    rounded: true,
  },
  {
    id: "qcif",
    title: "QCIF",
    // Trimmed from the full case study's summary (content.ts), which runs to three lines at
    // this card's narrower column — see the doc on `description` above: two lines is the
    // budget, and a third pushes the caption's own block taller than its neighbours', which
    // under the cell's vertical centring reads as this card sitting out of line with them.
    description:
      "A brand, sub-brand system and website for Queensland’s digital research partner.",
    // The delivered site itself. It is the only QCIF asset that is *about the work* rather
    // than about the client's people, which is what a case-study card should show. The
    // supplied export had a ~15px transparent margin baked in on every side (so `object-cover`
    // showed the frame's bg-ink/5 through as a white-ish band) plus the mockup's own rounded
    // corners — trimmed to the mockup's edges, then those corners flattened to this section's
    // resting grey (ink/5 over --color-gray) instead of white so the last few px blend in
    // rather than reading as a stray white nick. 1293 x 770.
    imageSrc: "/img/qcif-hero-2.png",
    // A capture: the frame takes its ratio so nothing is cropped and no mat shows.
    aspect: 1293 / 770,
    link: "/work/qcif",
    rounded: true,
  },
  // A fourth study is a row in the CMS, not an entry here. Not a limit either way — the track
  // grows by one cell and the pin by 50vw, which is half a screen more scrolling at a 2:1
  // viewport, and nothing else has to change.
];

/** The heading cell — the track's first cell, not a banner above it. */
export const CASE_HEADING = ["Selected work", "& explorations"] as const;

/*
 * `CASE_CLOSING` was here — three lines of closing copy ("Discover our complete collection /
 * of digital experiences, brands, / and platforms.") in a final cell of the track, with a
 * "View all projects" link under them. Removed by request: the door at the end of the
 * section opens onto `CASE_REVEAL`, which *is* the call to action, so a panel asking for the
 * same thing one pitch earlier was asking twice. The last project card is now the last cell.
 */

/** Still exported for the disabled "view all" link in the heading cell — see ./CaseLayers. */
export const CASE_VIEW_ALL = "View all projects";
export const CASE_EXPLORE = "Explore project";

/**
 * The panel the door uncovers: the site's one point of contact.
 *
 * Transcribed from the supplied comp, whose block is 68.4% of its frame with every line in it
 * flush left — the heading, the body, the three fields and the button all start on the same
 * edge, and the block as a whole is centred. Every figure in `./RevealPanel` is a share of
 * that frame rather than a pixel count, because the comp is a screenshot at an unstated scale
 * and only the ratios in it are trustworthy.
 *
 * The words live here with the rest of the section's copy and the markup lives there, which is
 * the same split the case cells use. The door measures nothing about any of it.
 *
 * Two transcriptions worth knowing about before editing:
 *
 *   - **"You Name" is the comp's own wording**, not a slip in the transcription. It is set
 *     verbatim rather than silently corrected, because the copy is the client's.
 *   - The e-mail address is plain text in the comp. It is a `mailto:` here, styled to inherit
 *     so it is identical at rest — the only difference is that it can be clicked.
 */
export const CASE_REVEAL = {
  heading: "Ready to give your brand a new life?",
  /** Split so the address can be a link without the sentence being assembled in the markup. */
  body: {
    before: "Join the list for first access to a limited number of founding-client projects " +
      "or just send an e-mail to ",
    email: "info@ikra.agency",
    after: ".",
  },
  /**
   * The three fields, in the comp's order.
   *
   * `label` is the comp's placeholder text and is used as both: the visible placeholder and a
   * screen-reader label, because a placeholder is not a label — it is gone the moment anyone
   * types, which is exactly when the field most needs naming.
   */
  fields: [
    { name: "name", label: "Your Name", type: "text", autoComplete: "name" },
    { name: "email", label: "Your Email", type: "email", autoComplete: "email" },
    { name: "company", label: "Company Name", type: "text", autoComplete: "organization" },
  ],
  submit: "Join The Waitlist",
} as const;
