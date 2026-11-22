"use client";
/**
 * The header's language selector. Each language links to the same page in that language; the list shows
 * every language in its own name (never translated). Hidden while the site has one language.
 */
import { useEffect, useRef, useState } from "react";
import { GLOBE_ICON } from "../page-components/SiteIcons";

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
    <div className="site-lang" ref={ref}>
      <button type="button" className="site-lang-button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {GLOBE_ICON}
        <span className="site-lang-name">{name}</span>
      </button>
      {open && (
        <ul className="site-lang-menu">
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
