import Logo from "./Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-gray px-8 py-16 md:px-16">
      <div
        aria-hidden
        className="absolute top-0 left-1/2 aspect-square w-[60vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
      />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo className="w-[90px]" />
          <p className="mt-2 max-w-xs text-sm font-light text-ink/70">
            Rebranding agency for the most discerning ambitions.
          </p>
        </div>

        <div className="flex flex-col gap-1 text-sm font-light text-ink/80">
          <a href="mailto:hello@ikra.studio" className="hover:text-ink">
            hello@ikra.studio
          </a>
          <a href="tel:+10000000000" className="hover:text-ink">
            +1 (000) 000-0000
          </a>
        </div>

        <div className="flex gap-6 text-sm font-light text-ink/80">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            Instagram
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            LinkedIn
          </a>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-16 max-w-6xl border-t border-ink/20 pt-6 text-xs font-light text-ink/60">
        © {year} ikra studio. All rights reserved.
      </div>
    </footer>
  );
}
