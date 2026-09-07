/**
 * The monospace fonts offered for the Monaco editor in View | Editor Options | Font Family.
 *
 * Iosevka ships with Klive (see src/renderer/assets/styles/fonts.css) and is the default on every
 * platform. The remaining entries are the best system monospace font of their platform, offered so
 * users who prefer their platform's familiar look are not forced onto the bundled one.
 */
export type EditorFontOption = {
  /** Stable id persisted in the settings file. */
  id: string;
  /** Label shown in the menu. */
  label: string;
  /** CSS font stack handed to Monaco. */
  fontFamily: string;
  /**
   * Platform this font is offered on. Omitted means "every platform".
   * The stacks always end in a generic fallback, so a font persisted on one platform still
   * renders something sensible if the settings file travels to another.
   */
  platform?: "win32" | "posix";
};

export const EDITOR_FONT_OPTIONS: EditorFontOption[] = [
  // --- Bundled fonts. These have no `platform`, so they are offered everywhere and render
  // --- identically on every OS. Each stack falls back to Iosevka before the system fonts: it is
  // --- always present and has the widest glyph coverage of the bundled set.
  {
    // --- 0.500em per glyph, roughly 17% narrower than the 0.600em mainstream, which is what
    // --- makes disassembly and memory dumps fit. Slashed zero is baked into the outline.
    id: "iosevka",
    label: "Iosevka",
    fontFamily: "Iosevka, Menlo, Consolas, 'Courier New', monospace"
  },
  {
    // --- The only other font here that is also 0.500em, and the one with a width axis
    // --- (wdth 50-200) should a density control ever be wanted. Slashed zero by default.
    id: "inconsolata",
    label: "Inconsolata",
    fontFamily: "Inconsolata, Iosevka, Menlo, Consolas, monospace"
  },
  {
    // --- 0.600em. Retains a width axis (wdth 62.5-100); at 62.5 it reaches 0.500em.
    id: "noto-sans-mono",
    label: "Noto Sans Mono",
    fontFamily: "'Noto Sans Mono', Iosevka, Menlo, Consolas, monospace"
  },
  {
    // --- 0.600em. The only bundled editor font with a true italic. Dotted zero by default.
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    fontFamily: "'JetBrains Mono', Iosevka, Menlo, Consolas, monospace"
  },
  {
    // --- 0.600em. Its ligatures stay off - see fontLigatures in MonacoEditor.tsx.
    id: "fira-code",
    label: "Fira Code",
    fontFamily: "'Fira Code', Iosevka, Menlo, Consolas, monospace"
  },

  // --- System fonts, offered only where they actually exist.
  {
    // --- Ships with Windows and with Visual Studio; at 0.55em it is the narrowest system mono.
    id: "consolas",
    label: "Consolas (system)",
    fontFamily: "Consolas, 'Courier New', monospace",
    platform: "win32"
  },
  {
    // --- Menlo is the macOS default; DejaVu Sans Mono covers virtually every Linux desktop.
    id: "menlo",
    label: "Menlo / DejaVu Sans Mono (system)",
    fontFamily: "Menlo, 'DejaVu Sans Mono', 'Liberation Mono', Monaco, monospace",
    platform: "posix"
  }
];

/** The id used when nothing is stored yet, or when the stored id is not valid here. */
export const DEFAULT_EDITOR_FONT_ID = EDITOR_FONT_OPTIONS[0].id;

/** The fonts to offer on the current platform, in menu order. */
export function getEditorFontOptions(isWindows: boolean): EditorFontOption[] {
  const platform = isWindows ? "win32" : "posix";
  return EDITOR_FONT_OPTIONS.filter((f) => !f.platform || f.platform === platform);
}

/**
 * Resolves a stored font id to the CSS stack to hand Monaco. Falls back to the bundled default
 * when the id is unknown or belongs to another platform - which happens whenever a settings file
 * written on Windows is opened on macOS/Linux, or the other way round.
 */
export function getEditorFontFamily(fontId: string, isWindows: boolean): string {
  const available = getEditorFontOptions(isWindows);
  const match = available.find((f) => f.id === fontId);
  return (match ?? available[0]).fontFamily;
}
