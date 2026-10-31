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
import { t } from "@common/i18n/i18n";
import { SOURCE_CATALOG } from "@common/i18n/catalogs";
import { labelled } from "@common/i18n/labels";
import { TRANSLATION_STATUS } from "@common/i18n/translations.generated";
import type { MessageKey } from "@common/i18n/keys.generated";
import {
  LANGUAGE_SYSTEM,
  languageInfo,
  selectableLanguages,
  type UiLanguageState
} from "@common/i18n/languages";
import { MOUSE_POINTER_DISPLAYS, MOUSE_SENSITIVITIES } from "./mouse-capture";
import { NEXT_AUDIO_OUTPUTS } from "./next-audio-output";
import { ACCENT_MENU_ITEMS, DEFAULT_ACCENT } from "@common/theming/accents";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  DEFAULT_AUTOMATION_LEVEL,
  parseAutomationLevel,
  parseAutomationSwitch
} from "@common/automation/protocol";
import {
  BEAM_POSITION_MACHINE_IDS,
  TV_NOISE_MACHINE_IDS,
  ULA_TIMING_MACHINE_IDS,
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
import { isDivMmcMachine } from "@common/machines/divMmc";
import { hasInterface1 } from "@common/machines/interface1";
import { getTimexModel, type TimexModelId } from "@emu/machines/timex/timexModels";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { BORIEL_INSTALL_FOLDER } from "@main/boriel-integration/boriel-config";
import {
  Z88DK_CLIB,
  Z88DK_COMPILER,
  Z88DK_INSTALL_FOLDER,
  Z88DK_OPTIMISE
} from "@main/z88dk-integration/z88dk-config";
import { selectedZxBasicCompiler, ZXBC_EXECUTABLE_PATH } from "@main/zxb-integration/zxb-config";
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
  SETTING_EMU_TV_NOISE,
  SETTING_EMU_ULA_LATE_TIMING,
  SETTING_EMU_ULA_SNOW,
  SETTING_EMU_NEXT_AUDIO_OUTPUT,
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
  SETTING_EMU_ESXDOS_ROM,
  SETTING_EMU_IF1_ROM,
  SETTING_EMU_TS2068_ROM,
  SETTING_EMU_ZOOM_STEP,
  SETTING_IDE_BP_GROUP_BY_KIND,
  SETTING_IDE_CLOSE_EMU,
  SETTING_IDE_I18N_SHOW_KEYS,
  SETTING_IDE_LANGUAGE,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_NAV_RECORD_TAB_SWITCH,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_TOOLS_ON_TOP,
  SETTING_FM_SHOW_HIDDEN,
  SETTING_FM_DELETE_PERMANENTLY,
  SETTING_PANEL_FONT_FAMILY,
  SETTING_PANEL_FONT_SIZE
} from "./setting-const";

/**
 * The pages, in display order. `titleKey` is what the dialog shows; `title` stays as the page's
 * English name, which the search matches too and tests and docs refer to
 * (`.plans/LOCALIZATION_PLAN.md` D7: keys at definition, text at display).
 */
export const SETTINGS_PAGES = [
  { id: "general", title: "General", titleKey: "settings.page.general" },
  { id: "language", title: "Language", titleKey: "settings.page.language" },
  { id: "appearance", title: "Appearance", titleKey: "settings.page.appearance" },
  { id: "editor", title: "Editor", titleKey: "settings.page.editor" },
  { id: "emulator", title: "Emulator", titleKey: "settings.page.emulator" },
  { id: "debugging", title: "Debugging", titleKey: "settings.page.debugging" },
  { id: "machine", title: "Machine", titleKey: "settings.page.machine" },
  { id: "input", title: "Input", titleKey: "settings.page.input" },
  { id: "recording", title: "Recording", titleKey: "settings.page.recording" },
  { id: "integrations", title: "Integrations", titleKey: "settings.page.integrations" }
] as const satisfies readonly { id: string; title: string; titleKey: MessageKey }[];

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
  | "automationLevel"
  | "basicCompiler"
  | "borielInstallation"
  | "z88dkInstallation"
  | "z88dkCompiler"
  | "z88dkClib"
  | "z88dkOptimise";

export type SettingsRowSource =
  | { kind: "setting"; settingId: string }
  | { kind: "state"; key: SettingsStateKey };

export type SettingsOptionValue = string | number | boolean;

/** `label` is the current language's text (often a getter that translates each time it is read) */
export type SettingsOption = { readonly label: string; value: SettingsOptionValue };

export type SettingsRowButton = {
  labelKey: MessageKey;
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
  /** A machine that can have a DivMMC: the 48K, the 128K (not the Pentagon), the +2A/+3/+2E/+3E */
  | { kind: "divMmc" }
  /** A machine with the Interface 1 connected (`MC_INTERFACE1`, MICRODRIVE_PLAN) */
  | { kind: "interface1" }
  | { kind: "kliveProject" }
  /** The advanced-debugging feature switch is on (`@common/features/advancedDebugging`) */
  | { kind: "advancedDebugging" }
  /**
   * The running machine has a feature, as `hasMachineFeature` answers (so a feature of the
   * advanced-debugging group also needs the switch): the coverage rows key on `MF_PROFILE`
   */
  | { kind: "feature"; feature: string }
  /** A dev build (the pseudo-locale and the show-keys switch, `.plans/LOCALIZATION_PLAN.md` §7) */
  | { kind: "i18nDevTools" };

export type SettingsRow = {
  id: string;
  page: SettingsPageId;
  /**
   * Translation keys (`.plans/LOCALIZATION_PLAN.md` D7); read the texts through `settingsRowGroup`,
   * `settingsRowTitle` and `settingsRowDescription`. English lives in `en/settings.json`.
   */
  groupKey: MessageKey;
  titleKey: MessageKey;
  descriptionKey?: MessageKey;
  /** A help text computed when shown; wins over `descriptionKey` when it returns one */
  describe?: (env: SettingsPlatform) => string | undefined;
  /**
   * The menu path the row replaces: the search finds the new place by the old one. English on
   * purpose: it names the old menus, which were English.
   */
  replaces?: string;
  editor: "switch" | "select" | "accent" | "file" | "button";
  source?: SettingsRowSource;
  /**
   * The choices of a `select` (an `accent` takes the accents). A function when the labels come from
   * a shared table, so they are read in the current language each time.
   */
  options?: SettingsOption[] | ((env: SettingsPlatform) => SettingsOption[]);
  buttons?: SettingsRowButton[];
  when?: SettingsRowCondition;
  /** The row is read-only while an IDE + Emulator recording runs, or while mouse capture is off */
  lockedWhen?: "windowRecording" | "videoRecording" | "mouseCaptureOff";
  /** The value a "Reset Page to Defaults" writes; registered settings take theirs */
  defaultValue?: SettingsOptionValue;
};

export type SettingsPlatform = {
  isWindows: boolean;
  /** The display language main published; the Language page's choices depend on it */
  uiLanguage?: UiLanguageState;
};

/**
 * The display-language choices: "System default (<what it resolves to>)" first, then each offered
 * language in its own name (never translated, so a user stuck in a language they cannot read still
 * finds theirs).
 */
export function languageOptions(env: SettingsPlatform): SettingsOption[] {
  const devTools = !!env.uiLanguage?.devTools;
  const system = languageInfo(env.uiLanguage?.system ?? "en")?.nativeName ?? "English";
  return [
    { value: LANGUAGE_SYSTEM, label: t("settings.language.systemDefault", { language: system }) },
    ...selectableLanguages(devTools).map((l) => ({ value: l.id, label: l.nativeName }))
  ];
}

/** A label shown as it is in every language: numbers, sizes, product names */
type Literal = { literal: string };
const lit = (text: string): Literal => ({ literal: text });

/** Choices from `[value, translation key | lit(text)]` pairs */
const opts = (pairs: [SettingsOptionValue, MessageKey | Literal][]): SettingsOption[] =>
  pairs.map(([value, label]) =>
    typeof label === "string" ? labelled({ value, labelKey: label }) : { value, label: label.literal }
  );

/** Choices from a shared table whose `label` translates when read */
const tableOptions =
  (table: () => readonly { value: SettingsOptionValue; label: string }[]) => (): SettingsOption[] =>
    table().map((o) => ({ value: o.value, label: o.label }));

const fontOptions = (env: SettingsPlatform): SettingsOption[] =>
  getMonospaceFontOptions(env.isWindows).map((f) => ({ value: f.id, label: f.label }));

const setting = (settingId: string): SettingsRowSource => ({ kind: "setting", settingId });
const state = (key: SettingsStateKey): SettingsRowSource => ({ kind: "state", key });

/** The Z88's keyboard layouts (the `SETTING_EMU_KEYBOARD_LAYOUT` values) */
export const Z88_KEYBOARD_LAYOUTS = opts([
  ["uk", "settings.machine.z88KeyboardLayout.option.uk"],
  ["es", "settings.machine.z88KeyboardLayout.option.es"],
  ["fr", "settings.machine.z88KeyboardLayout.option.fr"],
  ["it", "settings.machine.z88KeyboardLayout.option.it"],
  ["de", "settings.machine.z88KeyboardLayout.option.de"],
  ["dk", "settings.machine.z88KeyboardLayout.option.dk"],
  ["se", "settings.machine.z88KeyboardLayout.option.se"]
]);

/** The Z88's LCD sizes (the `MC_SCREEN_SIZE` values) */
export const Z88_LCD_OPTIONS = opts([
  ["640x64", lit("640 x 64")],
  ["640x256", lit("640 x 256")],
  ["640x320", lit("640 x 320")],
  ["640x480", lit("640 x 480")]
]);

/** Every row, in display order within each page */
export const SETTINGS_ROWS: SettingsRow[] = [
  // --- General
  {
    id: "openLastProject",
    page: "general",
    groupKey: "settings.group.startup",
    titleKey: "settings.general.openLastProject.title",
    editor: "switch",
    source: setting(SETTING_IDE_OPEN_LAST_PROJECT),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "closeEmu",
    page: "general",
    groupKey: "settings.group.windows",
    titleKey: "settings.general.closeEmu.title",
    editor: "switch",
    source: setting(SETTING_IDE_CLOSE_EMU),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "navRecordTabSwitch",
    page: "general",
    groupKey: "settings.group.navigation",
    titleKey: "settings.general.navRecordTabSwitch.title",
    descriptionKey: "settings.general.navRecordTabSwitch.description",
    editor: "switch",
    source: setting(SETTING_IDE_NAV_RECORD_TAB_SWITCH),
    replaces: "IDE › IDE Settings"
  },
  {
    id: "excludedItems",
    page: "general",
    groupKey: "settings.group.project",
    titleKey: "settings.general.excludedItems.title",
    descriptionKey: "settings.general.excludedItems.description",
    editor: "button",
    buttons: [{ labelKey: "settings.button.manage", action: "dialog:excluded-items", closesDialog: true }],
    when: { kind: "kliveProject" },
    replaces: "File › Manage Excluded Items"
  },

  {
    // --- `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D4, D7: user settings only, never a project's
    id: "automationEnabled",
    page: "general",
    groupKey: "settings.group.automation",
    titleKey: "settings.general.automationEnabled.title",
    descriptionKey: "settings.general.automationEnabled.description",
    editor: "switch",
    source: state("automationEnabled"),
    defaultValue: false
  },
  {
    id: "automationLevel",
    page: "general",
    groupKey: "settings.group.automation",
    titleKey: "settings.general.automationLevel.title",
    descriptionKey: "settings.general.automationLevel.description",
    editor: "select",
    source: state("automationLevel"),
    options: opts([
      ["read", "settings.general.automationLevel.option.read"],
      ["control", "settings.general.automationLevel.option.control"],
      ["full", "settings.general.automationLevel.option.full"]
    ]),
    defaultValue: DEFAULT_AUTOMATION_LEVEL
  },

  // --- Language (`.plans/LOCALIZATION_PLAN.md` §7)
  // --- The File Manager (`.plans/FILE_MANAGER_PLAN.md` D7)
  {
    id: "fileManagerShowHidden",
    page: "general",
    groupKey: "settings.group.fileManager",
    titleKey: "settings.general.fileManagerShowHidden.title",
    editor: "switch",
    source: setting(SETTING_FM_SHOW_HIDDEN)
  },
  {
    id: "fileManagerDeletePermanently",
    page: "general",
    groupKey: "settings.group.fileManager",
    titleKey: "settings.general.fileManagerDeletePermanently.title",
    descriptionKey: "settings.general.fileManagerDeletePermanently.description",
    editor: "switch",
    source: setting(SETTING_FM_DELETE_PERMANENTLY)
  },
  {
    id: "displayLanguage",
    page: "language",
    groupKey: "settings.language.group",
    titleKey: "settings.language.display.title",
    descriptionKey: "settings.language.display.description",
    editor: "select",
    source: setting(SETTING_IDE_LANGUAGE),
    options: languageOptions
  },
  {
    id: "translationStatus",
    page: "language",
    groupKey: "settings.language.group",
    titleKey: "settings.language.help.title",
    descriptionKey: "settings.language.help.description",
    describe: translationStatusText,
    editor: "button",
    buttons: [{ labelKey: "settings.button.helpTranslate", action: "open:translation-guide" }]
  },
  {
    id: "i18nShowKeys",
    page: "language",
    groupKey: "settings.language.devGroup",
    titleKey: "settings.language.showKeys.title",
    descriptionKey: "settings.language.showKeys.description",
    editor: "switch",
    source: setting(SETTING_IDE_I18N_SHOW_KEYS),
    when: { kind: "i18nDevTools" }
  },

  // --- Appearance
  {
    id: "theme",
    page: "appearance",
    groupKey: "settings.group.theme",
    titleKey: "settings.appearance.theme.title",
    editor: "select",
    source: state("theme"),
    options: opts([
      ["dark", "settings.appearance.theme.option.dark"],
      ["light", "settings.appearance.theme.option.light"]
    ]),
    defaultValue: "dark",
    replaces: "View › Theme"
  },
  {
    id: "accent",
    page: "appearance",
    groupKey: "settings.group.theme",
    titleKey: "settings.appearance.accent.title",
    editor: "accent",
    source: state("accent"),
    options: tableOptions(() => ACCENT_MENU_ITEMS.map((a) => ({ value: a.id, label: a.label }))),
    defaultValue: DEFAULT_ACCENT,
    replaces: "View › Theme"
  },
  {
    id: "panelFontFamily",
    page: "appearance",
    groupKey: "settings.group.panels",
    titleKey: "settings.appearance.panelFontFamily.title",
    descriptionKey: "settings.appearance.panelFontFamily.description",
    editor: "select",
    source: setting(SETTING_PANEL_FONT_FAMILY),
    options: fontOptions,
    replaces: "View › Panel Options › Font Family"
  },
  {
    id: "panelFontSize",
    page: "appearance",
    groupKey: "settings.group.panels",
    titleKey: "settings.appearance.panelFontSize.title",
    editor: "select",
    source: setting(SETTING_PANEL_FONT_SIZE),
    options: tableOptions(() => PANEL_FONT_SIZES),
    replaces: "View › Panel Options › Font Size"
  },
  {
    id: "sidebarToRight",
    page: "appearance",
    groupKey: "settings.group.layout",
    titleKey: "settings.appearance.sidebarToRight.title",
    editor: "switch",
    source: setting(SETTING_IDE_SIDEBAR_TO_RIGHT),
    replaces: "View › Move the Sidebar to the Right"
  },
  {
    id: "toolsOnTop",
    page: "appearance",
    groupKey: "settings.group.layout",
    titleKey: "settings.appearance.toolsOnTop.title",
    editor: "switch",
    source: setting(SETTING_IDE_TOOLS_ON_TOP),
    replaces: "View › Move Commands and Output to the top"
  },
  {
    id: "maximizeTools",
    page: "appearance",
    groupKey: "settings.group.layout",
    titleKey: "settings.appearance.maximizeTools.title",
    editor: "switch",
    source: setting(SETTING_IDE_MAXIMIZE_TOOLS),
    replaces: "View › Maximize Commands and Output"
  },

  // --- Editor
  {
    id: "editorFontFamily",
    page: "editor",
    groupKey: "settings.group.text",
    titleKey: "settings.editor.editorFontFamily.title",
    editor: "select",
    source: setting(SETTING_EDITOR_FONT_FAMILY),
    options: fontOptions,
    replaces: "View › Editor Options › Font Family"
  },
  {
    id: "editorFontSize",
    page: "editor",
    groupKey: "settings.group.text",
    titleKey: "settings.editor.editorFontSize.title",
    editor: "select",
    source: setting(SETTING_EDITOR_FONT_SIZE),
    options: tableOptions(() => EDITOR_FONT_SIZES),
    replaces: "View › Editor Options › Font Size"
  },
  {
    id: "renderWhitespace",
    page: "editor",
    groupKey: "settings.group.text",
    titleKey: "settings.editor.renderWhitespace.title",
    editor: "select",
    source: setting(SETTING_EDITOR_RENDER_WHITESPACE),
    options: opts([
      ["none", "settings.editor.renderWhitespace.option.none"],
      ["boundary", "settings.editor.renderWhitespace.option.boundary"],
      ["selection", "settings.editor.renderWhitespace.option.selection"],
      ["all", "settings.editor.renderWhitespace.option.all"]
    ]),
    replaces: "View › Editor Options › Render Whitespaces"
  },
  {
    id: "tabSize",
    page: "editor",
    groupKey: "settings.group.indentation",
    titleKey: "settings.editor.tabSize.title",
    editor: "select",
    source: setting(SETTING_EDITOR_TABSIZE),
    options: opts([
      [2, lit("2")],
      [4, lit("4")],
      [8, lit("8")],
      [16, lit("16")]
    ]),
    replaces: "View › Editor Options › Tab Size"
  },
  {
    id: "insertSpaces",
    page: "editor",
    groupKey: "settings.group.indentation",
    titleKey: "settings.editor.insertSpaces.title",
    editor: "switch",
    source: setting(SETTING_EDITOR_INSERT_SPACES),
    replaces: "View › Editor Options"
  },
  {
    id: "detectIndentation",
    page: "editor",
    groupKey: "settings.group.indentation",
    titleKey: "settings.editor.detectIndentation.title",
    editor: "switch",
    source: setting(SETTING_EDITOR_DETECT_INDENTATION),
    replaces: "View › Editor Options"
  },
  {
    id: "autocomplete",
    page: "editor",
    groupKey: "settings.group.assistance",
    titleKey: "settings.editor.autocomplete.title",
    editor: "switch",
    source: setting(SETTING_EDITOR_AUTOCOMPLETE),
    replaces: "View › Editor Options"
  },
  {
    id: "quickSuggestionDelay",
    page: "editor",
    groupKey: "settings.group.assistance",
    titleKey: "settings.editor.quickSuggestionDelay.title",
    editor: "select",
    source: setting(SETTING_EDITOR_QUICK_SUGGESTION_DELAY),
    options: opts([
      [10, "settings.editor.quickSuggestionDelay.option.n10"],
      [100, "settings.editor.quickSuggestionDelay.option.n100"],
      [200, "settings.editor.quickSuggestionDelay.option.n200"],
      [500, "settings.editor.quickSuggestionDelay.option.n500"],
      [1000, "settings.editor.quickSuggestionDelay.option.n1000"]
    ]),
    replaces: "View › Editor Options › Quick Suggestion Delay"
  },
  {
    id: "selectionHighlight",
    page: "editor",
    groupKey: "settings.group.assistance",
    titleKey: "settings.editor.selectionHighlight.title",
    editor: "switch",
    source: setting(SETTING_EDITOR_SELECTION_HIGHLIGHT),
    replaces: "View › Editor Options"
  },
  {
    id: "occurrencesHighlight",
    page: "editor",
    groupKey: "settings.group.assistance",
    titleKey: "settings.editor.occurrencesHighlight.title",
    editor: "switch",
    source: setting(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT),
    replaces: "View › Editor Options"
  },
  {
    id: "backgroundCompile",
    page: "editor",
    groupKey: "settings.group.assistance",
    titleKey: "settings.editor.backgroundCompile.title",
    descriptionKey: "settings.editor.backgroundCompile.description",
    editor: "switch",
    source: setting(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE),
    replaces: "View › Editor Options"
  },

  // --- Emulator
  {
    id: "zoomStep",
    page: "emulator",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.zoomStep.title",
    descriptionKey: "settings.emulator.zoomStep.description",
    editor: "select",
    source: setting(SETTING_EMU_ZOOM_STEP),
    options: tableOptions(() => ZOOM_STEPS),
    replaces: "View › Screen Zoom Steps"
  },
  {
    id: "scanlineEffect",
    page: "emulator",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.scanlineEffect.title",
    editor: "select",
    source: setting(SETTING_EMU_SCANLINE_EFFECT),
    options: opts([
      ["off", "settings.emulator.scanlineEffect.option.off"],
      ["50%", lit("50%")],
      ["25%", lit("25%")],
      ["12.5%", lit("12.5%")]
    ]),
    replaces: "Machine › Scanline Effect"
  },
  {
    id: "instantScreen",
    page: "emulator",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.instantScreen.title",
    descriptionKey: "settings.emulator.instantScreen.description",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_INSTANT_SCREEN),
    replaces: "View › Show the Instant Screen"
  },
  {
    id: "beamPosition",
    page: "emulator",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.beamPosition.title",
    descriptionKey: "settings.emulator.beamPosition.description",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_BEAM_POSITION),
    replaces: "View › Show the Beam Position",
    // --- Only machines with a raster beam: not the Z88's LCD, the ZX80/81 or the C64
    when: { kind: "machine", machineIds: BEAM_POSITION_MACHINE_IDS }
  },
  {
    id: "stayOnTop",
    page: "emulator",
    groupKey: "settings.group.window",
    titleKey: "settings.emulator.stayOnTop.title",
    descriptionKey: "settings.emulator.stayOnTop.description",
    editor: "switch",
    source: setting(SETTING_EMU_STAY_ON_TOP),
    replaces: "View › Keep Emulator on Top"
  },
  {
    id: "performanceInfo",
    page: "emulator",
    groupKey: "settings.group.statusBar",
    titleKey: "settings.emulator.performanceInfo.title",
    descriptionKey: "settings.emulator.performanceInfo.description",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_PERFORMANCE_INFO),
    replaces: "View › Show Performance Info in the Status Bar"
  },
  {
    id: "mediaInfo",
    page: "emulator",
    groupKey: "settings.group.statusBar",
    titleKey: "settings.emulator.mediaInfo.title",
    descriptionKey: "settings.emulator.mediaInfo.description",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_MEDIA_INFO),
    replaces: "View › Show Media Information"
  },
  {
    id: "nextLayers",
    page: "emulator",
    groupKey: "settings.group.statusBar",
    titleKey: "settings.emulator.nextLayers.title",
    descriptionKey: "settings.emulator.nextLayers.description",
    editor: "switch",
    source: setting(SETTING_EMU_SHOW_NEXT_LAYERS),
    replaces: "View › Show Layers; Machine › Layers"
  },
  {
    id: "fastLoad",
    page: "emulator",
    groupKey: "settings.group.tape",
    titleKey: "settings.emulator.fastLoad.title",
    descriptionKey: "settings.emulator.fastLoad.description",
    editor: "switch",
    source: setting(SETTING_EMU_FAST_LOAD)
  },

  // --- Debugging
  {
    id: "stepInInterrupts",
    page: "debugging",
    groupKey: "settings.group.stepping",
    titleKey: "settings.debugging.stepInInterrupts.title",
    editor: "switch",
    source: setting(SETTING_EMU_STEP_IN_INTERRUPTS)
  },
  {
    id: "justMyCode",
    page: "debugging",
    groupKey: "settings.group.stepping",
    titleKey: "settings.debugging.justMyCode.title",
    descriptionKey: "settings.debugging.justMyCode.description",
    editor: "switch",
    source: setting(SETTING_EMU_JUST_MY_CODE)
  },
  {
    id: "stopOnErrors",
    page: "debugging",
    groupKey: "settings.group.breakpoints",
    titleKey: "settings.debugging.stopOnErrors.title",
    editor: "switch",
    source: setting(SETTING_EMU_STOP_ON_ERRORS)
  },
  {
    id: "syncBreakpoints",
    page: "debugging",
    groupKey: "settings.group.breakpoints",
    titleKey: "settings.debugging.syncBreakpoints.title",
    descriptionKey: "settings.debugging.syncBreakpoints.description",
    editor: "switch",
    source: setting(SETTING_IDE_SYNC_BREAKPOINTS),
    replaces: "View › Sync the Source with the Current Breakpoint"
  },
  {
    id: "groupBreakpoints",
    page: "debugging",
    groupKey: "settings.group.breakpoints",
    titleKey: "settings.debugging.groupBreakpoints.title",
    editor: "switch",
    source: setting(SETTING_IDE_BP_GROUP_BY_KIND)
  },
  // --- Full reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` D2, D6)
  {
    id: "reverseDebugging",
    page: "debugging",
    groupKey: "settings.group.reverseDebugging",
    titleKey: "settings.debugging.reverseDebugging.title",
    descriptionKey: "settings.debugging.reverseDebugging.description",
    editor: "switch",
    source: setting(SETTING_EMU_REVERSE_DEBUGGING),
    when: { kind: "advancedDebugging" }
  },
  {
    id: "reverseDebugMemory",
    page: "debugging",
    groupKey: "settings.group.reverseDebugging",
    titleKey: "settings.debugging.reverseDebugMemory.title",
    descriptionKey: "settings.debugging.reverseDebugMemory.description",
    editor: "select",
    source: setting(SETTING_EMU_REVERSE_DEBUG_MEMORY_MB),
    when: { kind: "advancedDebugging" },
    options: opts([
      [0, "settings.debugging.reverseDebugMemory.option.n0"],
      [128, lit("128 MB")],
      [256, lit("256 MB")],
      [512, lit("512 MB")],
      [1024, lit("1 GB")],
      [2048, lit("2 GB")]
    ])
  },

  // --- Code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.3)
  {
    id: "profileResetOnStart",
    page: "debugging",
    groupKey: "settings.group.coverageAndProfiling",
    titleKey: "settings.debugging.profileResetOnStart.title",
    descriptionKey: "settings.debugging.profileResetOnStart.description",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_RESET_ON_START),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profileResetAfterInjection",
    page: "debugging",
    groupKey: "settings.group.coverageAndProfiling",
    titleKey: "settings.debugging.profileResetAfterInjection.title",
    descriptionKey: "settings.debugging.profileResetAfterInjection.description",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_RESET_AFTER_INJECTION),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profileCounters",
    page: "debugging",
    groupKey: "settings.group.coverageAndProfiling",
    titleKey: "settings.debugging.profileCounters.title",
    descriptionKey: "settings.debugging.profileCounters.description",
    editor: "switch",
    source: setting(SETTING_EMU_PROFILE_COUNTERS),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "coverageLineTint",
    page: "debugging",
    groupKey: "settings.group.coverageAndProfiling",
    titleKey: "settings.debugging.coverageLineTint.title",
    descriptionKey: "settings.debugging.coverageLineTint.description",
    editor: "switch",
    source: setting(SETTING_IDE_COVERAGE_LINE_TINT),
    when: { kind: "feature", feature: MF_PROFILE }
  },
  {
    id: "profilerInlays",
    page: "debugging",
    groupKey: "settings.group.coverageAndProfiling",
    titleKey: "settings.debugging.profilerInlays.title",
    descriptionKey: "settings.debugging.profilerInlays.description",
    editor: "switch",
    source: setting(SETTING_IDE_PROFILER_INLAYS),
    when: { kind: "feature", feature: MF_PROFILE }
  },

  // --- Machine: only the running machine's rows show
  {
    id: "sp48Rom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.sp48Rom.title",
    descriptionKey: "settings.machine.sp48Rom.description",
    editor: "file",
    source: state("sp48Rom"),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:sp48:select" },
      { labelKey: "settings.button.reset", action: "rom:sp48:reset", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_SPECTRUM_48] },
    replaces: "Machine › Select ROM File; Machine › Reset to Default ROM"
  },
  {
    id: "trdosRom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.trdosRom.title",
    descriptionKey: "settings.machine.trdosRom.description",
    editor: "file",
    source: setting(SETTING_EMU_TRDOS_ROM),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:trdos:select" },
      { labelKey: "settings.button.forget", action: "rom:trdos:forget", needsValue: true }
    ],
    when: { kind: "beta128" },
    replaces: "Machine › TR-DOS ROM"
  },
  {
    id: "esxDosRom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.esxDosRom.title",
    descriptionKey: "settings.machine.esxDosRom.description",
    editor: "file",
    source: setting(SETTING_EMU_ESXDOS_ROM),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:esxdos:select" },
      { labelKey: "settings.button.forget", action: "rom:esxdos:forget", needsValue: true }
    ],
    when: { kind: "divMmc" }
  },
  {
    id: "if1Rom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.if1Rom.title",
    descriptionKey: "settings.machine.if1Rom.description",
    editor: "file",
    source: setting(SETTING_EMU_IF1_ROM),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:if1:select" },
      { labelKey: "settings.button.forget", action: "rom:if1:forget", needsValue: true }
    ],
    when: { kind: "interface1" }
  },
  {
    id: "scorpionRom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.scorpionRom.title",
    descriptionKey: "settings.machine.scorpionRom.description",
    editor: "file",
    source: setting(SETTING_EMU_SCORPION_ROM),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:scorpion:select" },
      { labelKey: "settings.button.forget", action: "rom:scorpion:forget", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_SCORPION] },
    replaces: "Machine › Scorpion ROM"
  },
  {
    id: "timexRom",
    page: "machine",
    groupKey: "settings.group.rom",
    titleKey: "settings.machine.timexRom.title",
    descriptionKey: "settings.machine.timexRom.description",
    editor: "file",
    // --- The model's own setting: resolved by `timexRomSettingIdOf`
    source: setting(SETTING_EMU_TC2048_ROM),
    buttons: [
      { labelKey: "settings.button.browse", action: "rom:timex:select" },
      { labelKey: "settings.button.forget", action: "rom:timex:forget", needsValue: true }
    ],
    when: { kind: "machine", machineIds: [MI_TIMEX] },
    replaces: "Machine › TC2048 / TC2068 / TS2068 ROM"
  },
  // --- The running machine's screen and sound (only the machines they apply to)
  {
    id: "tvNoise",
    page: "machine",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.tvNoise.title",
    descriptionKey: "settings.emulator.tvNoise.description",
    editor: "switch",
    source: setting(SETTING_EMU_TV_NOISE),
    when: { kind: "machine", machineIds: TV_NOISE_MACHINE_IDS }
  },
  {
    id: "ulaSnow",
    page: "machine",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.ulaSnow.title",
    descriptionKey: "settings.emulator.ulaSnow.description",
    editor: "switch",
    source: setting(SETTING_EMU_ULA_SNOW),
    when: { kind: "machine", machineIds: ULA_TIMING_MACHINE_IDS }
  },
  {
    id: "ulaLateTiming",
    page: "machine",
    groupKey: "settings.group.screen",
    titleKey: "settings.emulator.ulaLateTiming.title",
    descriptionKey: "settings.emulator.ulaLateTiming.description",
    editor: "switch",
    source: setting(SETTING_EMU_ULA_LATE_TIMING),
    when: { kind: "machine", machineIds: ULA_TIMING_MACHINE_IDS }
  },
  {
    id: "nextAudioOutput",
    page: "machine",
    groupKey: "settings.group.sound",
    titleKey: "settings.emulator.nextAudioOutput.title",
    descriptionKey: "settings.emulator.nextAudioOutput.description",
    editor: "select",
    source: setting(SETTING_EMU_NEXT_AUDIO_OUTPUT),
    options: tableOptions(() => NEXT_AUDIO_OUTPUTS),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] }
  },
  {
    id: "z88KeyboardLayout",
    page: "machine",
    groupKey: "settings.group.cambridgeZ88",
    titleKey: "settings.machine.z88KeyboardLayout.title",
    editor: "select",
    source: setting(SETTING_EMU_KEYBOARD_LAYOUT),
    options: Z88_KEYBOARD_LAYOUTS,
    when: { kind: "machine", machineIds: [MI_Z88] },
    replaces: "Machine › Keyboard layout"
  },
  {
    id: "z88Lcd",
    page: "machine",
    groupKey: "settings.group.cambridgeZ88",
    titleKey: "settings.machine.z88Lcd.title",
    descriptionKey: "settings.machine.z88Lcd.description",
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
    groupKey: "settings.group.keyboard",
    titleKey: "settings.input.keyMapping.title",
    descriptionKey: "settings.input.keyMapping.description",
    editor: "file",
    source: state("keyMappingFile"),
    buttons: [
      { labelKey: "settings.button.browse", action: "keymap:select" },
      { labelKey: "settings.button.reset", action: "keymap:reset", needsValue: true }
    ],
    replaces: "Machine › Select Key Mapping; Machine › Reset Key Mapping"
  },
  {
    id: "joystickBindings",
    page: "input",
    groupKey: "settings.group.joysticks",
    titleKey: "settings.input.joystickBindings.title",
    descriptionKey: "settings.input.joystickBindings.description",
    editor: "button",
    buttons: [{ labelKey: "settings.button.configure", action: "dialog:joystick-bindings", closesDialog: true }],
    when: { kind: "machine", machineIds: [MI_ZXNEXT, MI_TIMEX] },
    replaces: "Machine › Joystick › Configure bindings"
  },
  {
    id: "mouseCapture",
    page: "input",
    groupKey: "settings.group.mouse",
    titleKey: "settings.input.mouseCapture.title",
    descriptionKey: "settings.input.mouseCapture.description",
    editor: "switch",
    source: setting(SETTING_EMU_MOUSE_CAPTURE),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    replaces: "Machine › Mouse › Capture the mouse"
  },
  {
    id: "mousePointer",
    page: "input",
    groupKey: "settings.group.mouse",
    titleKey: "settings.input.mousePointer.title",
    editor: "select",
    source: setting(SETTING_EMU_MOUSE_SHOW_POINTER),
    options: tableOptions(() => MOUSE_POINTER_DISPLAYS),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    lockedWhen: "mouseCaptureOff",
    replaces: "Machine › Mouse › Show the captured pointer"
  },
  {
    id: "mouseSensitivity",
    page: "input",
    groupKey: "settings.group.mouse",
    titleKey: "settings.input.mouseSensitivity.title",
    editor: "select",
    source: setting(SETTING_EMU_MOUSE_SENSITIVITY),
    options: tableOptions(() => MOUSE_SENSITIVITIES),
    when: { kind: "machine", machineIds: [MI_ZXNEXT] },
    lockedWhen: "mouseCaptureOff",
    replaces: "Machine › Mouse › Sensitivity"
  },

  // --- Recording
  {
    id: "recordingFormat",
    page: "recording",
    groupKey: "settings.group.videoRecording",
    titleKey: "settings.recording.recordingFormat.title",
    editor: "select",
    source: state("recordingFormat"),
    options: opts([
      ["mp4", "settings.recording.recordingFormat.option.mp4"],
      ["webm", "settings.recording.recordingFormat.option.webm"],
      ["mkv", "settings.recording.recordingFormat.option.mkv"]
    ]),
    defaultValue: "mp4",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › Format"
  },
  {
    id: "recordingQuality",
    page: "recording",
    groupKey: "settings.group.videoRecording",
    titleKey: "settings.recording.recordingQuality.title",
    editor: "select",
    source: state("recordingQuality"),
    options: opts([
      ["good", "settings.recording.recordingQuality.option.good"],
      ["high", "settings.recording.recordingQuality.option.high"],
      ["lossless", "settings.recording.recordingQuality.option.lossless"]
    ]),
    defaultValue: "good",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › quality"
  },
  {
    id: "recordingFps",
    page: "recording",
    groupKey: "settings.group.videoRecording",
    titleKey: "settings.recording.recordingFps.title",
    editor: "select",
    source: state("recordingFps"),
    options: opts([
      ["native", "settings.recording.recordingFps.option.native"],
      ["half", "settings.recording.recordingFps.option.half"]
    ]),
    defaultValue: "native",
    lockedWhen: "videoRecording",
    replaces: "Machine › Recording › Half fps"
  },
  {
    id: "windowRecordingIdePosition",
    page: "recording",
    groupKey: "settings.group.idePlusEmulatorRecording",
    titleKey: "settings.recording.windowRecordingIdePosition.title",
    editor: "select",
    source: state("windowRecordingIdePosition"),
    options: opts([
      ["left", "settings.recording.windowRecordingIdePosition.option.left"],
      ["right", "settings.recording.windowRecordingIdePosition.option.right"],
      ["top", "settings.recording.windowRecordingIdePosition.option.top"],
      ["bottom", "settings.recording.windowRecordingIdePosition.option.bottom"]
    ]),
    defaultValue: "left",
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › IDE position"
  },
  {
    id: "windowRecordingPointer",
    page: "recording",
    groupKey: "settings.group.idePlusEmulatorRecording",
    titleKey: "settings.recording.windowRecordingPointer.title",
    editor: "switch",
    source: state("windowRecordingPointer"),
    defaultValue: true,
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › Include pointer"
  },
  {
    id: "windowRecordingClicks",
    page: "recording",
    groupKey: "settings.group.idePlusEmulatorRecording",
    titleKey: "settings.recording.windowRecordingClicks.title",
    editor: "switch",
    source: state("windowRecordingClicks"),
    defaultValue: true,
    lockedWhen: "windowRecording",
    replaces: "Machine › Recording › Show mouse clicks"
  },
  {
    id: "windowRecordingHiDpi",
    page: "recording",
    groupKey: "settings.group.idePlusEmulatorRecording",
    titleKey: "settings.recording.windowRecordingHiDpi.title",
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
    groupKey: "settings.group.assemblers",
    titleKey: "settings.integrations.sjasmplus.title",
    descriptionKey: "settings.integrations.sjasmplus.description",
    editor: "button",
    buttons: [{ labelKey: "settings.button.configure", action: "dialog:sjasmplus", closesDialog: true }],
    replaces: "IDE › Integrations › SjasmPlus Assembler"
  },
  {
    // --- The compiler that actually builds: a project's `zxbasic.compiler` wins over the user's, and
    // --- it is the one this row changes then (`set:basicCompiler`)
    id: "basicCompiler",
    page: "integrations",
    groupKey: "settings.group.basicCompilers",
    titleKey: "settings.integrations.basicCompiler.title",
    descriptionKey: "settings.integrations.basicCompiler.description",
    editor: "select",
    source: state("basicCompiler"),
    options: [
      { label: "Klive BASIC", value: "klive" },
      { label: "Boriel BASIC", value: "boriel" }
    ],
    defaultValue: "klive"
  },
  {
    id: "borielBasic",
    page: "integrations",
    groupKey: "settings.group.basicCompilers",
    titleKey: "settings.integrations.borielBasic.title",
    descriptionKey: "settings.integrations.borielBasic.description",
    editor: "file",
    source: state("borielInstallation"),
    buttons: [{ labelKey: "settings.button.configure", action: "dialog:boriel", closesDialog: true }]
  },
  {
    // --- `.plans/Z88DK_INTEGRATION_PLAN.md` §4.2: the install, set up through its dialog
    id: "z88dk",
    page: "integrations",
    groupKey: "settings.group.cCompiler",
    titleKey: "settings.integrations.z88dk.title",
    descriptionKey: "settings.integrations.z88dk.description",
    editor: "file",
    source: state("z88dkInstallation"),
    buttons: [{ labelKey: "settings.button.configure", action: "dialog:z88dk", closesDialog: true }]
  },
  {
    // --- C6: the build options are project settings, written into `klive.project`
    id: "z88dkCompiler",
    page: "integrations",
    groupKey: "settings.group.cCompiler",
    titleKey: "settings.integrations.z88dkCompiler.title",
    descriptionKey: "settings.integrations.z88dkCompiler.description",
    editor: "select",
    source: state("z88dkCompiler"),
    options: [
      { label: "sccz80", value: "sccz80" },
      { label: "SDCC", value: "sdcc" }
    ],
    when: { kind: "kliveProject" },
    defaultValue: "sccz80"
  },
  {
    id: "z88dkClib",
    page: "integrations",
    groupKey: "settings.group.cCompiler",
    titleKey: "settings.integrations.z88dkClib.title",
    descriptionKey: "settings.integrations.z88dkClib.description",
    editor: "select",
    source: state("z88dkClib"),
    options: () =>
      opts([
        ["classic", "settings.integrations.z88dkClib.option.classic"],
        ["new", "settings.integrations.z88dkClib.option.new"]
      ]),
    when: { kind: "kliveProject" },
    defaultValue: "classic"
  },
  {
    id: "z88dkOptimise",
    page: "integrations",
    groupKey: "settings.group.cCompiler",
    titleKey: "settings.integrations.z88dkOptimise.title",
    descriptionKey: "settings.integrations.z88dkOptimise.description",
    editor: "select",
    source: state("z88dkOptimise"),
    options: () =>
      opts([
        ["none", "settings.integrations.z88dkOptimise.option.none"],
        ["O1", lit("-O1")],
        ["O2", lit("-O2")],
        ["O3", lit("-O3")],
        ["SO3", lit("-SO3")]
      ]),
    when: { kind: "kliveProject" },
    defaultValue: "O2"
  }
];

/** What the settings say about the z88dk install (not whether it still works: the dialog checks). */
export function z88dkInstallationFolder(appState: AppState | undefined): string {
  const settings = appState ? createSettingsReader(appState) : undefined;
  return String(settings?.readSetting(Z88DK_INSTALL_FOLDER) ?? "").trim();
}

/** A project's z88dk build option, or its default when the project does not set it. */
export function z88dkProjectOption(appState: AppState | undefined, key: string, fallback: string): string {
  const value = key.split(".").reduce<any>((node, part) => (node == null ? undefined : node[part]), appState?.projectSettings);
  return typeof value === "string" && value ? value : fallback;
}

/**
 * The folder of the Boriel BASIC Klive uses: an explicit `zxc` path's folder, else the installation
 * folder; empty when it is not set up. What the settings say, not whether it still works (the
 * Configure dialog checks that).
 */
export function borielInstallationFolder(appState: AppState | undefined): string {
  const settings = appState ? createSettingsReader(appState) : undefined;
  const explicit = String(settings?.readSetting(ZXBC_EXECUTABLE_PATH) ?? "").trim();
  if (explicit) return explicit.replace(/[\\/][^\\/]*$/, "");
  return String(settings?.readSetting(BORIEL_INSTALL_FOLDER) ?? "").trim();
}

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
    case "basicCompiler":
      return selectedZxBasicCompiler(appState);
    case "borielInstallation":
      return borielInstallationFolder(appState);
    case "z88dkInstallation":
      return z88dkInstallationFolder(appState);
    case "z88dkCompiler":
      return z88dkProjectOption(appState, Z88DK_COMPILER, "sccz80");
    case "z88dkClib":
      return z88dkProjectOption(appState, Z88DK_CLIB, "classic");
    case "z88dkOptimise":
      return z88dkProjectOption(appState, Z88DK_OPTIMISE, "O2");
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
    case "divMmc":
      return isDivMmcMachine(machineId, appState?.emulatorState?.modelId, appState?.emulatorState?.config);
    case "interface1":
      return hasInterface1(machineId, appState?.emulatorState?.modelId, appState?.emulatorState?.config);
    case "kliveProject":
      return !!appState?.project?.isKliveProject;
    case "advancedDebugging":
      return isAdvancedDebuggingEnabled(appState);
    case "i18nDevTools":
      return !!appState?.uiLanguage?.devTools;
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

/** A key's English text: the search matches it as well as the current language */
function english(key: MessageKey | undefined): string {
  return key ? (SOURCE_CATALOG[key] ?? key) : "";
}

export function settingsRowTitle(row: SettingsRow): string {
  return t(row.titleKey);
}

export function settingsRowDescription(row: SettingsRow, env?: SettingsPlatform): string | undefined {
  const computed = env && row.describe?.(env);
  if (computed) return computed;
  return row.descriptionKey ? t(row.descriptionKey) : undefined;
}

/**
 * The current language's translation status (§7): "92 % translated · 14 entries outdated"; nothing
 * for English or a language without a catalog. Counted at build time (`TRANSLATION_STATUS`).
 */
export function translationStatusText(env: SettingsPlatform): string | undefined {
  const status = TRANSLATION_STATUS[env.uiLanguage?.current ?? ""];
  if (!status || !status.total) return undefined;
  const percent = Math.floor((status.translated * 100) / status.total);
  return status.outdated
    ? t("settings.language.statusOutdated", { percent, outdated: status.outdated })
    : t("settings.language.status", { percent });
}

export function settingsRowGroup(row: SettingsRow): string {
  return t(row.groupKey);
}

/** A page's title as shown */
export function settingsPageTitle(pageId: SettingsPageId): string {
  const page = SETTINGS_PAGES.find((p) => p.id === pageId);
  return page ? t(page.titleKey) : "";
}

/**
 * Does a row match a search? Title, description, group, page and the old menu path all count, in
 * the current language and in English (a German user finds the Language page by *Sprache* and by
 * *language*).
 */
export function settingsRowMatches(row: SettingsRow, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const page = SETTINGS_PAGES.find((p) => p.id === row.page);
  const text = [
    settingsRowTitle(row),
    english(row.titleKey),
    settingsRowDescription(row),
    english(row.descriptionKey),
    settingsRowGroup(row),
    english(row.groupKey),
    settingsPageTitle(row.page),
    page?.title,
    row.replaces
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}
