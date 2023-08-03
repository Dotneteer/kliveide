/**
 * Defines the properties of the themes that can be used with Klive.
 */
export type ThemeProperties = {
  // --- Font attributes
  "--shell-windows-font-family"?: string;
  "--shell-font-family"?: string;
  "--shell-windows-monospace-font-family"?: string;
  "--shell-monospace-font-family"?: string;

  // --- Global theme attributes
  "--bgcolor-splitter"?: string;
  "--color-command-icon"?: string;
  "--color-command-icon-disabled"?: string;
  "--bgcolor-scrollbar"?: string;
  "--bgcolor-scrollbar-thumb"?: string;
  "--bgcolor-attached-shadow"?: string;
  "--bgcolor-button-disabled"?: string;
  "--color-button-disabled"?: string;
  "--bgcolor-button"?: string;
  "--color-button"?: string;
  "--bgcolor-button-pointed"?: string;
  "--color-button-pointed"?: string;
  "--color-button-focused"?: string;
  "--color-text-hilite"?: string;
  "--bgcolor-input"?: string;
  "--color-input"?: string;

  // --- Drowpdown
  "--bg-color-dropdown-input"?: string;
  "--color-dropdown-input"?: string;
  "--bg-color-dropdown-menu"?: string;
  "--color-dropdown-menu"?: string;
  "--bg-color-dropdown-menu-pointed"?: string;
  "--bg-color-dropdown-menu-selected"?: string;

  // --- checkbox
  "--bgcolor-checkbox"?: string;
  "--color-checkbox"?: string;
  "--color-checkbox-border-normal"?: string;
  "--color-checkbox-border-focused"?: string;

  // --- Context menu
  "--bgcolor-context-menu"?: string;
  "--color-context-item"?: string;
  "--color-context-item-disabled"?: string;
  "--bgcolor-context-item-pointed"?: string;
  "--color-context-item-pointed"?: string;
  "--color-context-separator"?: string;

  // --- Modal
  "--bgcolor-backdrop"?: string;
  "--bgcolor-modal"?: string;
  "--color-modal"?: string;
  "--border-modal"?: string;
  "--radius-modal"?: string;
  "--bgcolor-modal-header"?: string;
  "--color-modal-header"?: string;
  "--bgcolor-modal-body"?: string;
  "--color-modal-body"?: string;
  "--bgcolor-modal-footer"?: string;
  "--color-modal-footer"?: string;

  // --- Console colors
  "--console-ansi-black"?: string;
  "--console-ansi-blue"?: string;
  "--console-ansi-bright-black"?: string;
  "--console-ansi-bright-blue"?: string;
  "--console-ansi-bright-cyan"?: string;
  "--console-ansi-bright-green"?: string;
  "--console-ansi-bright-magenta"?: string;
  "--console-ansi-bright-red"?: string;
  "--console-ansi-bright-white"?: string;
  "--console-ansi-bright-yellow"?: string;
  "--console-ansi-cyan"?: string;
  "--console-ansi-green"?: string;
  "--console-ansi-magenta"?: string;
  "--console-ansi-red"?: string;
  "--console-ansi-white"?: string;
  "--console-ansi-yellow"?: string;
  "--console-default"?: string;

  // --- Label colors
  "--color-label"?: string;
  "--color-value"?: string;
  "--color-secondary-label"?: string;

  // --- Activity bar
  "--bgcolor-activitybar"?: string;
  "--color-activitybar"?: string;
  "--bgcolor-activitybar-active"?: string;
  "--bgcolor-activitybar-pointed"?: string;
  "--bgcolor-activitybar-activepointed"?: string;
  "--color-activitybar-active"?: string;

  // --- Tooltip
  "--border-tooltip"?: string;
  "--font-size-tooltip"?: string;
  "--bgcolor-tooltip"?: string;
  "--color-tooltip"?: string;
  "--radius-tooltip"?: string;
  "--padding-tooltip"?: string;
  "--shadow-tooltip"?: string;

  // --- Toolbar
  "--bgcolor-toolbar"?: string;
  "--bgcolor-keydown-toolbarbutton"?: string;
  "--bgcolor-toolbarbutton-disabled"?: string;
  "--color-toolbarbutton"?: string;
  "--color-toolbarbutton-green"?: string;
  "--color-toolbarbutton-blue"?: string;
  "--color-toolbarbutton-red"?: string;
  "--color-toolbar-separator"?: string;
  "--color-toolbarbutton-selected"?: string;

  // --- Statusbar
  "--bgcolor-statusbar"?: string;
  "--color-statusbar-label"?: string;
  "--color-statusbar-icon"?: string;

  // --- Sitebar
  "--bgcolor-sitebar"?: string;
  "--color-header"?: string;
  "--color-chevron"?: string;
  "--color-chevron-selected"?: string;
  "--color-panel-header"?: string;
  "--color-panel-border"?: string;
  "--color-panel-focused"?: string;

  // --- Emulator area
  "--bgcolor-emuarea"?: string;
  "--bgcolor-emuoverlay"?: string;
  "--color-emuoverlay"?: string;

  // --- Keyboard
  "--bgcolor-keyboard"?: string;
  "--bgcolor-key"?: string;
  "--color-key-main"?: string;
  "--color-key-symbol"?: string;
  "--color-key-above"?: string;
  "--color-key-below"?: string;
  "--color-key-highlight"?: string;

  // --- Document area
  "--bgcolor-docspanel"?: string;
  "--bgcolor-docsheader"?: string;
  "--color-doc-icon"?: string;
  "--color-doc-border"?: string;
  "--color-doc-activeText"?: string;
  "--color-doc-inactiveText"?: string;
  "--bgcolor-doc-activeTab"?: string;
  "--bgcolor-doc-inactiveTab"?: string;
  "--bgcolor-docscontainer"?: string;
  "--color-tabbutton-fill-inactive"?: string;
  "--color-tabbutton-fill-active"?: string;
  "--bgcolor-tabbutton-pointed"?: string;
  "--bgcolor-tabbutton-down"?: string;
  "--color-readonly-icon-active"?: string;
  "--color-readonly-icon-inactive"?: string;
  "--color-button-separator"?: string;

  // --- Tool area
  "--bgcolor-toolarea"?: string;
  "--color-tooltab-active"?: string;
  "--color-tooltab-inactive"?: string;
  "--color-prompt"?: string;
  "--color-tool-border"?: string;

  // --- Breakpoints panel
  "--color-breakpoint-enabled"?: string;
  "--color-breakpoint-disabled"?: string;
  "--color-breakpoint-current"?: string;

  // --- Disassembly panel
  "--bgcolor-disass-even-row"?: string;
  "--bgcolor-disass-hover"?: string;

  // --- Memory panel
  "--bgcolor-memory-pointed"?: string;
  "--bgcolor-memory-pc-pointed"?: string;
  "--color-memory-pointed"?: string;

  // --- Explorer
  "--color-explorer"?: string;
  "--bgcolor-explorer-pointed"?: string;
  "--fill-explorer-icon"?: string;
  "--bgcolor-explorer-selected"?: string;
  "--bgcolor-explorer-focused-selected"?: string;
  "--color-explorer-selected"?: string;
  "--color-explorer-focused-selected"?: string;
  "--border-explorer-focused"?: string;
};

/**
 * Describes a theme with its properties
 */
export type ThemeInfo = {
  tone: ThemeTone;
  properties: ThemeProperties;
};

/**
 * Represents information about an image in the registry.
 */
export type ImageInfo = {
  /**
   * The name (alias) of the icon.
   */
  name: string;

  /**
   * Image type
   */
  type: "png";

  /**
   * Base64 image data
   */
  data: string;
};

/**
 * Each theme can have a light or a dark tone.
 */
export const ThemeToneKeys = ["light", "dark"] as const;

/**
 * This type describes one the available theme tones.
 */
export type ThemeTone = typeof ThemeToneKeys[number];

/**
 * This type defines the contract to manage and change themes within an AppEngine application.
 */
export type ThemeManager = {
  /**
   * Gets the tone of the theme.
   */
  readonly theme: ThemeInfo;

  /**
   * Gets the value of the specified property
   * @param key Propery key
   * @returns Property value
   */
  readonly getThemeProperty: (key: string) => any;

  /**
   * Gets the information about the specified icon
   * @param key Icon ID
   * @returns Icon information
   */
  readonly getIcon: (key: string) => IconInfo | undefined;

  /**
   * Gets the information about the specified image
   * @param key Icon ID
   * @returns Icon information
   */
  readonly getImage: (key: string) => ImageInfo | undefined;

  /**
   * The HTML element that works as the root of the theme's scope.
   */
  readonly root: HTMLElement;
};

/**
 * Represents information about an icon in the registry.
 */
export type IconInfo = {
  /**
   * The name (alias) of the icon.
   */
  name: string;

  /**
   * SVG path string.
   */
  path: string;

  /**
   * Icon width
   */
  width: number;

  /**
   * Icon height
   */
  height: number;

  /**
   * Optional fill value.
   */
  fill?: string;

  /**
   * The fill-rule value of the icon
   */
  "fill-rule"?: string;

  /**
   * The clip-rule value of the icon
   */
  "clip-rule"?: string;
};
