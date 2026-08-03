import { forwardRef } from "react";

type LogoProps = {
  className?: string;
  color?: string;
};

const ASPECT_RATIO = 3823 / 1566;

/**
 * Real "ikra." wordmark asset (public/img/logo-white.png), recolored via
 * CSS mask so any brand color can be applied to the same source file.
 * Forwards its ref so callers can animate the color directly (e.g. when
 * scroll-driven content passes behind it).
 */
const Logo = forwardRef<HTMLSpanElement, LogoProps>(function Logo(
  { className = "w-[110px]", color = "var(--color-ink)" },
  ref,
) {
  return (
    <span
      ref={ref}
      role="img"
      aria-label="ikra"
      className={`inline-block ${className}`}
      style={{
        aspectRatio: ASPECT_RATIO,
        backgroundColor: color,
        WebkitMaskImage: "url(/img/logo-white.png)",
        maskImage: "url(/img/logo-white.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  );
});

export default Logo;
