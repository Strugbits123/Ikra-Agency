/**
 * The shape of a case study. Not its content — that is the client's, and it lives in Wix.
 *
 * Every word and every picture on `/work/<slug>` comes out of the `CaseStudyPages` collection
 * and the `CaseStudyDeliverables` collection beside it; `./cms.ts` is the one place that knows
 * those exist, and it hands whatever it finds to `<CaseStudyPage>` as the record below.
 * Everything in `components/study/` renders this type and has never heard of Wix.
 *
 * ## There is one page and the bands are a fixed sequence
 *
 * An earlier version of this file carried a `bands` array per study, because the three studies
 * genuinely were different pages: QCIF ran six bands in a different order, with a brand band
 * the other two didn't have. That has been deliberately unwound — the three are one template
 * now, in one order, and what varies between them is which parts have anything in them.
 *
 * So the order lives in `./CaseStudyPage` as a plain list and every optional band renders
 * exactly when the CMS row has content for it. That is why almost everything below is
 * optional: a row with a heading and no picture is a client midway through writing, and the
 * page shows what they have written rather than a blank frame or an error. The two things
 * that are *not* optional are the masthead and the testimonial, which are the two bands every
 * study has and the two that would leave the page looking broken if they vanished.
 *
 * ## The content is not duplicated here, on purpose
 *
 * The home page's cards keep an in-repo copy of themselves (`components/cases/projects.ts`)
 * because an empty case-studies section would take the site's only contact panel off the home
 * page. A case study has no such hostage: if the CMS is unreachable the route 404s, recovers
 * on its own within one revalidate window, and — because the pages are prerendered — an outage
 * after a build is invisible, since Next goes on serving the last good copy. Against that, a
 * second copy of eight thousand words of the client's prose would be a copy nobody updates,
 * and the first anyone would hear of the drift is a reader seeing last month's page. What is
 * kept here instead is `STUDY_SLUGS`, so the routes exist in the build manifest whatever the
 * CMS says that day.
 */

import type { CardTint } from "./metrics";
import type { Field, Tone } from "./primitives";

/**
 * The studies that are live today, and the floor under `generateStaticParams`.
 *
 * **Not a whitelist.** `app/work/[slug]` leaves `dynamicParams` at its default, so a row added
 * in the CMS is a working page the moment somebody asks for it — no deploy, and nothing to add
 * here. This list only guarantees that these are prerendered at build time even if the CMS
 * happens to be unreachable during it, which is what keeps the home page's links from pointing
 * at routes the manifest has never heard of.
 *
 * **`auto-maxx` was here and is not any more, and it was not deleted.** That study's rows in
 * both `CaseStudies` and `CaseStudyPages` are set to `DRAFT` through Wix's own Publish plugin,
 * so the client keeps all forty-one fields of it and can put it back from the CMS without
 * anybody touching this repo. Listing a slug here whose row is drafted would only prerender a
 * 404, and — because `dynamicParams` is true — taking it off this list costs nothing on the way
 * back: republishing the rows makes `/work/auto-maxx` render again on the first request, and
 * this entry is worth restoring then only to put it back in the build manifest.
 */
export const STUDY_SLUGS = ["cafe-technica", "qcif"] as const;

/**
 * One piece of supplied media, which may be a picture or a clip.
 *
 * The two are one type because every slot that takes one takes either, and the band around it
 * cares about neither: it draws a box of `aspect` and fills it. `sources` is what decides —
 * present means a `<video>` over those URLs with `src` as its poster frame, absent means an
 * `<Image>` at `src`.
 *
 * **`sources` is a list rather than a URL because Wix's transcodes are not guaranteed.** Wix
 * only renders a clip as far up as its source resolution, so `720p` exists for some uploads
 * and answers `403` for others — see `wixVideoSources`, which is where the list is built and
 * why it has two entries. A browser walks a `<source>` list until one loads, so the band needs
 * to know nothing about which sizes this particular clip has.
 *
 * `src` is optional on both paths: a video may have no poster frame, and a row may name no
 * picture at all, in which case the slot draws nothing rather than an empty frame.
 */
export type StudyMedia = {
  /** The picture, or a video's poster frame. */
  src?: string;
  alt: string;
  /** The box's width ÷ height. Always resolved — see `frameRatio` in ./metrics. */
  aspect: number;
  /** `object-position`, for a picture the frame has to crop. */
  focus?: string;
  /** Playable URLs, best first. Present only for a clip. */
  sources?: readonly string[];
};

/**
 * One band of copy beside one piece of media — the shape the applications and identity bands
 * share.
 *
 * `heading` is a list of lines rather than a string because the CMS field is one, and because
 * two of the three studies hand-break their heading where their own measure would not.
 */
export type MediaSplit = {
  heading: readonly string[];
  paragraphs: readonly string[];
  media: StudyMedia;
};

export type CaseStudy = {
  /** The route segment, and the row's id in the CMS. */
  slug: string;
  /** Sentence-case, for `<title>`. The masthead sets the client line in caps of its own. */
  title: string;
  /** One sentence, for the route's meta description. Never rendered. */
  summary: string;

  masthead: {
    /**
     * The field the band sits on: one of the five named tones, or a ground and its derived
     * ink when the client typed a colour of their own. `dark` unless their brand brings one.
     */
    tone?: Tone | Field;
    /** Set as written — the reference shows a month and a year, in caps. */
    date: string;
    /** The client block: name, sector, place. Three lines in the reference. */
    client: readonly string[];
    /** The line beside the media, set large in the serif. One entry per line. */
    headline: readonly string[];
    /**
     * What the headline is set in, and it is derived rather than edited — see `fieldFor` in
     * ./field. The accent is the Cafe Technica reference's; on QCIF's navy it would be the
     * only orange within three bands of itself, so that field takes the band's own ink
     * instead. Empty means exactly that: inherit the field's ink.
     */
    headlineClassName?: string;
    /**
     * What the `ikra.` lockup is drawn in, derived the same way and held to a lower contrast
     * floor — it is a graphic rather than type. `currentColor` where the accent would be an
     * orange mark on an orange field.
     */
    markColor?: string;
    media?: StudyMedia;
    /** The two narrative columns beside the client block. */
    columns: readonly (readonly string[])[];
  };

  /** The serif pull quote and the two columns of narrative under it. */
  quote?: {
    text: string;
    columns: readonly (readonly string[])[];
    /** The field. `paper` unless the study puts this band somewhere else. */
    tone?: Tone;
    /**
     * Whether to hang the quotation marks. Default true.
     *
     * QCIF uses the same composition — a display line over two unequal columns — for a lead
     * statement that quotes nobody. Marks on it would attribute the studio's own summary of
     * the client's services to the client.
     */
    marks?: boolean;
  };

  /** The client's words, over a photograph the band tints with its own field colour. */
  testimonial: {
    photo: { src: string; alt: string; focus?: string };
    /**
     * Which way the photograph tints the field. See ./Testimonial, which carries the
     * contrast arithmetic — the short version is that `screen` only ever lightens, and
     * white type on a lightened ember field is not legible where the photograph is bright.
     * Every study takes `multiply` now; the other path is kept for the reasoning in it.
     */
    blend?: "screen" | "multiply";
    /**
     * How the photograph is mapped before it multiplies over the field. Defaults to
     * `CARD_TINT`.
     *
     * Per photograph rather than per study — the transfer maps a *nominal* range and two
     * photographs use very different parts of it (see `CARD_TINT_CRUSHED`). It reaches the
     * record from a CMS field marked advanced and hidden from the client, because "how dark
     * are this picture's shadows" is not a question to put beside somebody's copy.
     */
    tint?: CardTint;
    /** The card's shape — the photograph's own, bounded by `CARD_FRAME`. */
    aspect?: number;
    /**
     * A ceiling on the card's height, in vh. Absent means none. See `CARD_MAX_VH` for why
     * this is opt-in rather than global, and it is the second hidden CMS field for the same
     * reason as `tint`.
     */
    maxVh?: number;
    paragraphs: readonly string[];
    name: string;
    role: string;
  };

  /** What was shipped, beside a picture of it. */
  outcome?: {
    heading: string;
    paragraphs: readonly string[];
    media?: StudyMedia;
    /** A line under the media. Only read when there is media to put it under. */
    caption?: readonly string[];
  };

  /**
   * The same deliverables as the table below, read as a skyline: one labelled column each,
   * growing out of the floor as the band arrives.
   *
   * `value` is a share of the track in percent, and it is decorative — the reference gives no
   * axis, no legend and no unit, so these are a designed profile rather than a measurement of
   * anything. The shape is stated here rather than imported from `components/growth` so this
   * file stays free of component dependencies, the same way `MediaSplit` above is declared
   * locally.
   */
  glance?: {
    title: string;
    items: readonly { label: string; value: number }[];
  };

  /** Where the identity ended up in the world, beside a photograph of it. Copy on the left. */
  applications?: MediaSplit;

  /** The visual system, beside a grid of it in use. Copy on the right. */
  identity?: MediaSplit;

  /**
   * The deliverables table: a column of terms against a column of what each one meant.
   *
   * A row carries either prose or a grid of cards, never both — the reference gives the
   * website row a grid because it is six deliverables under one term, and the other three a
   * paragraph each. In the CMS that is one collection row per paragraph or card, grouped by
   * the term; see `deliverablesFrom` in ./cms.
   */
  deliverables?: {
    title: string;
    rows: readonly {
      label: string;
      paragraphs?: readonly string[];
      cards?: readonly { title: string; paragraphs: readonly string[] }[];
    }[];
  };

  /** Who did what. Two columns, set at the page's small size. */
  credits?: {
    title: string;
    rows: readonly {
      role: string;
      /** The attribution, as type. Omitted on a row whose partner is a mark, or on none. */
      name?: string;
      /**
       * A partner's logo in place of that line. `aspect` is the asset's own `width / height`,
       * which is what gives the box its height — see `CREDITS_LOGO_WIDTH`.
       */
      logo?: { src: string; alt: string; aspect: number };
    }[];
  };
};
