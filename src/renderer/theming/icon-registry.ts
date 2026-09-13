import { iconLibrary } from "./icon-defs";
import { fileIconLibrary } from "./file-icon-defs";
import type { IconInfo } from "./theme";

/**
 * The merged icon registry.
 *
 * Two sources feed it, in ascending order of precedence:
 *
 * 1. `icon-defs.ts` - the stock single-path icons compiled into the app.
 * 2. `assets/icons/*.svg` - drop-in files, which **override** a stock icon of
 *    the same name.
 *
 * Lookups go through a `Map`, so resolving an icon is O(1) rather than a linear
 * scan of the stock array on every render of every icon.
 */

/** The ID used when a requested icon does not exist. */
const FALLBACK_ICON_NAME = "unknown";

export type IconRegistry = {
  icons: Map<string, IconInfo>;
  /** Names where a file icon took precedence over a stock icon. */
  shadowed: string[];
};

/**
 * Merges the two icon sources. Exported so the precedence rule can be tested
 * without reaching for the real folder contents.
 */
export function buildIconRegistry(
  stockIcons: readonly IconInfo[],
  fileIcons: readonly IconInfo[]
): IconRegistry {
  const icons = new Map<string, IconInfo>();
  for (const icon of stockIcons) {
    icons.set(icon.name, icon);
  }

  const shadowed: string[] = [];
  for (const icon of fileIcons) {
    if (icons.has(icon.name)) {
      shadowed.push(icon.name);
    }
    icons.set(icon.name, icon);
  }

  return { icons, shadowed };
}

const registry = buildIconRegistry(iconLibrary, fileIconLibrary);

if (import.meta.env?.DEV && registry.shadowed.length > 0) {
  console.info(
    `[icons] File icons override stock icons: ${registry.shadowed.join(", ")}`
  );
}

/**
 * Resolves an icon by ID, falling back to the "unknown" icon.
 *
 * @param name Icon ID
 */
export function lookupIcon(name: string): IconInfo | undefined {
  return registry.icons.get(name) ?? registry.icons.get(FALLBACK_ICON_NAME);
}

/**
 * Lists every registered icon ID, sorted. Useful when hunting for an existing
 * icon rather than adding a duplicate.
 */
export function listIconNames(): string[] {
  return [...registry.icons.keys()].sort();
}
