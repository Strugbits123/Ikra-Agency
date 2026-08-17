/**
 * The case studies, as typed data — the one file to edit for content.
 *
 * Deliberately the whole of the section's copy and imagery: the track is one cell per
 * project plus the heading and the closing panel, and the pin's length is that track's
 * measured overflow (see ./sequence), so adding or removing an entry retimes the section and
 * needs no other change. Nothing else in ./cases knows how many there are.
 *
 * ## The schema is the reference's caption, and nothing more
 *
 * Frame analysis of the reference shows a caption of exactly three parts under each image —
 * a title, a two-line description, and a right-aligned link. There is no category line, no
 * tag row and no per-project accent colour; earlier versions of this file carried all three
 * and they were inventions. They are gone rather than hidden.
 *
 * ## The imagery and copy are placeholder, and knowingly so
 *
 * `public/` holds no case-study photography — every image in it is caviar or coastal stock,
 * and most is already in use: `hero-bg.jpg` is the hero's backdrop, `section2-vertical.mp4`
 * its clip window, the three `caviar *.jpg` files the footer's merging row, and
 * `caviar-falling-video.mp4` the definition's window. These four are the most visually
 * distinct of what is left.
 *
 * The copy is placeholder for a stronger reason than the images: naming clients this studio
 * may not have would be a claim rather than a layout. The *shape* is the reference's, so
 * replacing the words cannot disturb the composition.
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
   */
  link: string | null;
  /** `object-position` — these are crops of frames that were not shot for this. */
  focus: string;
};

export const CASE_PROJECTS: CaseProject[] = [
  {
    id: "maison-noir",
    title: "Maison Noir",
    description:
      "Heritage house repositioned for a generation that had stopped noticing it.",
    imageSrc: "/img/delicious-black-caviar-as-background-closeup.jpg",
    link: null,
    focus: "50% 50%",
  },
  {
    id: "sturia-reserve",
    title: "Sturia Reserve",
    description:
      "Packaging and provenance for a single-estate reserve selling into eleven markets.",
    imageSrc:
      "/img/luxurious-mound-glistening-black-caviar-rests-atop-textured-stone.jpg",
    link: null,
    focus: "50% 55%",
  },
  {
    id: "service-atelier",
    title: "Service Atelier",
    description:
      "A tasting ritual turned into a training system, and then into a booking product.",
    imageSrc: "/img/silver-spoon-with-black-caviar-free-space-text.jpg",
    link: null,
    focus: "50% 45%",
  },
  // A fourth entry, held back to match the reference's own count of three.
  //
  // Not a limit — uncomment it and the section retimes itself: the track grows by one cell
  // and the pin by 50vw, which is 3.5 → 4.5 screens of scrolling at a 2:1 viewport. Three is
  // what the recording shows, and at 1px of scroll per 1px of track (the reference's own
  // relation, see ./sequence) that count is also what keeps the section's length close to it.
  // {
  //   id: "northern-waters",
  //   title: "Northern Waters",
  //   description:
  //     "Commercial strategy for a wholesaler stepping out from behind its own customers.",
  //   imageSrc: "/img/scenic-view-rocks-sea.jpg",
  //   link: null,
  //   focus: "50% 50%",
  // },
];

/** The heading cell — the track's first cell, not a banner above it. */
export const CASE_HEADING = ["Selected work", "& explorations"] as const;

/** The closing cell — the track's last. Three lines in the reference; the breaks are its. */
export const CASE_CLOSING = [
  "Discover our complete collection",
  "of digital experiences, brands,",
  "and platforms.",
] as const;

export const CASE_VIEW_ALL = "View all projects";
export const CASE_EXPLORE = "Explore project";
