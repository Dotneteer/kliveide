"use client";
/**
 * The docs navbar's language selector. Nextra's own LocaleSwitch only swaps the locale segment,
 * which 404s on a page that has no translation; this one knows which pages exist in each
 * language (`routes`, collected from the page maps at build time) and falls back to that
 * language's Get Started.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = Readonly<{
  label: string;
  /** [id, name in itself] in menu order */
  languages: [string, string][];
  /** Language id -> the routes it has, like "/de/get-started/install" */
  routes: Record<string, string[]>;
}>;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function DocsLanguageSwitch({ label, languages, routes }: Props) {
  const pathname = usePathname() ?? "/";
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

  const [, current = "en", ...rest] = pathname.replace(/\/$/, "").split("/");
  const tail = rest.length ? `/${rest.join("/")}` : "";
  const target = (lang: string) => {
    const candidate = `/${lang}${tail}`;
    return `${basePath}${routes[lang]?.includes(candidate) ? candidate : `/${lang}/get-started`}/`;
  };
  const name = languages.find(([id]) => id === current)?.[1] ?? current;

  return (
    <div className="site-lang" ref={ref}>
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span>{name}</span>
      </button>
      {open && (
        <ul>
          {languages.map(([id, native]) => (
            <li key={id}>
              <a href={target(id)} hrefLang={id} lang={id} aria-current={id === current ? "true" : undefined}>
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
