"use client";
/**
 * The docs navbar's light/dark switch: the same button as the landing page's (landing/ThemeToggle.tsx),
 * driven through next-themes, which Nextra runs on the docs pages. Both write the `theme` key, so a
 * choice holds across the whole site. The sidebar's switch keeps the "System" choice.
 */
import { useTheme } from "nextra-theme-docs";
import { MOON_ICON } from "./SiteIcons";

export default function DocsThemeToggle({ label }: Readonly<{ label: string }>) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className="site-icon-button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {MOON_ICON}
    </button>
  );
}
