import { parseSvgIcon } from "./svg-icon-parser";
import type { MarkupIconInfo } from "./theme";

/**
 * Icons loaded from `src/renderer/assets/icons`.
 *
 * Drop an `.svg` file into that folder and its file name becomes an icon ID:
 * `sun.svg` registers the ID `sun`. The files are inlined at build time, so
 * there is no runtime file access and nothing to configure in the packaging
 * step.
 *
 * The glob is flat on purpose (`*.svg`, not `**` + `/*.svg`): one folder, one
 * ID per file, no way for two files to claim the same name.
 */
const sources = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

/** Icon IDs may only use characters that are safe in markup and in a DOM ID. */
const VALID_ICON_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function loadFileIcons(): MarkupIconInfo[] {
  const icons: MarkupIconInfo[] = [];

  for (const [filePath, text] of Object.entries(sources)) {
    const fileName = filePath.split("/").pop() ?? filePath;
    const name = fileName.replace(/\.svg$/i, "");

    if (!VALID_ICON_NAME.test(name)) {
      // --- A leading "@" would collide with the image syntax that `Icon`
      // --- resolves through `getImage`, and the rest would produce IDs that
      // --- cannot be referenced cleanly.
      console.warn(
        `[icons] Skipping "${fileName}": "${name}" is not a valid icon ID ` +
          `(use letters, digits, ".", "_" and "-", starting with a letter or digit).`
      );
      continue;
    }

    const parsed = parseSvgIcon(name, text);
    // --- Explicit comparison: see the note on `ParsedIcon`
    if (parsed.ok === false) {
      console.warn(`[icons] Skipping "${fileName}": ${parsed.reason}`);
      continue;
    }

    for (const warning of parsed.warnings) {
      console.warn(`[icons] "${fileName}": ${warning}`);
    }

    icons.push(parsed.icon);
  }

  return icons;
}

export const fileIconLibrary: MarkupIconInfo[] = loadFileIcons();
