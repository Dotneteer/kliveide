/*
 * The Settings dialog's content (`.plans/MENU_REDESIGN_PLAN.md` §4): its pages, and one row per
 * option, each naming where its value lives and how it is written. Everything here is pure, so the
 * rules — which rows a machine shows, what a row reads, what a search finds — are tested without
 * React (`test/settings/settings-pages.test.ts`).
 *
 * A row's value lives in one of two places:
 *  - a registered setting (`setting-definitions.ts`), written with `MainApi.setGlobalSettingsValue`;
 *  - the app state (the theme, the recording preferences, the Z88's LCD...), written with the
 *    `set:` UI action of the same key (`MainApi.runUiAction`, `src/main/ui-actions.ts`).
 * File rows (ROMs, the key mapping) show a value and offer buttons, which run UI actions.
 */
import { hasMachineFeature, isAdvancedDebuggingEnabled } from "@common/features/advancedDebugging";
import type { AppState } from "@state/AppState";
import type { UiActionId } from "./ui-action-ids";
import { KliveGlobalSettings } from "./setting-definitions";
import { getMonospaceFontOptions } from "./monospace-fonts";
import { EDITOR_FONT_SIZES, PANEL_FONT_SIZES } from "./font-sizes";
import { ZOOM_STEPS } from "./zoom-steps";
import { MOUSE_POINTER_DISPLAYS, MOUSE_SENSITIVITIES } from "./mouse-capture";
import { ACCENT_MENU_ITEMS, DEFAULT_ACCENT } from "@common/theming/accents";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  DEFAULT_AUTOMATION_LEVEL,
  parseAutomationLevel,
  parseAutomationSwitch
} from "@common/automation/protocol";
import {
  BEAM_POSITION_MACHINE_IDS,
  MC_DISK_SUPPORT,
  MC_SCREEN_SIZE,
  MC_SP48_ROM_FILE,
  MF_PROFILE,
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";
import { getTimexModel, type TimexModelId } from "@emu/machines/timex/timexModels";
import {
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_FONT_FAMILY,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_TABSIZE,
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_JUST_MY_CODE,
  SETTING_EMU_KEYBOARD_LAYOUT,
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_MOUSE_SENSITIVITY,
  SETTING_EMU_MOUSE_SHOW_POINTER,
  SETTING_EMU_SCANLINE_EFFECT,
  SETTING_EMU_SCORPION_ROM,
  SETTING_EMU_SHOW_BEAM_POSITION,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_MEDIA_INFO,
  SETTING_EMU_SHOW_NEXT_LAYERS,
  SETTING_EMU_SHOW_PERFORMANCE_INFO,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_EMU_STEP_IN_INTERRUPTS,
  SETTING_EMU_STOP_ON_ERRORS,
  SETTING_EMU_REVERSE_DEBUGGING,
  SETTING_EMU_REVERSE_DEBUG_MEMORY_MB,
  SETTING_EMU_PROFILE_COUNTERS,
  SETTING_EMU_PROFILE_RESET_AFTER_INJECTION,
  SETTING_EMU_PROFILE_RESET_ON_START,
  SETTING_IDE_COVERAGE_LINE_TINT,
  SETTING_IDE_PROFILER_INLAYS,
  SETTING_EMU_TC2048_ROM,
  SETTING_EMU_TC2068_ROM,
  SETTING_EMU_TRDOS_ROM,
  SETTING_EMU_TS2068_ROM,
  SETTING_EMU_ZOOM_STEP,
  SETTING_IDE_BP_GROUP_BY_KIND,
  SETTING_IDE_CLOSE_EMU,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_NAV_RECORD_TAB_SWITCH,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLS_ON_TOP,
  SETTING_PANEL_FONT_FAMILY,
  SETTING_PANEL_FONT_SIZE
} from "./setting-const";

/** The pages, in display order */
export const SETTINGS_PAGES = [
  { id: "general", title: "General" },
  { id: "appearance", title: "Appearance" },
  { id: "editor", title: "Editor" },
  { id: "emulator", title: "Emulator" },
  { id: "debugging", title: "Debugging" },
  { id: "machine", title: "Machine" },
  { id: "input", title: "Input" },
  { id: "recording", title: "Recording" },
  { id: "integrations", title: "Integrations" }
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number]["id"];

/** The app-state values a row can show; each is written by the `set:<key>` UI action */
export type SettingsStateKey =
  | "theme"
  | "accent"
  | "z88Lcd"
  | "recordingFps"
  | "recordingQuality"
  | "recordingFormat"
  | "windowRecordingIdePosition"
  | "windowRecordingPointer"
  | "windowRecordingClicks"
  | "windowRecordingHiDpi"
  | "sp48Rom"
  | "keyMappingFile"
  | "automationEnabled"
  | "automationLevel";

export type SettingsRowSource =
  | { kind: "setting"; settingId: string }
  | { kind: "state"; key: SettingsStateKey };

export type SettingsOptionValue = string | number | boolean;

export type SettingsOption = { label: string; value: SettingsOptionValue };

export type SettingsRowButton = {
  label: string;
  action: UiActionId;
  /** Shown only while the row has a value (a "Forget" or "Reset") */
  needsValue?: boolean;
  /** The action opens a dialog of its own, so the Settings dialog closes first */
  closesDialog?: boolean;
};

/** Where a row applies; a row without one applies everywhere */
export type SettingsRowCondition =
  | { kind: "machine"; machineIds: string[] }
  /** The Pentagon's and the Scorpion's Beta 128 */
  | { kind: "beta128" }
  | { kind: "kliveProject" }
  /** The advanced-debugging feature switch is on (`@common/features/advancedDebugging`) */
  | { kind: "advancedDebugging" }
  /**
   * The running machine has a feature, as `hasMachineFeature` answers (so a feature of the
   * advanced-debugging group also needs the switch): the coverage rows key on `MF_PROFILE`
   */
  | { kind: "feature"; feature: string };

export type SettingsRow = {
  id: string;
  page: SettingsPageId;
  group: string;
  title: string;
  description?: string;
  /** The menu path the row replaces: the search finds the new place by the old one */
  replaces?: string;
  editor: "switch" | "select" | "accent" | "file" | "button";
  source?: SettingsRowSource;
  /** The choices of a `select` (an `accent` takes the accents) */
  options?: SettingsOption[] | ((env: SettingsPlatform) => SettingsOption[]);
  buttons?: SettingsRowButton[];
  when?: SettingsRowCondition;
  /** The row is read-only while an IDE + Emulator recording runs, or while mouse capture is off */
  lockedWhen?: "windowRecording" | "videoRecording" | "mouseCaptureOff";
  /** The value a "Reset Page to Defaults" writes; registered settings take theirs */
  defaultValue?: SettingsOptionValue;
};

export type SettingsPlatform = { isWindows: boolean };

const opts = (pairs: [SettingsOptionValue, string][]): SettingsOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

const fontOptions = (env: SettingsPlatform): SettingsOption[] =>
  getMonospaceFontOptions(env.isWindows).map((f) => ({ value: f.id, label: f.label }));

const setting = (settingId: string): SettingsRowSource => ({ kind: "setting", settingId });
const state = (key: SettingsStateKey): SettingsRowSource => ({ kind: "state", key });

/** The Z88's keyboard layouts (the `SETTING_EMU_KEYBOARD_LAYOUT` values) */
export const Z88_KEYBOARD_LAYOUTS = opts([
  ["uk", "British & American"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["it", "Italian"],
  ["de", "German"],
  ["dk", "Danish & Norwegian"],
  ["se", "Swedish & Finnish"]
]);

/** The Z88's LCD sizes (the `MC_SCREEN_SIZE` values) */
export const Z88_LCD_OPTIONS = opts([
  ["640x64", "640 x 64"],
  ["640x256", "640 x 256"],
  ["640x320", "640 x 320"],
  ["640x480", "640 x 480"]
]);

/** Every row, in display order within each page */
export const SETTINGS_ROWS: SettingsRow[] = [
  // --- General
  {
    id: "openLastProject",
    page: "general",
    group: "Startup",
    title: "Open the last project at startup",
    editor: "switch",
    source: setting(SETTING_IDE_OPEN_LAST_PROJECT),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "closeEmu",
    page: "general",
    group: "Windows",
    title: "Close the emulator when the IDE is closed",
    editor: "switch",
    source: setting(SETTING_IDE_CLOSE_EMU),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "navRecordTabSwitch",
    page: "general",
    group: "Navigation",
    title: "Record tab switches in the navigation history",
    description: "Go Back and Go Forward also step through the tabs you switched between",
    editor: "switch",
    source: setting(SETTING_IDE_NAV_RECORD_TAB_SWITCH),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "excludedItems",
    page: "general",
    group: "Project",
    title: "Excluded items",
    description: "Files and folders the explorer and the build leave out",
    editor: "button",
    buttons: [{ label: "Manage...", action: "dialog:excluded-items", closesDialog: true }],
    when: { kind: "kliveProject" },
    replaces: "File › Manage Excluded Items"
  },

  {
    // --- `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D4, D7: user settings only, never a project's
    id: "automationEnabled",
    page: "general",
    group: "Automation",
    title: "Let scripts drive Klive",
    description:
      "A local channel for the klive ide command line and your own scripts. Any program running " +
      "as you can use it while this is on.",
    editor: "switch",
    source: state("automationEnabled"),
    defaultValue: false
  },
  {
    id: "automationLevel",
    page: "general",
    group: "Automation",
    title: "What scripts may do",
    description:
      "Read: state, memory and screenshots. Control: also run, pause, step, edit memory and " +
      "build. Full: also any IDE command, which can reach your files.",
    editor: "select",
    source: state("automationLevel"),
    options: opts([
      ["read", "Read"],
      ["control", "Control"],
      ["full", "Full"]
    ]),
    defaultValue: DEFAULT_AUTOMATION_LEVEL
  },

  // --- Appearance
  {
    id: "theme",
    page: "appearance",
    group: "Theme",
    title: "Tone",
    editor: "select",
    source: state("theme"),
    options: opts([
      ["dark", "Dark"],
      ["light", "Light"]
    ]),
    defaultValue: "dark",
    replaces: "View › Theme"
  },
  {
    id: "accent",
    page: "appearance",
    group: "Theme",
    title: "Accent",
    editor: "accent",
    source: state("accent"),
    options: ACCENT_MENU_ITEMS.map((a) => ({ value: a.id, label: a.label })),
    defaultValue: DEFAULT_ACCENT,
    replaces: "View › Theme"
  },
  {
    id: "panelFontFamily",
    page: "appearance",
    group: "Panels",
    title: "Panel font",
    description: "Memory, disassembly, registers and the other data panels",
    editor: "select",
    source: setting(SETTING_PANEL_FONT_FAMILY),
    options: fontOptions,
    replaces: "View › Panel Options › Font Family"
  },
  {
    id: "panelFontSize",
    page: "appearance",
    group: "Panels",
    title: "Panel font size",
    editor: "select",
    source: setting(SETTING_PANEL_FONT_SIZE),
    options: PANEL_FONT_SIZES.map((s) => ({ value: s.value, label: s.label })),
    replaces: "View › Panel Options › Font Size"
  },
  {
    id: "sidebarToRight",
    page: "appearance",
    group: "Layout",
    title: "Sidebar on the right",
    editor: "switch",
    source: setting(SETTING_IDE_SIDEBAR_TO_RIGHT),
    replaces: "View › Move the Sidebar to the Right"
  },
  {
    id: "toolsOnTop",
    page: "appearance",
    group: "Layout",
    title: "Command and Output on top",
    editor: "switch",
    source: setting(SETTING_IDE_TOOLS_ON_TOP),
    replaces: "View › Move Commands and Output to the top"
  },
  {
    id: "maximizeTools",
    page: "appearance",
    group: "Layout",
    title: "Maximize Command and Output",
    editor: "switch",
    source: setting(SETTING_IDE_MAXIMIZE_TOOLS),
    replaces: "View › Maximize Commands and Output"
  },

  // --- Editor
  {
    id: "editorFontFamily",
    page: "editor",
    group: "Text",
    title: "Font family",
    editor: "select",
    source: setting(SETTING_EDITOR_FONT_FAMILY),
    options: fontOptions,
    replaces: "View › Editor Options › Font Family"
  },
  {
    id: "editorFontSize",
    page: "editor",
    group: "Text",
    title: "Font size",
    editor: "select",
    source: setting(SETTING_EDITOR_FONT_SIZE),
    options: EDITOR_FONT_SIZES.map((s) => ({ value: s.value, label: s.label })),
    replaces: "View › Editor Options › Font Size"
  },
  {
    id: "renderWhitespace",
    page: "editor",
    group: "Text",
    title: "Render whitespace",
    editor: "select",
    source: setting(SETTING_EDITOR_RENDER_WHITESPACE),
    options: opts([
      ["none", "None"],
      ["boundary", "At line boundaries"],
      ["selection", "Inside the selection"],
      ["all", "All"]
    ]),
    replaces: "View › Editor Options › Render Whitespaces"
  },
  {
    id: "tabSize",
    page: "editor",
    group: "Indentation",
    title: "Tab size",
    editor: "select",
    source: setting(SETTING_EDITOR_TABSIZE),
    options: opts([
      [2, "2"],
      [4, "4"],
      [8, "8"],
      [16, "16"]
    ]),
    replaces: "View › Editor Options › Tab Size"
  },
  {
    id: "insertSpaces",
    page: "editor",
    group: "Indentation",
    title: "Insert spaces instead of tabs",
    editor: "switch",
    source: setting(SETTING_EDITOR_INSERT_SPACES),
    replaces: "View › Editor Options"
  },
  {
    id: "detectIndentation",
    page: "editor",
    group: "Indentation",
    title: "Detect indentation",
    editor: "switch",
    source: setting(SETTING_EDITOR_DETECT_INDENTATION),
    replaces: "View › Editor Options"
  },
  {
    id: "autocomplete",
    page: "editor",
    group: "Assistance",
    title: "Enable autocomplete",
    editor: "switch",
    source: setting(SETTING_EDITOR_AUTOCOMPLETE),
    replaces: "View › Editor Options"
  },
  {
    id: "quickSuggestionDelay",
    page: "editor",
    group: "Assistance",
    title: "Quick suggestion delay",
    editor: "select",
    source: setting(SETTING_EDITOR_QUICK_SUGGESTION_DELAY),
    options: opts([
      [10, "Instantaneous"],
      [100, "Short (100 ms)"],
      [200, "Medium (200 ms)"],
      [500, "Long (500 ms)"],
      [1000, "Longest (1 s)"]
    ]),
    replaces: "View › Editor Options › Quick Suggestion Delay"
  },
  {
    id: "selectionHighlight",
    page: "editor",
    group: "Assistance",
    title: "Highlight the selection's other occurrences",
    editor: "switch",
    source: setting(SETTING_EDITOR_SELECTION_HIGHLIGHT),
    replaces: "View › Editor Options"
  },
  {
    id: "occurrencesHighlight",
    page: "editor",
    group: "Assistance",
    title: "Highlight the symbol's occurrences",
    editor: "switch",
    source: setting(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT),
    replaces: "View › Editor Options"
  },
  {
    id: "backgroundCompile",
    page: "editor",
    group: "Assistance",
    title: "Compile in the background",
    description: "Errors appear while you type",
    editor: "switch",
    source: setting(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE),
    replaces: "View › Editor Options"
  },

  // --- Emulator
  {
    id: "zoomStep",
    page: "emulator",
    group: "Screen",
    title: "Zoom steps",
    description: "The screen fits its window, snapped down to this step",
    editor: "select",
    source: setting(SETTING_EMU_ZOOM_STEP),
    options: ZOOM_STEPS.map((s) => ({ value: s.value, label: s.label })),
    replaces: "View › Screen Zoom Steps"
  },
  {
    id: "scanlineEffect",
    page: "emulator",
    group: "Screen",
    title: "Scanline effect",
    editor: "select",
    source: setting(SETTING_EMU_SCANLINE_EFFECT),
    options: opts([
      ["off", "Off"],
      ["50%", "50%"],
      ["25%", "25%"],
      ["12.5%", "12.5%"]
    ]),
    replaces: "Machine › Scanline Effect"
  },
  {
    id: "instantScreen",
    page: "emulator",
    group: "Screen",
    title: "Show the instant screen",
    description: "Also on the emulator toolbar",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_INSTANT_SCREEN),
    replaces: "View › Show the Instant Screen"
  },
  {
    id: "beamPosition",
    page: "emulator",
    group: "Screen",
    title: "Show the beam position while paused",
    description: "Also on the emulator toolbar",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_BEAM_POSITION),
    replaces: "View › Show the Beam Position",
    // --- Only machines with a raster beam: not the Z88's LCD, the ZX80/81 or the C64
    when: { kind: "machine", machineIds: BEAM_POSITION_MACHINE_IDS }
  },
  {
    id: "stayOnTop",
    page: "emulator",
    group: "Window",
    title: "Keep the emulator on top",
    description: "Also the pin on the emulator toolbar",
    editor: "switch",
    source: setting(SETTING_EMU_STAY_ON_TOP),
    replaces: "View › Keep Emulator on Top"
  },
  {
    id: "performanceInfo",
    page: "emulator",
    group: "Status bar",
    title: "Show performance info",
    description: "Also: right-click the status bar",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_PERFORMANCE_INFO),
    replaces: "View › Show Performance Info in the Status Bar"
  },
  {
    id: "mediaInfo",
    page: "emulator",
    group: "Status bar",
    title: "Show media information",
    description: "The tape and disk strip of the Spectrum models",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_MEDIA_INFO),
    replaces: "View › Show Media Information"
  },
  {
    id: "nextLayers",
    page: "emulator",
    group: "Status bar",
    title: "Show the Layers strip",
    description: "ZX Spectrum Next: show, solo and probe the layers",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_NEXT_LAYERS),
    replaces: "View › Show Layers; Machine › Layers"
  },
  {
    id: "fastLoad",
    page: "emulator",
    group: "Tape",
    title: "Fast load",
    description: "Also in Machine › Tape and on the emulator toolbar",
    editor: "switch",
    source: setting(SETTING_EMU_FAST_LOAD)
  },

  // --- Debugging
  {
    id: "stepInInterrupts",
    page: "debugging",
    group: "Stepping",
    title: "Stop in interrupt handlers while stepping",
    editor: "switch",
    source: setting(SETTING_EMU_STEP_IN_INTERRUPTS)
  },
  {
    id: "justMyCode",
    page: "debugging",
    group: "Stepping",
    title: "Just My Code",
    description: "Step over code that has no source",
    editor: "switch",
    source: setting(SETTING_EMU_JUST_MY_CODE)
  },
  {
    id: "stopOnErrors",
    page: "debugging",
    group: "Breakpoints",
    title: "Stop at runtime errors",
    editor: "switch",
    source: setting(SETTING_EMU_STOP_ON_ERRORS)
  },
  {
    id: "syncBreakpoints",
    page: "debugging",
    group: "Breakpoints",
    title: "Sync the source with the current breakpoint",
    description: "Also in the Debug menu and on the IDE toolbar",
    editor: "switch",
    source: setting(SETTING_IDE_SYNC_BREAKPOINTS),
    replaces: "View › Sync the Source with the Current Breakpoint"
  },
  {
    id: "groupBreakpoints",
    page: "debugging",
    group: "Breakpoints",
    title: "Group breakpoints by kind",
    editor: "switch",
    source: setting(SETTING_IDE_BP_GROUP_BY_KIND)
  },
  // --- Full reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` D2, D6)
  {
    id: "reverseDebugging",
    page: "debugging",
    group: "Reverse debugging",
    title: "Reverse debugging",
    description: "Step back with the whole machine in the past; takes effect at the next debug session",
    editor: "switch",
    source: setting(SETTING_EMU_REVERSE_DEBUGGING),
    when: { kind: "advancedDebugging" }
  },
  {
    id: "reverseDebugMemory",
    page: "debugging",
    group: "Reverse debugging",
    title: "Memory for the reverse-debugging timeline",
    description: "More memory reaches further back. Automatic: 512 MB or 1/16 of the computer's memory",
    editor: "select",
    source: setting(SETTING_EMU_REVERSE_DEBUG_MEMORY_MB),
    when: { kind: "advancedDebugging" },
    options: opts([
      [0, "Automatic"],
      [128, "128 MB"],
      [256, "256 MB"],
      [512, "512 MB"],
      [1024, "1 GB"],
      [2048, "2 GB"]
    ])
  },

  // --- Code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.3)
  {
    id: "profileResetOnStart",
    page: "debugging",
    group: "Coverage and profiling",
    title: "Clear coverage when the machine starts",
    description: "Coverage and the heat map start over when the machine starts from Stopped",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_RESET_ON_START),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profileResetAfterInjection",
    page: "debugging",
    group: "Coverage and profiling",
    title: "Clear coverage after code injection",
    description: "The ROM's boot to the injection point does not show as covered",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_RESET_AFTER_INJECTION),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profileCounters",
    page: "debugging",
    group: "Coverage and profiling",
    title: "Count executions, reads and writes",
    description: "Off: only whether each byte was executed, read or written, which costs less",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_COUNTERS),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "coverageLineTint",
    page: "debugging",
    group: "Coverage and profiling",
    title: "Tint covered source lines",
    description: "A tinted background as well as the coverage strip",
    editor: "switch",
    source: setting(SETTING_IDE_COVERAGE_LINE_TINT),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profilerInlays",
    page: "debugging",
    group: "Coverage and profiling",
    title: "Profile hints in the editor",
    description: "Each routine's first line shows its share of the time and its calls",
    editor: "switch",
    source: setting(SETTING_IDE_PROFILER_INLAYS),
    when: { kind: "feature", feature: MF_PROFILE }
  },

  // --- Machine: only the running machine's rows show
  {
    id: "sp48Rom",
    page: "machine",
    group: "ROM",
    title: "ZX Spectrum 48K ROM",
    description: "Empty: the built-in ROM. Changing it restarts the machine",
    editor: "file",
    source: state("sp48Rom"),
    buttons: [
      { label: "Browse...", action: "rom:sp48:select" },
      { label: "Reset", action: "rom:sp48:reset", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_SPECTRUM_48] },
    replaces: "Machine › Select ROM File; Machine › Reset to Default ROM"
  },
  {
    id: "trdosRom",
    page: "machine",
    group: "ROM",
    title: "TR-DOS ROM",
    description: "The disks stay off without it. Changing it restarts the machine",
    editor: "file",
    source: setting(SETTING_EMU_TRDOS_ROM),
    buttons: [
      { label: "Browse...", action: "rom:trdos:select" },
      { label: "Forget", action: "rom:trdos:forget", needsValue: true }
    ],
    when: { kind: "beta128" },
    replaces: "Machine › TR-DOS ROM"
  },
  {
    id: "scorpionRom",
    page: "machine",
    group: "ROM",
    title: "Scorpion ZS-256 ROM",
    description: "Empty: the 128K ROMs boot. Changing it restarts the machine",
    editor: "file",
    source: setting(SETTING_EMU_SCORPION_ROM),
    buttons: [
      { label: "Browse...", action: "rom:scorpion:select" },
      { label: "Forget", action: "rom:scorpion:forget", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_SCORPION] },
    replaces: "Machine › Scorpion ROM"
  },
  {
    id: "timexRom",
    page: "machine",
    group: "ROM",
    title: "Timex ROM",
    description: "Empty: the 48K ROM boots. Changing it restarts the machine",
    editor: "file",
    // --- The model's own setting: resolved by `timexRomSettingIdOf`
    source: setting(SETTING_EMU_TC2048_ROM),
    buttons: [
      { label: "Browse...", action: "rom:timex:select" },
      { label: "Forget", action: "rom:timex:forget", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_TIMEX] },
    replaces: "Machine › TC2048 / TC2068 / TS2068 ROM"
  },
  {
    id: "z88KeyboardLayout",
    page: "machine",
    group: "Cambridge Z88",
    title: "Keyboard layout",
    editor: "select",
    source: setting(SETTING_EMU_KEYBOARD_LAYOUT),
    options: Z88_KEYBOARD_LAYOUTS,
    when: { kind: "machine", machineIds: [MI_Z88] },
    replaces: "Machine › Keyboard layout"
  },
  {
    id: "z88Lcd",
    page: "machine",
    group: "Cambridge Z88",
    title: "LCD resolution",
    description: "Changing it restarts the machine",
    editor: "select",
    source: state("z88Lcd"),
    options: Z88_LCD_OPTIONS,
    defaultValue: "640x64",
    when: { kind: "machine", machineIds: [MI_Z88] },
    replaces: "Machine › LCD resolution"
  },

  // --- Input
  {
    id: "keyMapping",
    page: "input",
    group: "Keyboard",
    title: "Key mapping file",
    description: "Maps host keys to the machine's keys",
    editor: "file",
    source: state("keyMappingFile"),
    buttons: [
      { label: "Browse...", action: "keymap:select" },
      { label: "Reset", action: "keymap:reset", needsValue: true }
    ],
    replaces: "Machine › Select Key Mapping; Machine › Reset Key Mapping"
  },
  {
    id: "joystickBindings",
    page: "input",
    group: "Joysticks",
    title: "Joystick bindings",
    description: "The host keys and gamepad buttons the joysticks read",
    editor: "button",
    buttons: [{ label: "Configure...", action: "dialog:joystick-bindings", closesDialog: true }],
    when: { kind: "machine", machineIds: [MI_ZXNEXT, MI_TIMEX] },
    replaces: "Machine › Joystick › Configure bindings"
  },
  {
    id: "mouseCapture",
    page: "input",
    group: "Mouse",
    title: "Capture the mouse",
    description: "The toolbar button or Ctrl+M then captures it",
    editor: "switch",
    source: setting(SETTING_EMU_MOUSE_CAPTURE),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    replaces: "Machine › Mouse › Capture the mouse"
  },
  {
    id: "mousePointer",
    page: "input",
    group: "Mouse",
    title: "Show the captured pointer",
    editor: "select",
    source: setting(SETTING_EMU_MOUSE_SHOW_POINTER),
    options: MOUSE_POINTER_DISPLAYS.map((o) => ({ value: o.value, label: o.label })),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    lockedWhen: "mouseCaptureOff",
    replaces: "Machine › Mouse › Show the captured pointer"
  },
  {
    id: "mouseSensitivity",
    page: "input",
    group: "Mouse",
    title: "Sensitivity",
    editor: "select",
    source: setting(SETTING_EMU_MOUSE_SENSITIVITY),
    options: MOUSE_SENSITIVITIES.map((o) => ({ value: o.value, label: o.label })),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    lockedWhen: "mouseCaptureOff",
    replaces: "Machine › Mouse › Sensitivity"
  },

  // --- Recording
  {
    id: "recordingFormat",
    page: "recording",
    group: "Video recording",
    title: "Format",
    editor: "select",
    source: state("recordingFormat"),
    options: opts([
      ["mp4", "MP4 (H.264): universal, small files"],
      ["webm", "WebM (VP9): best for web sharing"],
      ["mkv", "MKV (H.265): best compression"]
    ]),
    defaultValue: "mp4",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › Format"
  },
  {
    id: "recordingQuality",
    page: "recording",
    group: "Video recording",
    title: "Quality",
    editor: "select",
    source: state("recordingQuality"),
    options: opts([
      ["good", "Best compression"],
      ["high", "High"],
      ["lossless", "Highest (lossless)"]
    ]),
    defaultValue: "good",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › quality"
  },
  {
    id: "recordingFps",
    page: "recording",
    group: "Video recording",
    title: "Frame rate",
    editor: "select",
    source: state("recordingFps"),
    options: opts([
      ["native", "The machine's own"],
      ["half", "Half"]
    ]),
    defaultValue: "native",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › Half fps"
  },
  {
    id: "windowRecordingIdePosition",
    page: "recording",
    group: "IDE + Emulator recording",
    title: "IDE position",
    editor: "select",
    source: state("windowRecordingIdePosition"),
    options: opts([
      ["left", "Left"],
      ["right", "Right"],
      ["top", "Top"],
      ["bottom", "Bottom"]
    ]),
    defaultValue: "left",
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › IDE position"
  },
  {
    id: "windowRecordingPointer",
    page: "recording",
    group: "IDE + Emulator recording",
    title: "Include the pointer",
    editor: "switch",
    source: state("windowRecordingPointer"),
    defaultValue: true,
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › Include pointer"
  },
  {
    id: "windowRecordingClicks",
    page: "recording",
    group: "IDE + Emulator recording",
    title: "Show mouse clicks",
    editor: "switch",
    source: state("windowRecordingClicks"),
    defaultValue: true,
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › Show mouse clicks"
  },
  {
    id: "windowRecordingHiDpi",
    page: "recording",
    group: "IDE + Emulator recording",
    title: "Full resolution (HiDPI)",
    editor: "switch",
    source: state("windowRecordingHiDpi"),
    defaultValue: false,
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › Full resolution (HiDPI)"
  },

  // --- Integrations
  {
    id: "sjasmplus",
    page: "integrations",
    group: "Assemblers",
    title: "SjasmPlus",
    description: "The executable, its options and the build integration",
    editor: "button",
    buttons: [{ label: "Configure...", action: "dialog:sjasmplus", closesDialog: true }],
    replaces: "IDE › Integrations › SjasmPlus Assembler"
  }
];

/** The setting that holds the running Timex model's ROM */
export function timexRomSettingIdOf(appState: AppState | undefined): string {
  const ids: Record<TimexModelId, string> = {
    tc2048: SETTING_EMU_TC2048_ROM,
    tc2068: SETTING_EMU_TC2068_ROM,
    ts2068: SETTING_EMU_TS2068_ROM
  };
  return ids[getTimexModel(appState?.emulatorState?.config).id];
}

/** The registered setting a row reads, after resolving the model-dependent ones */
export function settingIdOf(row: SettingsRow, appState: AppState | undefined): string | undefined {
  if (row.source?.kind !== "setting") return undefined;
  return row.id === "timexRom" ? timexRomSettingIdOf(appState) : row.source.settingId;
}

function readSetting(appState: AppState | undefined, settingId: string): unknown {
  const definition = KliveGlobalSettings[settingId];
  const stored = settingId
    .split(".")
    .reduce<any>((node, key) => (node == null ? undefined : node[key]), appState?.globalSettings);
  return stored === undefined ? definition?.defaultValue : stored;
}

/** What a row shows now */
export function readSettingsRowValue(row: SettingsRow, appState: AppState | undefined): unknown {
  if (!row.source) return undefined;
  if (row.source.kind === "setting") return readSetting(appState, settingIdOf(row, appState));
  const emu = appState?.emulatorState;
  switch (row.source.key) {
    case "theme":
      return appState?.theme ?? "dark";
    case "accent":
      return appState?.accent ?? DEFAULT_ACCENT;
    case "z88Lcd":
      return emu?.config?.[MC_SCREEN_SIZE] ?? "640x64";
    case "recordingFps":
      return emu?.screenRecordingFps ?? "native";
    case "recordingQuality":
      return emu?.screenRecordingQuality ?? "good";
    case "recordingFormat":
      return emu?.screenRecordingFormat ?? "mp4";
    case "windowRecordingIdePosition":
      return emu?.windowRecordingIdePosition ?? "left";
    case "windowRecordingPointer":
      return emu?.windowRecordingPointer ?? true;
    case "windowRecordingClicks":
      return emu?.windowRecordingClicks ?? true;
    case "windowRecordingHiDpi":
      return emu?.windowRecordingHiDpi ?? false;
    case "sp48Rom":
      return emu?.config?.[MC_SP48_ROM_FILE] ?? "";
    case "keyMappingFile":
      return appState?.keyMappingFile ?? "";
    case "automationEnabled":
      return parseAutomationSwitch(appState?.userSettings?.automation?.enabled);
    case "automationLevel":
      return parseAutomationLevel(appState?.userSettings?.automation?.level);
    default:
      return undefined;
  }
}

/** The value "Reset Page to Defaults" writes; undefined for a row it leaves alone */
export function settingsRowDefault(row: SettingsRow, appState: AppState | undefined): unknown {
  if (row.source?.kind === "setting") {
    return KliveGlobalSettings[settingIdOf(row, appState)]?.defaultValue;
  }
  return row.defaultValue;
}

/** Does a row apply to the running machine and the open project? */
export function isSettingsRowApplicable(row: SettingsRow, appState: AppState | undefined): boolean {
  const when = row.when;
  if (!when) return true;
  const machineId = appState?.emulatorState?.machineId;
  switch (when.kind) {
    case "machine":
      return !!machineId && when.machineIds.includes(machineId);
    case "beta128": {
      if (machineId !== MI_SPECTRUM_128 && machineId !== MI_SCORPION) return false;
      const machine = machineRegistry.find((m) => m.machineId === machineId);
      const model = machine?.models?.find((m) => m.modelId === appState?.emulatorState?.modelId);
      return (model?.config?.[MC_DISK_SUPPORT] ?? 0) > 0;
    }
    case "kliveProject":
      return !!appState?.project?.isKliveProject;
    case "advancedDebugging":
      return isAdvancedDebuggingEnabled(appState);
    case "feature":
      return hasMachineFeature(
        machineRegistry.find((m) => m.machineId === machineId),
        when.feature,
        appState
      );
    default:
      return true;
  }
}

/** Is a row read-only now? */
export function isSettingsRowLocked(row: SettingsRow, appState: AppState | undefined): boolean {
  const emu = appState?.emulatorState;
  switch (row.lockedWhen) {
    case "windowRecording":
      return emu?.windowRecordingState === "recording";
    case "videoRecording":
      return !!emu?.screenRecordingState && emu.screenRecordingState !== "idle";
    case "mouseCaptureOff":
      return !readSetting(appState, SETTING_EMU_MOUSE_CAPTURE);
    default:
      return false;
  }
}

/** The choices of a select or accent row */
export function settingsRowOptions(row: SettingsRow, platform: SettingsPlatform): SettingsOption[] {
  const options = row.options;
  return typeof options === "function" ? options(platform) : (options ?? []);
}

/** Does a row match a search? Title, description, group, page and the old menu path all count */
export function settingsRowMatches(row: SettingsRow, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const page = SETTINGS_PAGES.find((p) => p.id === row.page)?.title ?? "";
  const text = [row.title, row.description, row.group, page, row.replaces]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}
