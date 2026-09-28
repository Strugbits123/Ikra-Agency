import type { Metadata } from "next";
import PlaygroundNarrative from "@/components/PlaygroundNarrative";
import { aboutIntroFromWix } from "@/components/playground/content";
import AboutSection from "@/components/AboutSection";
import { foundersFromWix } from "@/components/about/content";
import ApproachSection from "@/components/ApproachSection";
import { approachFromWix } from "@/components/approach/content";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "ikra — about",
  description: "Work upstream.",
};

/**
 * The CMS copy is fetched on the server and the page is cached rather than rendered per
 * request — stating it here is what keeps the *page* from going dynamic just because something
 * inside it talked to a third party.
 *
 * A literal, and it has to be: Next reads route segment config statically, so
 * `WIX_REVALIDATE_SECONDS` — which is the same minute, and is what `wixQuery` asks for on its
 * own fetch — cannot be imported into this position. Change both or neither, and `lib/wix` is
 * where the minute's reasoning lives.
 *
 * **This is the ceiling, not the period**: the shortest revalidate among a segment's fetches
 * governs, so the figure the build reports is whichever of this, the query's and the token
 * exchange's is lowest.
 */
export const revalidate = 60;

export default async function AboutPage() {
  // In parallel: three independent collections behind one token, so serialising them would
  // spend two more Wix round trips for nothing on a cold render.
  const [intro, founders, approach] = await Promise.all([
    aboutIntroFromWix(),
    foundersFromWix(),
    approachFromWix(),
  ]);

  return (
    <main>
      <PlaygroundNarrative copy={intro.copy} note={intro.note} />
      <AboutSection founders={founders} />
      <ApproachSection points={approach} />
      <Footer />
    </main>
  );
}
