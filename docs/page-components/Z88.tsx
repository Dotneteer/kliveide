/**
 * Inline notation for the Cambridge Z88 User Guide (`content/en/library/cambridge-z88/`), following the
 * manual's own "Conventions in this manual" page:
 *
 *   <Key k="enter" />            a key legend, drawn as a keycap (the manual's key pictures)
 *   <Typed>myfile</Typed>        what the reader types at the keyboard
 *   `Name of file to save`       what the Z88 shows on its screen (plain inline code)
 *
 * The keycaps are text, not pictures, so they scale with the page, follow the theme and can be
 * found by the page search.
 */
import type { ReactNode } from "react";
import styles from "./Z88.module.scss";

/** The keys the manual names with a legend, and how each is labelled */
const KEYS: Record<string, { label: string; title: string; symbol?: boolean }> = {
  enter: { label: "ENTER", title: "Enter" },
  esc: { label: "ESC", title: "Escape" },
  tab: { label: "TAB", title: "Tab" },
  del: { label: "DEL", title: "Delete" },
  menu: { label: "MENU", title: "Menu" },
  index: { label: "INDEX", title: "Index" },
  help: { label: "HELP", title: "Help" },
  space: { label: "SPACE", title: "Space" },
  capslock: { label: "CAPS LOCK", title: "Caps Lock" },
  shift: { label: "SHIFT", title: "Shift" },
  diamond: { label: "◇", title: "Diamond", symbol: true },
  square: { label: "□", title: "Square", symbol: true },
  left: { label: "←", title: "Cursor left", symbol: true },
  right: { label: "→", title: "Cursor right", symbol: true },
  up: { label: "↑", title: "Cursor up", symbol: true },
  down: { label: "↓", title: "Cursor down", symbol: true },
  // --- The PC keys the conventions page maps the Square and Diamond keys to
  alt: { label: "ALT", title: "Alt (PC keyboard)" },
  ctrl: { label: "CTRL", title: "Ctrl (PC keyboard)" }
};

export function Key({ k }: Readonly<{ k: string }>) {
  const key = KEYS[k];
  if (!key) throw new Error(`<Key k="${k}">: unknown Z88 key`);
  return (
    <kbd className={key.symbol ? `${styles.key} ${styles.symbol}` : styles.key} title={key.title}>
      {key.label}
    </kbd>
  );
}

export function Typed({ children }: Readonly<{ children: ReactNode }>) {
  return <span className={styles.typed}>{children}</span>;
}
