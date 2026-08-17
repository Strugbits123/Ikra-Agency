import HeroNarrative from "@/components/HeroNarrative";
import DefinitionSection from "@/components/DefinitionSection";
import CaseStudies from "@/components/CaseStudies";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <HeroNarrative />
      {/* DefinitionSection ends with the dots footer; the case studies follow it. */}
      <DefinitionSection />
      <CaseStudies />
      <Footer />
    </main>
  );
}
