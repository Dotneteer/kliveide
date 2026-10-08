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
  /*
   * The overflow shadow. This used to be `var(--surface-canvas)` — a *surface*, used as a shadow.
   * That is why the affordance never appeared: in dark, canvas (#141517) is three RGB steps from
   * the panel it was drawn on, and in light it is pure white, i.e. a white shadow. Both tones were
   * painting something perfectly invisible.
   */
  "--bgcolor-attached-shadow": "var(--shadow-scroll)",
  "--bgcolor-attached-shadow-line": "var(--shadow-scroll-line)",
  "--bgcolor-button": "var(--accent-solid)",
  "--color-button": "var(--text-on-accent)",
  "--bgcolor-button-pointed": "var(--accent-solid-hover)",
  "--color-button-pointed": "var(--text-on-accent)",
  "--color-button-focused": "var(--accent-solid)",
  "--bgcolor-button-disabled": "var(--surface-active)",
  "--color-button-disabled": "var(--text-disabled)",
  /**
   * The secondary button — an outline, not a second filled accent.
   *
   * `Button` used to have one variant axis (`isDanger`), so a dialog footer drew Cancel and its
   * commit button in the identical accent fill and nothing said which one committed.
   */
  "--bgcolor-button-secondary": "transparent",
  "--color-button-secondary": "var(--text-primary)",
  "--border-button-secondary": "var(--border-default)",
  "--bgcolor-button-secondary-pointed": "var(--surface-hover)",
  /**
   * The destructive button takes the *status* hue. It used to take `--console-ansi-red`, and the
   * ANSI table is deliberately non-semantic and identical in both tones, so a light-theme danger
   * button painted itself in the dark theme's red.
   */
  "--bgcolor-button-danger": "var(--status-error)",
  "--bgcolor-button-danger-pointed": "var(--status-error-hover)",
  "--color-button-danger": "var(--text-on-accent)",
  "--color-text-hilite": "var(--accent-text)",
  /**
   * A dialog field needs an edge, not just a fill. `--surface-raised` is `#ffffff` in the light
   * tone and so is the modal body, which left every input and dropdown in every dialog invisible.
   */
  "--bgcolor-input": "var(--surface-raised)",
  "--color-input": "var(--text-primary)",
  "--border-input": "var(--border-default)",
  "--bgcolor-item-hover": "var(--surface-hover)",

  // --- Dropdown (the source misspells this group "Drowpdown") -----------------------------------
  "--bg-color-dropdown-input": "var(--surface-raised)",
  "--color-dropdown-input": "var(--text-primary)",
  "--border-color-dropdown-input": "var(--border-default)",
  "--bg-color-dropdown-menu": "var(--surface-overlay)",
  "--color-dropdown-menu": "var(--text-primary)",
  "--bg-color-dropdown-menu-pointed": "var(--surface-overlay-hover)",
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
  "--bgcolor-context-item-pointed": "var(--surface-overlay-hover)",
  "--color-context-item-pointed": "var(--text-primary)",
  "--bgcolor-context-item-dangerous-pointed": "var(--status-error-subtle)",
  "--color-context-separator": "var(--border-subtle)",
  "--border-context-menu": "var(--border-default)",
  "--shadow-context-menu": "var(--shadow-3)",
  "--radius-context-menu": "var(--radius-md)",

  // --- Modal ------------------------------------------------------------------------------------
  /**
   * A dialog is a floating *tool panel*, not a lifted card.
   *
   * Header and footer take `--surface-chrome` and the flat `PanelHeader` idiom the Output panel and
   * the sprite editor's toolbar already wear. They deliberately do **not** take `--surface-raised`:
   * "raised" means lighter, which in the light tone means `#ffffff` — the same value as
   * `--surface-overlay`, so the header, the body and the footer all painted one undifferentiated
   * white and the band existed only as a 2%-opacity texture. Same trap as the sidebar header band.
   *
   * The seams are `--border-default`, not `--border-subtle`: they separate two *surfaces*, where
   * subtle divides one surface into cells.
   */
  "--bgcolor-modal": "var(--surface-overlay)",
  "--color-modal": "var(--text-primary)",
  "--border-modal": "1px solid var(--border-default)",
  "--border-modal-section": "1px solid var(--border-default)",
  "--shadow-modal": "var(--shadow-3)",
  "--radius-modal": "var(--radius-md)",
  "--bgcolor-modal-header": "var(--surface-chrome)",
  "--color-modal-header": "var(--text-secondary)",
  "--bgcolor-modal-body": "var(--surface-overlay)",
  "--color-modal-body": "var(--text-primary)",
  "--bgcolor-modal-footer": "var(--surface-chrome)",
  "--color-modal-footer": "var(--text-primary)",
  /**
   * The title chip — the accent's only landing place in the dialog chrome.
   *
   * The 2px accent slab this replaces was the last one in the app; document tabs moved the same cue
   * onto a chip behind their glyph. `-danger` follows `primaryDanger`, so a destructive dialog is
   * marked in the header as well as on its commit button.
   */
  "--bgcolor-modal-chip": "var(--accent-subtle)",
  "--color-modal-chip": "var(--accent-text)",
  "--bgcolor-modal-chip-danger": "var(--status-error-subtle)",
  "--color-modal-chip-danger": "var(--status-error)",

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
  // Primary actions, so full-contrast rather than the secondary tier the first pass used — with
  // --text-secondary the whole toolbar read as disabled.
  "--color-toolbarbutton": "var(--text-primary)",
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

  // --- Sidebar --------------------------------------------------------
  "--bgcolor-sidebar": "var(--surface-panel)",
  /*
   * The sidebar's own title ("DEBUG", "EXPLORER"). Promoted from `--text-secondary`: it is the
   * heading the panel headers below it sit under, and it was rendering *quieter* than they were.
   */
  "--color-header": "var(--text-primary)",
  "--color-chevron": "var(--text-tertiary)",
  "--color-chevron-selected": "var(--text-primary)",
  "--color-panel-header": "var(--text-secondary)",
  /* An expanded panel's title, and any header under the pointer. */
  "--color-panel-header-active": "var(--text-primary)",
  "--color-panel-border": "var(--border-subtle)",
  /*
   * The rule between sections of a register/state panel -- the `<Separator/>` after the Z80 flag
   * strip, after WZ, after IWV, and its equivalents in the M6510, VIC, Blink and ULA panels.
   *
   * `--border-strong`, not the `--border-default` these rules used to borrow from
   * `--color-toolbar-separator`. A border token is only as visible as the surface behind it, and
   * these sit on `--surface-panel` -- the darkest surface in the dark tone -- where
   * `--border-default` measures 1.37:1 and disappears. `--border-strong` takes it to 1.74:1 in
   * dark and 1.76:1 in light, and is what the ramp already carries for exactly this case: an edge
   * that has to be seen rather than merely implied.
   *
   * A divider is not text and not a control, so no WCAG threshold applies to it; the number that
   * matters is that it is now visible at a glance on both tones, which 1.37:1 was not.
   */
  "--color-panel-separator": "var(--border-strong)",

  /*
   * The overlay scrollbar handle, in its three interaction states.
   *
   * These replace hardcoded `#808080c0` / `#a0a0a0c0` / `#c0c0c0c0` literals that sat in
   * `assets/styles/overlayScrollbars-modified.css` — a single mid-grey used for *both* tones, which
   * is why the handle read as heavy on a dark panel and washed out on a light one.
   *
   * The three steps are existing text roles rather than new greys, so the progression is derived in
   * both tones and moves with the neutral ramp: at rest `--text-disabled` (2.78:1 dark / 2.48:1
   * light against `--surface-panel`) — present, but quieter than any real content; `--text-tertiary`
   * under the pointer (~4.7:1); `--text-secondary` while dragging (~6.3:1). A scrollbar is
   * navigation furniture, so resting contrast is deliberately below the data it sits beside.
   *
   * Tone-aware by construction, which is why the `os-theme-dark*` and `os-theme-light*` classes now
   * carry identical declarations — the *token* resolves per tone, so the two class pairs no longer
   * need to differ. (They are kept distinct only because `ScrollViewer` still selects between them.)
   */
  "--color-scrollbar-handle": "var(--text-disabled)",
  "--color-scrollbar-handle-hover": "var(--text-tertiary)",
  "--color-scrollbar-handle-active": "var(--text-secondary)",
  /* The band behind a panel header, and its hover state. Gradients, not flat colours — see
   * `--surface-header*` in semantic.ts for why the band is lit rather than filled. */
  "--bgcolor-panelHeader":
    "linear-gradient(180deg, var(--surface-header-lit), var(--surface-header))",
  "--bgcolor-panelHeader-hover":
    "linear-gradient(180deg, var(--surface-header-lit-hover), var(--surface-header-hover))",
  /* The rule at the band's foot. The open panel earns the stronger of the two, because that is the
   * edge data is about to scroll under. */
  "--color-panelHeader-rule": "var(--border-subtle)",
  "--color-panelHeader-rule-open": "var(--border-default)",
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
  // --- The ZX81 keyboard: light keys on a black case. A hovered legend on the key face takes the
  // --- accent's dark end, the keyword/function print on the case its light end (§8.1.6).
  "--bgcolor-keyboardzx81": "var(--device-body-zx81)",
  "--bgcolor-keyzx81": "var(--device-key-zx81)",
  "--color-keyzx81-main": "var(--device-legend-zx81-ink)",
  "--color-keyzx81-shift": "var(--device-legend-zx81-red)",
  "--color-keyzx81-legend": "var(--device-legend-main)",
  "--color-keyzx81-glyphframe": "var(--device-glyph-frame-zx81)",
  "--color-keyzx81-highlight": "var(--accent-on-device-light)",
  "--color-keyzx81-legend-highlight": "var(--accent-on-device-dark)",
  "--bgcolor-hilitedzx81": "var(--accent-device-pressed)",

  // --- Document area ----------------------------------------------------------------------------
  "--bgcolor-docspanel": "var(--surface-canvas)",
  "--bgcolor-docsheader": "var(--surface-chrome)",
  "--bgcolor-docscontainer": "var(--surface-canvas)",
  "--color-doc-icon": "var(--text-secondary)",
  // Was #181818 in dark — the same value as the document body, so the tab border was invisible.
  "--color-doc-border": "var(--border-subtle)",
  "--color-doc-activeText": "var(--text-primary)",
  "--color-doc-inactiveText": "var(--text-tertiary)",
  /**
   * Still emitted so a custom theme can set it, but the document tab strip no longer draws a top
   * accent bar: the active tab is now marked by taking the editor's own fill, by weight, and by
   * `--bgcolor-doc-activeGlyph` behind its file icon. The tool tabs keep their own
   * `--btopcolor-tooltab-activeTab`.
   */
  "--btopcolor-doc-activeTab": "var(--accent-solid)",
  "--bgcolor-doc-activeTab": "var(--surface-canvas)",
  /**
   * The rule between the tab strip and the editor below it.
   *
   * `--border-default`, not `--color-doc-border` (the hairline *between* tabs): this one separates
   * two different surfaces, the other divides one surface into cells, and the audit's whole point
   * was that those are not the same weight of line.
   */
  "--color-doc-seam": "var(--border-default)",
  /**
   * The chip behind the active tab's file glyph — where the accent now lands.
   *
   * A tab already carries a coloured, type-specific icon, so the accent has to either fight that
   * icon or frame it. Framing it puts the accent on the mark the eye goes to first and costs the
   * strip no extra ink.
   */
  "--bgcolor-doc-activeGlyph": "var(--accent-subtle)",
  "--bgcolor-doc-inactiveTab": "var(--surface-chrome)",
  "--color-tabbutton-fill-inactive": "var(--text-tertiary)",
  "--color-tabbutton-fill-active": "var(--text-primary)",
  "--bgcolor-tabbutton-pointed": "var(--surface-hover)",
  "--bgcolor-tabbutton-down": "var(--surface-active)",
  "--color-readonly-icon-active": "var(--status-warning)",
  "--color-readonly-icon-inactive": "var(--text-tertiary)",
  "--color-button-separator": "var(--border-default)",
  /*
   * An expandable section header — the `.NEX` and `.Z80` viewers' bank and register groups.
   *
   * Was `--surface-panel`, which is the surface these rows *sit on*: a header with no edge of its
   * own, readable as a header only from its position in the stack. `--surface-header` is the token
   * that exists for this role and is the one that knows which way to move per tone — raised in
   * dark, where lifting means lighter, and hovered in light, where it means darker.
   */
  "--bgcolor-expandable": "var(--surface-header)",
  "--bgcolor-expandable-hover": "var(--surface-header-hover)",

  // --- Tool area --------------------------------------------------------------------------------
  "--bgcolor-toolarea": "var(--surface-panel)",
  /**
   * The console's line-number gutter.
   *
   * `ConsoleOutput.module.scss` has read `var(--console-lineNo)` since the gutter was written, and
   * `theme.ts` declares it as a themable property — but nothing ever gave it a value, so the
   * reference resolved to nothing and the numbers inherited whatever colour the line was painting
   * in. It went unnoticed because the only panel that could have shown it never switched
   * `showLineNo` on.
   *
   * `--text-tertiary`, not `--text-disabled`: a line number is a quiet reference mark, not a
   * switched-off control, and `textDisabled` is deliberately below AA.
   */
  "--console-lineNo": "var(--text-tertiary)",
  /**
   * The line number of a line a writer marked as a diagnostic.
   *
   * The status colours rather than the ANSI palette: these answer "is this an error" and should
   * track the rest of the app's error and warning ink, not the sixteen terminal colours a pane
   * happens to paint its text with.
   */
  "--console-lineNo-error": "var(--status-error)",
  "--console-lineNo-warning": "var(--status-warning)",
  /**
   * The hovered console row. A console line carries clickable file references, so the row is a
   * target as well as text; this is what says so before the pointer reaches the link itself.
   */
  "--bgcolor-console-hovered": "var(--surface-hover)",
  /** Empty-state and watermark ink — present, but never competing with real output. */
  "--color-console-quiet": "var(--text-tertiary)",
  "--btopcolor-tooltab-activeTab": "var(--accent-solid)",
  "--color-tooltab-active": "var(--text-primary)",
  "--color-tooltab-inactive": "var(--text-tertiary)",
  /**
   * The text you type at the command prompt — the same ink the console prints in, so the line you
   * are writing matches the lines above it.
   *
   * It was `--status-success`. Nothing about an empty prompt is a success, and spending a status
   * colour on a field with no status to report left both the sigil and every character typed in
   * green at weight 600. Status colours are for the output, which already uses them.
   */
  "--color-prompt": "var(--text-primary)",
  /** The `\u276f` sigil at rest: present, but not competing with what you are typing. */
  "--color-prompt-sigil": "var(--text-tertiary)",
  /** The sigil while the prompt has focus — the accent's second appearance on the row. */
  "--color-prompt-sigil-active": "var(--accent-solid)",
  /**
   * The prompt strip's own ground.
   *
   * The prompt used to sit directly on the tool area with nothing between it and the scrolling
   * output, which is most of why its focus ring had to shout: the ring was the only thing marking
   * where the output stopped and the input began. A floor does that job without enclosing anything.
   */
  "--bgcolor-prompt": "var(--surface-chrome)",
  /**
   * The 2px edge down the left of the prompt strip, and the accent it takes when focused.
   *
   * This replaces `@include focus-ring` on the input. A `:focus-visible` ring is for picking one
   * control out of many; `CommandPanel` focuses its input on mount and again after every command,
   * and bounces focus back to it from the panel, so the ring was never not showing — permanent
   * chrome the width of the tool area. The rail says the same thing from the edge of the strip,
   * and it is the same device the Explorer uses to mark its selected row.
   */
  "--border-prompt-rail": "var(--border-strong)",
  "--border-prompt-rail-active": "var(--accent-solid)",
  "--color-tool-border": "var(--border-default)",

  // --- Breakpoints ------------------------------------------------------------------------------
  "--color-breakpoint-code": "var(--status-error)",
  "--color-breakpoint-binary": "var(--status-info)",
  "--color-breakpoint-mixed": "var(--console-ansi-bright-magenta)",
  "--color-breakpoint-disabled": "var(--text-disabled)",
  "--color-breakpoint-current": "var(--status-warning)",
  /*
   * The type badge beside a breakpoint — execute, memory read/write, I/O read/write.
   *
   * **One colour for all five.** These icons used to be painted from the *console's* ANSI palette —
   * bright blue for execute, bright green for the reads, bright magenta for the writes — three
   * saturated hues in the densest part of the sidebar, which is what §5.2 removed everywhere else.
   * The hues were carrying the read/write distinction, but the redrawn glyphs now say it themselves:
   * arrow up is a read, arrow down is a write, and the body says memory or port. With the shape
   * doing that work the colour has nothing left to encode, so it stops competing.
   *
   * The secondary accent rather than the primary: the row's *value* (the disassembled instruction)
   * is what the eye should land on first, and the badge is the supporting mark — the same primary/
   * secondary split this panel already uses for its instruction and its addresses.
   */
  "--color-breakpoint-type": "var(--accent-secondary-text)",
  /*
   * A logpoint's group (`.plans/LOGPOINTS_PLAN.md` §4.3, §4.5): the `[GROUP]` of each Log pane line
   * is painted with the output pane's `bright-magenta`, and the Breakpoints panel's group switch rows
   * take the same ink through this alias, so a group reads as one thing in both places.
   */
  "--color-logpoint": "var(--console-ansi-bright-magenta)",

  // --- Disassembly / memory ---------------------------------------------------------------------
  "--bgcolor-disass-even-row": "var(--surface-panel)",
  "--bgcolor-disass-hover": "var(--surface-hover)",
  "--bgcolor-memory-hover": "var(--surface-hover)",
  "--bgcolor-memory-pointed": "var(--accent-subtle)",
  "--bgcolor-memory-pc-pointed": "var(--status-success-subtle)",
  "--color-memory-pointed": "var(--text-primary)",

  /*
   * Memory dump columns: address, hex byte, ASCII char.
   *
   * Deliberately scoped to the memory dump alone, not folded into the shared `--data-*` hierarchy
   * that registers/watch/disassembly read - that hierarchy was flattened to neutral on purpose
   * (see the comment above `--data-value` et al.) so an orange accent would not collide with an
   * amber label in the densest panels. The memory dump is a classic hex-editor view instead of a
   * dense register grid, so it can afford - and reads better for - real colour: the address column
   * anchors the row in accent, the char column echoes it at lower strength so the two read as one
   * family, and the hex bytes stay the brightest, boldest thing in the row (`--text-primary` +
   * `.dumpSection`'s own bold weight) since they are what the user is actually here to read.
   *
   * The address/char family uses the accent's *primary* hue; the hovered-byte highlight below uses
   * the *secondary* hue instead. Keeping those two on different hues is what lets a hovered byte
   * read as "this is highlighted" instead of "this became an address": they sit right next to each
   * other in the row, so sharing a hue would blur the two meanings.
   */
  "--color-memory-address": "var(--accent-text)",
  "--color-memory-value": "var(--text-primary)",
  "--color-memory-char": "var(--accent-text-subtle)",
  /*
   * The hovered byte (hex and its ASCII pair) uses the secondary accent - see the note above
   * `--color-memory-address` for why the two columns deliberately use different hues from the
   * same accent.
   */
  "--color-memory-highlight": "var(--accent-secondary-text)",
  "--border-memory-highlight": "var(--accent-secondary-border)",

  /*
   * The memory view's heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D14): a fixed,
   * accent-independent ramp per kind of access, so it never reads as the changed-byte mark or the
   * hover (both the secondary accent). A heat cell *fills* - unlike the changed-byte mark, which
   * must not - because the fill is the information: the whole point of the view is the pattern a
   * region's bytes make together. The text keeps `--color-memory-value` on every step.
   */
  ...Object.fromEntries(
    (["exec", "read", "write"] as const).flatMap((kind) =>
      [1, 2, 3, 4, 5].map((step) => [`--color-heat-${kind}-${step}`, `var(--heat-${kind}-${step})`])
    )
  ),
  /* A self-modified byte (D9): outlined in the write hue's hottest step, whatever the mode */
  "--border-heat-smc": "var(--heat-write-5)",

  /*
   * Code coverage (D12, D13): the editor's strip and the disassembly's cell. Covered is the success
   * green (DeZog's convention, and the meaning: "this ran"); never-run code is a hollow mark in the
   * tertiary text colour - an absence, not a problem, so not a status hue.
   */
  "--color-coverage-covered": "var(--status-success)",
  "--color-coverage-uncovered": "var(--text-tertiary)",
  "--bgcolor-coverage-line": "var(--status-success-subtle)",

  /*
   * Disassembly columns: address, opcode bytes, decoded instruction, jump-target label.
   *
   * Same principles as the memory dump above, mapped onto disassembly's own columns rather than
   * reusing memory's literal roles: the address anchors the row in accent, and the decoded
   * instruction - what a disassembly view is actually for - takes the brightest, boldest neutral,
   * the same "most legible thing in the row" treatment the memory dump gives its hex bytes.
   *
   * Address and the jump-target label (`L8000:`) both take the *primary* hue - a label is a name
   * for the same address, not a different kind of information, so the two read as one family. The
   * opcode bytes take the *secondary* hue instead: unlike the memory dump's char column, these are
   * not being read as an extension of the address, so keeping them off the primary hue is what
   * keeps a busy row from reading as "everything here is the address".
   */
  "--color-disassembly-address": "var(--accent-text)",
  "--color-disassembly-instruction": "var(--text-primary)",
  "--color-disassembly-opcodes": "var(--accent-secondary-text)",
  "--color-disassembly-label": "var(--accent-text)",
  /*
   * The row the CPU is currently paused at - the same background wash the memory dump's hovered
   * byte sits on (`--bgcolor-memory-hover`, itself `--surface-hover`), scoped independently rather
   * than pointed at that name directly, matching every other `--color-disassembly-*`/
   * `--color-memory-*` token here being its own view's token even where the value happens to agree.
   */
  "--bgcolor-disassembly-current": "var(--surface-hover)",

  /*
   * The branch verdict gutter — whether a conditional branch will jump, given the live CPU state.
   *
   * Two roles, and the colour choice is the whole design:
   *
   * - **Taken takes the success hue.** Not because jumping is *good* — it is not, it is just what
   *   the flags say — but because this column is a live readout of machine state, and the status
   *   hues are what this app already uses for "here is a fact about the running machine". It also
   *   has to survive next to `--color-disassembly-address` and `-opcodes`, which are the accent and
   *   its secondary; a third accent-family hue in the same row would read as another data column
   *   rather than as a verdict.
   * - **Not-taken is deliberately neutral, and specifically not an error hue.** Falling through is
   *   not a failure — it is half of what a conditional branch does. `--status-error` and
   *   `--status-warning` are already spoken for in this very row (`--color-breakpoint-code`,
   *   `-binary`, and `--color-breakpoint-current` for the execution point), so a red fall-through
   *   would read as "something is wrong here" *and* collide with the breakpoint column two cells to
   *   its left.
   *
   * Certainty is carried by strength, not by hue: the row at PC paints these at full opacity and
   * every other row dims them, because away from PC the flags are today's rather than the ones that
   * will hold when the CPU arrives. See `.branchGutter` in `DisassemblyPanel.module.scss`.
   */
  "--color-disassembly-branch-taken": "var(--status-success)",
  "--color-disassembly-branch-fallthrough": "var(--text-secondary)",

  /*
   * An *annotated* disassembly listing — the `.NEX` viewer's bank view, read against its sidecar.
   *
   * A separate family from `--color-disassembly-*` above, because the two views answer different
   * questions. A machine disassembly is entirely generated, so its colour table describes structure:
   * address, opcodes, instruction. An annotated listing is generated text with a thin layer of
   * *authored* text laid over it — a name the user chose, a note they wrote, a decision they made
   * about what a run of bytes is — and its colour table has to describe that layer.
   *
   * The values come straight from the editor's own syntax palette rather than from the accent,
   * for two reasons:
   *
   * - **The listing and the source file are the same language.** A label is a label whether it came
   *   from a `.z80.asm` file or from a `.nex.dis` sidecar, and naming it in two different colours in
   *   two Klive windows is the drift this avoids.
   * - **The accent is already spoken for here.** `--color-disassembly-address` and
   *   `-label` are both `--accent-text`, so an annotation that also took the accent would read as
   *   another address column. Hue has to carry the distinction, which is exactly the principle
   *   `SYNTAX_HUES` was chosen under.
   *
   * `syntaxTokens` fixes every one of these against `NEUTRAL[tone].canvas`, which is the ground this
   * listing sits on, so no further contrast work is needed here.
   */
  "--color-annotation-comment": "var(--syntax-comment)",
  "--color-annotation-label": "var(--syntax-label)",
  "--color-annotation-directive": "var(--syntax-directive)",
  "--color-annotation-operand": "var(--syntax-operand)",
  /*
   * The leading rail on a row carrying anything authored.
   *
   * The label hue rather than a hue of its own: the rail marks *provenance*, and a name is the most
   * common thing a row is annotated with, so the two reading as one family is correct. Explicitly
   * not the accent — see above.
   */
  "--color-annotation-rail": "var(--syntax-label)",

  /*
   * The value column of the register/state sidebar panels — Z80 CPU, ULA & I/O, and any other that
   * opts in (see `valueXclass`/`iconFill` in `controls/data/registers.tsx`).
   *
   * Same principle as the memory dump and disassembly views above: the shared `--data-*` hierarchy
   * stays neutral on purpose (see the comment over `--data-value` in semantic.ts), so a panel that
   * wants real colour layers a token on top of the value cell alone rather than reopening that
   * clash. Labels (`AF`, `IF1`, `FCL`, `KL0`, ...) stay on `--data-label`; only the *value* — the
   * hex word, the decimal, the flag dot, the key bit — takes a hue.
   *
   * **One role token, not one per panel**, which is where this departs from `--color-memory-*` and
   * `--color-disassembly-*`. Those two are separate families because their role *tables* differ
   * (address/hex/char against address/opcode/instruction). Every register/state panel has the same
   * one-role table — "this is a live value" — so a shared token is the honest model, and it stops
   * the map growing a near-identical family per panel. Split it only when a panel needs a role the
   * others do not have.
   *
   * One hue, deliberately: every value in these panels is the same kind of thing, so the main bank,
   * the shadow bank (AF', BC', ...), the scalars, the flag dots and the keyboard bits all read as
   * one column of data. Splitting the shadow bank onto the secondary hue was tried and rejected:
   * `'` already says "shadow". The secondary accent stays reserved for the places it carries
   * information the text does not — memory's hovered byte, disassembly's opcode column.
   */
  "--color-state-value": "var(--accent-text)",

  /*
   * The *second kind* of value in a row, where a row carries two that must not be confused.
   *
   * This is the secondary accent's actual criterion, and these panels meet it twice:
   *
   * - `NextRegPanel`'s `08 → 08` — the left number is what was last written to the register, the
   *   right one is what it reads back as. The same register a moment apart.
   * - `MemMappingPanel`'s page rows — `bank8k bank16k readOffset writeOffset`, where the first two
   *   are *bank numbers* and the last two are *addresses into memory*. Four hex numbers in a row
   *   with no labels, and only the colour split says where one pair ends and the other begins.
   *
   * Note what it is not: the Z80 shadow bank was refused this exact treatment, because `AF'` is
   * *named* differently from `AF` — something already tells those two apart, so a second hue buys
   * nothing. Here nothing does but position.
   *
   * Dimmer emphasis alone (`--data-secondary`) is not a substitute: it makes the second value read
   * as chrome rather than as a value, when the whole point is that both are data.
   */
  "--color-state-value-alt": "var(--accent-secondary-text)",

  // --- Copper views (`.plans/COPPER_DEBUGGING_PLAN.md` §4.4, §4.5) -----------------------------
  /*
   * The raster ruler's three zones, in `cvc` order. The paper takes the accent's subtle fill
   * because it is where the list's effects are seen; the borders are neutral surfaces, the lower
   * one (border and blanking, mostly invisible) a step stronger than the upper.
   */
  "--bgcolor-copper-ruler-paper": "var(--accent-subtle)",
  "--bgcolor-copper-ruler-lower": "var(--surface-active)",
  "--bgcolor-copper-ruler-upper": "var(--surface-hover)",
  /* A WAIT's tick: the state value when it can match, muted when it never can (trap T5). */
  "--color-copper-tick": "var(--color-state-value)",
  "--color-copper-tick-park": "var(--text-tertiary)",
  /* The live beam is neutral; the hit is the execution point's colour, as everywhere else. */
  "--color-copper-beam": "var(--text-primary)",
  "--color-copper-hit": "var(--color-breakpoint-current)",
  /* The Copper's PC row and the hit row: two distinct markers (trap T1). */
  "--bgcolor-copper-pc": "var(--accent-subtle)",
  "--bgcolor-copper-hit": "var(--status-warning-subtle)",

  // --- Execution History (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.6) -----------------------
  /*
   * Event rows (INT, NMI, DMA hold) are separators, not instructions: a subtle neutral band with
   * secondary text, so a run of instructions reads unbroken and an interrupt still stands out. The
   * newest row is where the machine is now - the execution point's colour, as in the Copper list. A
   * frame boundary is a hairline, not a row: it must not change the row count G4.3 steps through.
   */
  "--bgcolor-history-separator": "var(--surface-hover)",
  "--color-history-separator": "var(--data-secondary)",
  "--bgcolor-history-newest": "var(--accent-subtle)",
  "--color-history-frame-line": "var(--border-strong)",
  "--color-history-recording": "var(--status-error)",

  // --- NEX bank browser content mix (`.plans/NEX_DMA_COPPER_REGIONS_PLAN.md` Phase 4) -----------
  /*
   * The two hardware-program kinds take fixed hues, not accent shades: the accent already owns
   * Code (primary) and Words (secondary), and Bytes takes the warning hue, so the two new segments
   * must stay apart from all three whichever accent is chosen. Success green for the Copper and the
   * favourite gold for DMA are the remaining fixed hues; neither is the default blue accent's hue
   * (which `--status-info` is, exactly). Each still sits near one accent (teal, gold) - the bar's
   * tooltip names every segment, so the colour is a cue, not the only carrier.
   */
  "--color-nex-mix-copper": "var(--status-success)",
  "--color-nex-mix-dma": "var(--mark-favorite)",

  // --- Changed since the previous stop (`.plans/SPRITE_INSPECTOR_PLAN.md` D16) -------------------
  /*
   * One treatment for "these bytes moved since the machine last stopped", defined once so any state
   * panel can adopt it: a dot in `--color-state-changed` beside the row's index. It is the data
   * hierarchy's own `--data-changed`, which exists for exactly this signal and had no user yet. It
   * is a marker, never a row fill: the row's values keep `--color-state-value`, and the selection
   * keeps its own wash.
   */
  "--color-state-changed": "var(--data-changed)",

  // --- Sprite Inspector (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.5) -------------------------------
  /* Effective visibility: drawn, or its own bit set but hidden by its anchor (trap T5). */
  "--color-sprite-visible": "var(--status-success)",
  "--color-sprite-hidden-by-anchor": "var(--status-warning)",
  /* A relative's anchor badge and the lit transform glyphs: the secondary hue of the row's values. */
  "--color-sprite-anchor": "var(--color-state-value-alt)",
  /* The diagnostic chips: a hidden or warning reason in the warning hue, an info one neutral (D13). */
  "--color-sprite-chip-warning": "var(--status-warning)",
  "--bgcolor-sprite-chip-warning": "var(--status-warning-subtle)",
  "--color-sprite-chip-info": "var(--text-secondary)",
  "--bgcolor-sprite-chip-info": "var(--surface-hover)",
  /* The sprite-space map: the paper zone, the clip window, every sprite, the selected one. */
  "--bgcolor-sprite-map": "var(--surface-active)",
  "--bgcolor-sprite-map-paper": "var(--accent-subtle)",
  "--color-sprite-map-clip": "var(--status-warning)",
  "--color-sprite-map-outline": "var(--color-state-value)",
  "--bgcolor-sprite-map-selected": "var(--accent-solid)",

  // --- Tilemap Inspector (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.5) ------------------------------
  /*
   * The overlays drawn on the map and the tile sheet. The clip window takes the warning hue, as on
   * the sprite-space map (it is what cuts pixels off); the visible window, a different thing on the
   * unscrolled map (where the screen's view lands after scrolling), the secondary accent; the
   * selection and a selected tile's users the primary accent. The grid is the editor's grid line.
   */
  "--color-tilemap-grid": "var(--border-subtle)",
  "--color-tilemap-clip": "var(--status-warning)",
  "--color-tilemap-visible": "var(--accent-secondary-solid)",
  "--color-tilemap-selected": "var(--accent-solid)",
  "--color-tilemap-index": "var(--text-primary)",
  "--bgcolor-tilemap-index": "var(--surface-canvas)",

  // --- Layer 2 Inspector (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.5) --------------------------------
  /*
   * The overlays on the Layer 2 image follow the Tilemap Inspector's: the clip window in the warning
   * hue, the visible window in the secondary accent, the selection in the primary accent. New here:
   * the $123B write window in the success hue (where writes land - a third thing to tell apart from
   * the two windows), bank boundaries as strong borders with a label chip, and the banks past 2 MB
   * hatched in the warning hue (absent pixels, never to be mistaken for transparent ones). The Banks
   * strip tags a bank's roles in the same hues: displayed the accent text, shadow the secondary.
   */
  "--color-layer2-clip": "var(--status-warning)",
  "--color-layer2-visible": "var(--accent-secondary-solid)",
  "--color-layer2-selected": "var(--accent-solid)",
  "--color-layer2-window": "var(--status-success)",
  "--color-layer2-bank": "var(--border-strong)",
  "--color-layer2-outside": "var(--status-warning)",
  "--color-layer2-label": "var(--text-primary)",
  "--bgcolor-layer2-label": "var(--surface-canvas)",
  "--color-layer2-role-displayed": "var(--accent-text)",
  "--color-layer2-role-shadow": "var(--accent-secondary-text)",

  // --- Next layer composition (`.plans/LAYER_COMPOSITION_PLAN.md` §4.5) ----------------------------
  /*
   * Four layers, four identities: the strip's chips, the clip-window outlines on the screen and the
   * Layers document's thumbnail frames all colour a layer the same way. The four status hues are the
   * only four well-separated hues that hold in both tones and under all six accents; here they name
   * a layer, never a status, and always sit beside the layer's name. The pill that announces a hidden
   * layer (D3) is the warning hue: that one *is* a status.
   */
  "--color-layers-ula": "var(--status-info)",
  "--color-layers-tm": "var(--status-success)",
  "--color-layers-l2": "var(--status-warning)",
  "--color-layers-spr": "var(--status-error)",
  "--color-layers-pill": "var(--status-warning)",
  "--color-layers-chip-off": "var(--text-disabled)",

  // --- Beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` D9) ----------------------------
  /*
   * Chrome over the paused emulator screen. The beam is the primary accent and the Copper's hit the
   * secondary (D7): two pointers into one raster get two markers in two hues. The part of the picture
   * past the beam belongs to the previous frame (D2), so it is washed with the backdrop's alpha and
   * hatched - never hidden: those are still the machine's pixels. The pill is the overlay pill's
   * surface with the beam's hue for its glyph.
   */
  "--color-beam-line": "var(--accent-solid)",
  "--color-beam-copper": "var(--accent-secondary-solid)",
  "--bgcolor-beam-stale": "var(--bgcolor-backdrop)",
  "--color-beam-hatch": "var(--border-strong)",
  "--color-beam-label": "var(--text-primary)",

  // --- Favourites (Select Machine dialog) -------------------------------------------------------
  "--color-favorite": "var(--mark-favorite)",

  // --- Explorer ---------------------------------------------------------------------------------
  "--color-explorer": "var(--text-secondary)",
  "--bgcolor-explorer-pointed": "var(--surface-hover)",
  "--fill-explorer-icon": "var(--accent-solid)",
  "--bgcolor-explorer-selected": "var(--surface-selected)",
  "--bgcolor-explorer-focused-selected": "var(--accent-subtle)",
  "--color-explorer-selected": "var(--text-primary)",
  "--color-explorer-focused-selected": "var(--text-primary)",
  "--border-explorer-focused": "var(--accent-solid)",
  /**
   * Folder names, which carry the tree's structure, against `--color-explorer` for the files
   * inside them. Two inks plus two weights are what make a deep tree scannable without guides
   * doing all the work.
   *
   * The filename's *extension* is receded with opacity rather than a third ink, because it must
   * recede by the same amount on all four row backgrounds — normal, hovered, selected and
   * focused-selected — and those do not share a foreground to derive a third ink from. The first
   * attempt used `--text-tertiary`, which is one 10% step off `--text-secondary` and did not read
   * at all against the file name it was meant to be separated from.
   */
  "--color-explorer-folder": "var(--text-primary)",
  /**
   * The 1px indent rules. `--border-default` rather than `--border-subtle`: a guide sits *on* the
   * panel surface with nothing else near it, so the subtler of the two disappears at 1px — in light
   * tone especially, where `borderSubtle` (#e5e7ea) is barely a step off `panel` (#f7f8f9).
   */
  "--border-explorer-guide": "var(--border-default)",
  /** The rail marking the selected row. Reads at 3px where a full-bleed wash alone does not. */
  "--border-explorer-rail": "var(--accent-solid)",

  // --- Debugging --------------------------------------------------------------------------------
  "--bgcolor-debug-active-bp": "var(--accent-subtle)",
  "--bgcolor-debug-macro-bp": "var(--status-success-subtle)",
  "--color-debug-unreachable-bp": "var(--status-warning)",
  /*
   * The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D7, Q1): "you are looking at the past".
   * The secondary accent, because the present's execution point is the primary one and both can be
   * talked about in one view (the editor, the status bar) - two pointers into one timeline. An
   * outline and a band, never a tint over a whole panel: a tinted panel reads as disabled.
   */
  "--color-history-marker": "var(--accent-secondary-solid)",
  "--color-history-text": "var(--accent-secondary-text)",
  "--bgcolor-history-band": "var(--accent-secondary-subtle)",
  "--border-history-band": "var(--accent-secondary-border)",

  // --- Editors ----------------------------------------------------------------------------------
  "--bgcolor-editors": "var(--surface-canvas)",

  // --- Sprite editor ----------------------------------------------------------------------------
  /** The editor's own ground. Declared since the token layers were built; first used in Phase 5. */
  "--bgcolor-sprite-editor": "var(--surface-canvas)",
  /** Ruler ticks and numbers. Also unused until Phase 5 - the rulers had never been written. */
  "--color-ruler-sprite-editor": "var(--text-tertiary)",
  /** The crosshatch that marks a transparent pixel. */
  "--color-dash-sprite-editor": "var(--border-subtle)",
  /** The cursor box on the hovered pixel. */
  "--color-pos-sprite-editor": "var(--accent-solid)",
  /**
   * The pixel grid, and the 8px guides over it.
   *
   * Two steps apart on purpose: the hairline has to separate adjacent pixels without competing with
   * the artwork, while the guide marks the axis a 16x16 sprite is composed around and has to stay
   * readable *through* it. Neither is a text or control edge, so no WCAG threshold applies.
   */
  "--color-grid-sprite-editor": "var(--border-subtle)",
  "--color-guide-sprite-editor": "var(--border-strong)",

  // --- Switch -----------------------------------------------------------------------------------
  "--color-switch-on": "var(--accent-solid)",
  "--bgcolor-switch-on": "var(--surface-active)",
  "--color-switch-off": "var(--text-tertiary)",
  "--bgcolor-switch-off": "var(--surface-active)",

  // --- Tape viewer timeline strip ----------------------------------------------------------------
  /*
   * One segment per block, coloured by what the block is (`.plans/TAPE_VIEWER_PLAN.md` §4.4.1).
   * Neutral by default, ordered by how much the block matters to a reader: data and code stand out
   * of the track more than headers, tones and pauses do. Only two hues: BASIC takes the accent (it
   * is the one block the viewer decodes), and a block Klive does not play takes the error colour -
   * the same fact the row's "not played" chip states. The selection ring is text-primary, not the
   * accent, so it stays visible on a BASIC segment.
   */
  "--bgcolor-tape-track": "var(--surface-canvas)",
  "--color-tape-segment-header": "var(--border-strong)",
  "--color-tape-segment-data": "var(--text-tertiary)",
  "--color-tape-segment-code": "var(--text-secondary)",
  "--color-tape-segment-basic": "var(--accent-solid)",
  "--color-tape-segment-tone": "var(--border-default)",
  "--color-tape-segment-pause": "var(--surface-active)",
  "--color-tape-segment-merged": "var(--text-disabled)",
  "--color-tape-segment-unplayable": "var(--status-error)",
  "--color-tape-segment-selected": "var(--text-primary)"
};
