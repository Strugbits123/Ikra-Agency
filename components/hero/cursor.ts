import { gsap } from "@/lib/gsap";

/**
 * Custom circle cursor, active only while pointing at this section. Returns the
 * caller's cleanup, which removes the three listeners.
 */
export function attachHeroCursor(section: HTMLElement, cursor: HTMLDivElement) {
  gsap.set(cursor, { xPercent: -50, yPercent: -50 });
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3" });

  function handleMove(e: MouseEvent) {
    xTo(e.clientX);
    yTo(e.clientY);
  }
  function handleEnter(e: MouseEvent) {
    xTo(e.clientX);
    yTo(e.clientY);
    gsap.to(cursor, { opacity: 1, duration: 0.2 });
  }
  function handleLeave() {
    gsap.to(cursor, { opacity: 0, duration: 0.2 });
  }

  section.addEventListener("mousemove", handleMove);
  section.addEventListener("mouseenter", handleEnter);
  section.addEventListener("mouseleave", handleLeave);
  return () => {
    section.removeEventListener("mousemove", handleMove);
    section.removeEventListener("mouseenter", handleEnter);
    section.removeEventListener("mouseleave", handleLeave);
  };
}
