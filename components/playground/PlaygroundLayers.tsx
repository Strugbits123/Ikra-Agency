"use client";

import Link from "next/link";
import type { CSSProperties, RefObject } from "react";
import Logo from "../Logo";
import { PLAYGROUND_DESCRIPTOR } from "./content";
import {
  BODY,
  BODY_LEADING,
  COPY_LEFT_PCT,
  COPY_NARROW_MEASURE,
  COPY_RIGHT_PCT,
  HEADER_GUTTER,
  HEADER_TOP,
  MARK_META,
  MARK_WIDTH,
  NOTE,
  NOTE_LEADING,
  PARA_GAP_EM,
  RULE_BOTTOM_EM,
  RULE_TOP_EM,
  RULE_WIDTH,
} from "./metrics";

/**
 * The layers of the playground section: the field, the header lockup, the travelling copy
 * and — where the river is the narrow one — the band the copy moves into instead. Markup and
 * classes only — every figure comes from ./metrics, every beat from ./timeline, and nothing
 * here animates itself.
 */

/**
 * The field: the footage, with a still under it for every frame the video has not got to yet.
 *
 * Loaded with the page rather than deferred, unlike the hero's background — there the doors
 * hide it for the first viewport of scrolling so it can afford to arrive late; here it is the
 * section's whole ground from the first frame, and a late arrival is a visible swap.
 *
 * Under reduced motion only the still renders: autoplaying footage on arrival is unrequested
 * motion, and the still is a frame of the same material.
 */
export function PlaygroundBackdrop({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element -- a full-bleed decorative
          still behind a video; next/image's srcset and layout machinery buy nothing here
          and its wrapper would need unwinding to sit under the <video>. */}
      <img
        src="/img/section2-poster.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!reducedMotion && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/video/section2.mp4"
          poster="/img/section2-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
    </div>
  );
}

/**
 * The header lockup: the wordmark in the accent, the descriptor in white on a line height of
 * exactly 1 under it.
 *
 * `Logo` recolours `logo-white.png` through a CSS mask, so the accent here is the token
 * rather than a second asset — and that asset already draws its own trademark, which is why
 * MARK_WIDTH is the total width including it and no `™` is set beside it in markup. The
 * width goes on a wrapper because it is a `clamp()` and `Logo` takes a className, not a style.
 *
 * It leaves with the copy rather than sitting still — the sequence drives `y` here over
 * HEADER_EXIT, off the same clock the climb runs on. Nothing else about it moves, so it needs
 * no wrapper of its own the way the copy does.
 */
export function PlaygroundHeader({
  headerRef,
}: {
  headerRef: RefObject<HTMLElement | null>;
}) {
  return (
    <header
      ref={headerRef}
      className="absolute top-0 left-0 z-30"
      style={{ paddingLeft: HEADER_GUTTER, paddingTop: HEADER_TOP }}
    >
      {/* The wordmark goes home, which is where a reader looks for that — the same link and
          the same hover the case studies' masthead carries. `next/link` rather than a bare
          anchor so the route swaps without tearing the page down, and `flex` so the mark
          inside is blockified and adds no baseline descender under itself, which would push
          the descriptor below it down. */}
      <Link
        href="/"
        aria-label="ikra, rebranding agency — back to home"
        className="flex transition-opacity duration-300 hover:opacity-80"
        style={{ width: MARK_WIDTH }}
      >
        <Logo className="w-full" color="var(--color-accent)" />
      </Link>
      <p
        className="font-normal text-white"
        style={{ fontSize: MARK_META, lineHeight: 1 }}
      >
        {PLAYGROUND_DESCRIPTOR.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </header>
  );
}

/**
 * The paragraphs, the rule and the footnote — the same markup wherever the copy is set, so
 * the two placements below cannot drift apart in content. Only the rule's colour differs,
 * because it is the one thing that has to answer to the ground it sits on.
 */
function CopyBody({
  copy,
  note,
  ruleClassName,
}: {
  copy: readonly string[];
  note: readonly string[];
  ruleClassName: string;
}) {
  return (
    <>
      {copy.map((para, i) => (
        <p
          key={para.slice(0, 24)}
          style={i === 0 ? undefined : { marginTop: `${PARA_GAP_EM}em` }}
        >
          {para}
        </p>
      ))}

      <hr
        className={`border-0 border-t ${ruleClassName}`}
        style={{
          width: RULE_WIDTH,
          marginTop: `${RULE_TOP_EM}em`,
          marginBottom: `${RULE_BOTTOM_EM}em`,
        }}
      />

      <div style={{ fontSize: NOTE, lineHeight: NOTE_LEADING }}>
        {note.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </>
  );
}

/**
 * The travelling copy — the one thing on this screen that moves. **Wide layout only**: where
 * the river is the narrow one the copy is not on the stage at all, see PlaygroundCopyBand.
 *
 * Anchored at `top-0` with no vertical centring of its own, exactly like
 * `definition/Dictionary`'s panel and for the same reason: the sequence drives `y` here, and
 * a `gsap.set` rebuilds the whole transform, so a Tailwind `-translate-y-1/2` or a flex
 * `items-center` would be wiped the instant the first frame ran. Where "centred" actually is
 * is measured (see ./sequence's `restY`), which also makes it a number the travel can be
 * derived from rather than a second constant.
 *
 * It takes the right-hand half at its measured edges, clear of the water except at its own
 * top-left corner, which is the reference's own composition.
 *
 * `centred` is the reduced-motion path, and it is a class rather than a measurement because
 * in that mode nothing ever writes a transform here — so the CSS centring that GSAP would
 * otherwise wipe is safe, and is the one construction that needs no measurement at all.
 *
 * It also starts hidden in every other mode, exactly like the hero's headline and clip box
 * and for the same reason: the effect that places it cannot run until after the first paint —
 * one commit to flip `mounted`, another for the effect itself — so a block left visible here
 * is painted at the *top* of the stage, where it never belongs, for about a second. The
 * sequence's first frame is what lights it, on the same call that puts it below the fold.
 */
export function PlaygroundCopy({
  copyRef,
  copy,
  note,
  centred,
}: {
  copyRef: RefObject<HTMLDivElement | null>;
  /** The paragraphs, out of the CMS by way of the page — see `aboutIntroFromWix`. */
  copy: readonly string[];
  /** The footnote's lines, from the same row. The rule between them is the layout's. */
  note: readonly string[];
  centred: boolean;
}) {
  return (
    <div
      ref={copyRef}
      className={`pointer-events-none absolute z-20 text-white ${centred ? "top-1/2 -translate-y-1/2" : "top-0 opacity-0"
        }`}
      style={
        {
          left: `${COPY_LEFT_PCT.toFixed(3)}%`,
          right: `${COPY_RIGHT_PCT.toFixed(3)}%`,
          fontSize: BODY,
          lineHeight: BODY_LEADING,
        } as CSSProperties
      }
    >
      <CopyBody copy={copy} note={note} ruleClassName="border-white/60" />
    </div>
  );
}

/**
 * Where the copy goes on the narrow layout: its own band under the stage, white with the
 * copy in black, one viewport tall — the client's brief for phones, stated as "the first
 * viewport is the video with the red strip, the second is this". Not scroll-driven, not
 * pinned, in plain flow after the stage; the band is the second screen the reader scrolls
 * onto, and the ribbon's marquee keeps running on the first.
 *
 * `min-h-screen` rather than `h-screen`, so a long paragraph from the CMS grows the band
 * instead of being clipped. The copy is centred in it vertically and set at the body size the
 * wide column uses, capped at COPY_NARROW_MEASURE so a tablet does not set 90 characters to
 * the line; the gutters are the stage's own 24px. Plain white and plain black, as asked — not
 * the site's cream and ink, which are a different, warmer pairing and would read as the next
 * section rather than as this one's second screen.
 *
 * Keyed to the river's own shape (`narrow`) rather than to a breakpoint, for the reason
 * `riverIsWide` gives: a `md:` class and the river's aspect test disagree for every tablet
 * held upright.
 */
export function PlaygroundCopyBand({
  copy,
  note,
}: {
  copy: readonly string[];
  note: readonly string[];
}) {
  return (
    <div className="flex min-h-screen w-full items-center bg-white px-6 py-16 text-black">
      <div
        style={
          {
            maxWidth: COPY_NARROW_MEASURE,
            fontSize: BODY,
            lineHeight: BODY_LEADING,
          } as CSSProperties
        }
      >
        <CopyBody copy={copy} note={note} ruleClassName="border-black/40" />
      </div>
    </div>
  );
}
