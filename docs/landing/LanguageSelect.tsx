"use client";
/**
 * The header's language selector. Each language links to its own landing page; the list shows
 * every language in its own name (never translated). Hidden while the site has one language.
 */
import { useEffect, useRef, useState } from "react";

type Props = Readonly<{
  current: string;
  label: string;
  /** Language id -> [name in itself, landing page URL] */
  languages: [string, string, string][];
}>;

export default function LanguageSelect({ current, label, languages }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (languages.length < 2) return null;
  const name = languages.find(([id]) => id === current)?.[1] ?? current;
  return (
    <div className="lp-lang" ref={ref}>
      <button type="button" className="lp-lang-button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span className="lp-lang-name">{name}</span>
      </button>
      {open && (
        <ul className="lp-lang-menu">
          {languages.map(([id, native, href]) => (
            <li key={id}>
              <a href={href} hrefLang={id} lang={id} aria-current={id === current ? "true" : undefined}>
                {native}
                <small>{id}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
