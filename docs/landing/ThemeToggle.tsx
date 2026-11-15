"use client";
/**
 * Light/dark switch. It shares next-themes' storage key and <html> class with the docs (Nextra),
 * so a choice made on either part of the site holds on the other.
 */
import { MOON_ICON } from "../page-components/SiteIcons";

type Props = Readonly<{ label: string }>;

export default function ThemeToggle({ label }: Props) {
  const toggle = () => {
    const root = document.documentElement;
    const dark = root.classList.contains("dark") || (!root.classList.contains("light") && matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  };
  return (
    <button type="button" className="site-icon-button" onClick={toggle} aria-label={label} title={label}>
      {MOON_ICON}
    </button>
  );
}

/**
 * Runs before the page paints: applies the stored theme, so a dark-mode visitor never sees a
 * white flash. The same logic next-themes runs on the docs pages.
 */
export const themeBootScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t}}catch(e){}`;
