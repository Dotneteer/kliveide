/**
 * L4 — component aliases.
 *
 * The ~200 `--bgcolor-*` / `--color-*` names the app has always used, repointed from literal colours
 * onto the L2 semantic layer.
 *
 * This is the migration trick described in §3 of .plans/UI_MODERNIZATION_PLAN.md. Every one of the
 * 110 stylesheets keeps asking for exactly the token it always asked for, so nothing has to change
 * for the new palette to take effect everywhere at once — and later phases can retire an alias by
 * pointing its component at the L2 name directly, one panel at a time, without a flag day.
 *
 * Because L2 already varies by tone and accent, **this map is tone-independent**. That is what
 * collapses `light-theme.ts`: light is no longer a hand-copied parallel file that drifts, it is the
 * same aliases resolving against a different ramp (§8.2).
 *
 * Values are `var(--...)` references. They resolve because ThemeProvider writes both layers as
 * inline custom properties on the same `#themeRoot` element.
 */
export const componentAliases: Record<string, string> = {
  // --- Global -----------------------------------------------------------------------------------
  "--color-text": "var(--text-primary)",
  "--bgcolor-splitter": "var(--accent-solid)",
  "--color-command-icon": "var(--text-secondary)",
  "--color-command-icon-disabled": "var(--text-disabled)",
  "--bgcolor-scrollbar": "transparent",
  "--bgcolor-scrollbar-thumb": "var(--border-strong)",
  "--bgcolor-attached-shadow": "var(--surface-canvas)",
  "--bgcolor-button": "var(--accent-solid)",
  "--color-button": "var(--text-on-accent)",
  "--bgcolor-button-pointed": "var(--accent-solid-hover)",
  "--color-button-pointed": "var(--text-on-accent)",
  "--color-button-focused": "var(--accent-solid)",
  "--bgcolor-button-disabled": "var(--surface-active)",
  "--color-button-disabled": "var(--text-disabled)",
  "--color-text-hilite": "var(--accent-text)",
  "--bgcolor-input": "var(--surface-raised)",
  "--color-input": "var(--text-primary)",
  "--bgcolor-item-hover": "var(--surface-hover)",

  // --- Dropdown (the source misspells this group "Drowpdown") -----------------------------------
  "--bg-color-dropdown-input": "var(--surface-raised)",
  "--color-dropdown-input": "var(--text-primary)",
  "--bg-color-dropdown-menu": "var(--surface-overlay)",
  "--color-dropdown-menu": "var(--text-primary)",
  "--bg-color-dropdown-menu-pointed": "var(--surface-hover)",
  "--bg-color-dropdown-menu-selected": "var(--accent-subtle)",
  "--border-color-dropdown-menu": "var(--border-default)",

  // --- Checkbox ---------------------------------------------------------------------------------
  "--bgcolor-checkbox": "var(--surface-raised)",
  "--color-checkbox": "var(--accent-solid)",
  "--color-checkbox-border-normal": "var(--border-strong)",
  "--color-checkbox-border-focused": "var(--accent-solid)",

  // --- Context menu -----------------------------------------------------------------------------
  "--bgcolor-context-menu": "var(--surface-overlay)",
  "--color-context-item": "var(--text-primary)",
  "--color-context-item-dangerous": "var(--status-error)",
  "--color-context-item-disabled": "var(--text-disabled)",
  "--bgcolor-context-item-pointed": "var(--surface-hover)",
  "--color-context-item-pointed": "var(--text-primary)",
  "--bgcolor-context-item-dangerous-pointed": "var(--status-error-subtle)",
  "--color-context-separator": "var(--border-subtle)",
  "--border-context-menu": "var(--border-default)",
  "--shadow-context-menu": "var(--shadow-3)",
  "--radius-context-menu": "var(--radius-md)",

  // --- Modal ------------------------------------------------------------------------------------
  "--bgcolor-modal": "var(--surface-overlay)",
  "--color-modal": "var(--text-primary)",
  "--border-modal": "1px solid var(--border-default)",
  "--border-modal-section": "1px solid var(--border-subtle)",
  "--shadow-modal": "var(--shadow-3)",
  "--color-modal-accent": "var(--accent-solid)",
  "--radius-modal": "var(--radius-lg)",
  "--bgcolor-modal-header": "var(--surface-raised)",
  "--color-modal-header": "var(--text-primary)",
  "--bgcolor-modal-body": "var(--surface-overlay)",
  "--color-modal-body": "var(--text-primary)",
  "--bgcolor-modal-footer": "var(--surface-raised)",
  "--color-modal-footer": "var(--text-primary)",

  // --- Data labels ------------------------------------------------------------------------------
  // The re-cast from three hues to a contrast hierarchy (§5.2).
  "--color-label": "var(--data-label)",
  "--color-value": "var(--data-value)",
  "--color-secondary-label": "var(--data-secondary)",

  // --- Activity bar -----------------------------------------------------------------------------
  // The active item stops being a solid accent-filled 48px block. Phase 3 replaces the background
  // treatment with the 2px inner stripe; this already removes the saturated slab.
  "--bgcolor-activitybar": "var(--surface-chrome)",
  "--color-activitybar": "var(--text-tertiary)",
  "--bgcolor-activitybar-pointed": "var(--surface-hover)",
  "--bgcolor-activitybar-active": "var(--surface-hover)",
  "--bgcolor-activitybar-activepointed": "var(--surface-active)",
  "--color-activitybar-active": "var(--accent-solid)",

  // --- Tooltip ----------------------------------------------------------------------------------
  "--border-tooltip": "1px solid var(--border-default)",
  "--font-size-tooltip": "var(--font-size-200)",
  "--bgcolor-tooltip": "var(--surface-overlay)",
  "--color-tooltip": "var(--text-primary)",
  "--radius-tooltip": "var(--radius-sm)",
  "--shadow-tooltip": "var(--shadow-2)",

  // --- Toolbar ----------------------------------------------------------------------------------
  // The raw CSS keywords (white/cyan/orange/red/lightgreen) are gone: they had no shared hue family
  // and wildly unequal luminance.
  "--bgcolor-toolbar": "var(--surface-chrome)",
  "--bgcolor-keydown-toolbarbutton": "var(--surface-active)",
  "--bgcolor-toolbarbutton-disabled": "var(--text-disabled)",
  "--color-toolbarbutton": "var(--text-secondary)",
  "--color-toolbarbutton-green": "var(--status-success)",
  "--color-toolbarbutton-blue": "var(--accent-solid)",
  "--color-toolbarbutton-orange": "var(--status-warning)",
  "--color-toolbarbutton-red": "var(--status-error)",
  "--color-toolbar-separator": "var(--border-default)",
  "--color-toolbarbutton-selected": "var(--accent-solid)",
  "--bgcolor-toolbarbutton-hover": "var(--surface-hover)",

  // --- Status bar -------------------------------------------------------------------------------
  // Loses its saturated accent band (§4.2). State carries colour now, not the whole bar.
  "--bgcolor-statusbar": "var(--surface-chrome)",
  "--bgcolor-errorLabel": "var(--status-error)",
  "--color-statusbar-label": "var(--text-secondary)",
  "--color-statusbar-icon": "var(--text-secondary)",

  // --- Sidebar ("sitebar" in the source) --------------------------------------------------------
  "--bgcolor-sitebar": "var(--surface-panel)",
  "--color-header": "var(--text-secondary)",
  "--color-chevron": "var(--text-tertiary)",
  "--color-chevron-selected": "var(--text-primary)",
  "--color-panel-header": "var(--text-secondary)",
  "--color-panel-border": "var(--border-subtle)",
  "--color-panel-focused": "var(--accent-solid)",

  // --- Emulator area ----------------------------------------------------------------------------
  "--bgcolor-emuarea": "var(--surface-stage)",
  "--bgcolor-emuoverlay": "var(--surface-overlay)",
  "--color-emuoverlay": "var(--status-success)",
  "--bgcolor-display": "var(--device-bezel)",
  "--color-display": "var(--text-primary)",
  "--color-display-hilite": "var(--accent-solid)",

  // --- Keyboard (device surfaces: identical in both tones, §8.2.1) ------------------------------
  "--bgcolor-keyboard": "var(--device-body)",
  "--bgcolor-key": "var(--device-key)",
  "--color-key48-main": "var(--device-legend-main)",
  "--color-key128-main": "var(--device-legend-main)",
  "--color-key-symbol": "var(--device-legend-symbol)",
  "--color-key-above": "var(--device-legend-above)",
  "--color-key-below": "var(--device-legend-below)",
  "--bgcolor-key128": "var(--device-key-128)",
  "--bgcolor-key128-raise": "var(--device-key-raise)",
  "--bgcolor-keyz88": "var(--device-key-raise)",
  "--color-keyz88": "var(--text-secondary)",
  "--color-keyz88-main": "var(--device-legend-main)",
  "--color-key48-highlight": "var(--accent-solid)",
  "--color-key128-highlight": "var(--accent-solid)",
  "--color-keyz88-highlight": "var(--accent-solid)",
  "--bgcolor-hilited48": "var(--accent-subtle)",
  "--bgcolor-hilited128": "var(--accent-subtle)",
  "--bgcolor-hilitedz88": "var(--accent-subtle)",

  // --- Document area ----------------------------------------------------------------------------
  "--bgcolor-docspanel": "var(--surface-canvas)",
  "--bgcolor-docsheader": "var(--surface-chrome)",
  "--bgcolor-docscontainer": "var(--surface-canvas)",
  "--color-doc-icon": "var(--text-secondary)",
  // Was #181818 in dark — the same value as the document body, so the tab border was invisible.
  "--color-doc-border": "var(--border-subtle)",
  "--color-doc-activeText": "var(--text-primary)",
  "--color-doc-inactiveText": "var(--text-tertiary)",
  "--btopcolor-doc-activeTab": "var(--accent-solid)",
  "--bgcolor-doc-activeTab": "var(--surface-canvas)",
  "--bgcolor-doc-inactiveTab": "var(--surface-chrome)",
  "--color-tabbutton-fill-inactive": "var(--text-tertiary)",
  "--color-tabbutton-fill-active": "var(--text-primary)",
  "--bgcolor-tabbutton-pointed": "var(--surface-hover)",
  "--bgcolor-tabbutton-down": "var(--surface-active)",
  "--color-readonly-icon-active": "var(--status-warning)",
  "--color-readonly-icon-inactive": "var(--text-tertiary)",
  "--color-button-separator": "var(--border-default)",
  "--bgcolor-expandable": "var(--surface-panel)",

  // --- Tool area --------------------------------------------------------------------------------
  "--bgcolor-toolarea": "var(--surface-panel)",
  "--btopcolor-tooltab-activeTab": "var(--accent-solid)",
  "--color-tooltab-active": "var(--text-primary)",
  "--color-tooltab-inactive": "var(--text-tertiary)",
  "--color-prompt": "var(--status-success)",
  "--color-tool-border": "var(--border-default)",

  // --- Breakpoints ------------------------------------------------------------------------------
  "--color-breakpoint-code": "var(--status-error)",
  "--color-breakpoint-binary": "var(--status-info)",
  "--color-breakpoint-mixed": "var(--console-ansi-bright-magenta)",
  "--color-breakpoint-disabled": "var(--text-disabled)",
  "--color-breakpoint-current": "var(--status-warning)",

  // --- Disassembly / memory ---------------------------------------------------------------------
  "--bgcolor-disass-even-row": "var(--surface-panel)",
  "--bgcolor-disass-hover": "var(--surface-hover)",
  "--bgcolor-memory-hover": "var(--surface-hover)",
  "--bgcolor-memory-pointed": "var(--accent-subtle)",
  "--bgcolor-memory-pc-pointed": "var(--status-success-subtle)",
  "--color-memory-pointed": "var(--text-primary)",

  // --- Explorer ---------------------------------------------------------------------------------
  "--color-explorer": "var(--text-secondary)",
  "--bgcolor-explorer-pointed": "var(--surface-hover)",
  "--fill-explorer-icon": "var(--accent-solid)",
  "--bgcolor-explorer-selected": "var(--surface-selected)",
  "--bgcolor-explorer-focused-selected": "var(--accent-subtle)",
  "--color-explorer-selected": "var(--text-primary)",
  "--color-explorer-focused-selected": "var(--text-primary)",
  "--border-explorer-focused": "var(--accent-solid)",

  // --- Debugging --------------------------------------------------------------------------------
  "--bgcolor-debug-active-bp": "var(--accent-subtle)",
  "--bgcolor-debug-macro-bp": "var(--status-success-subtle)",
  "--color-debug-unreachable-bp": "var(--status-warning)",

  // --- Editors ----------------------------------------------------------------------------------
  "--bgcolor-editors": "var(--surface-canvas)",

  // --- Sprite editor ----------------------------------------------------------------------------
  "--bgcolor-sprite-editor": "var(--surface-panel)",
  "--color-ruler-sprite-editor": "var(--text-tertiary)",
  "--color-dash-sprite-editor": "var(--border-subtle)",
  "--color-pos-sprite-editor": "var(--accent-solid)",

  // --- Switch -----------------------------------------------------------------------------------
  "--color-switch-on": "var(--accent-solid)",
  "--bgcolor-switch-on": "var(--surface-active)",
  "--color-switch-off": "var(--text-tertiary)",
  "--bgcolor-switch-off": "var(--surface-active)"
};
