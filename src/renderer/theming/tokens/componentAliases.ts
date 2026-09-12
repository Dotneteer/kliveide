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

  // --- Sidebar ("sitebar" in the source) --------------------------------------------------------
  "--bgcolor-sitebar": "var(--surface-panel)",
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
  "--bgcolor-expandable": "var(--surface-panel)",

  // --- Tool area --------------------------------------------------------------------------------
  "--bgcolor-toolarea": "var(--surface-panel)",
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
  "--bgcolor-switch-off": "var(--surface-active)"
};
