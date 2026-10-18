"use client";
/**
 * Light/dark switch. It shares next-themes' storage key and <html> class with the docs (Nextra),
 * so a choice made on either part of the site holds on the other.
 */
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
    <button type="button" className="lp-icon-button" onClick={toggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Runs before the page paints: applies the stored theme, so a dark-mode visitor never sees a
 * white flash. The same logic next-themes runs on the docs pages.
 */
export const themeBootScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t}}catch(e){}`;
