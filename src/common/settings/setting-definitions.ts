import { Setting } from "@abstractions/Setting";
import { DEFAULT_MONOSPACE_FONT_ID } from "@common/settings/monospace-fonts";
import {
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_PANEL_FONT_SIZE
} from "@common/settings/font-sizes";
import { PANE_ID_EMU } from "@common/integration/constants";
import { DEFAULT_ZOOM_STEP } from "@common/settings/zoom-steps";
import {
  DEFAULT_MOUSE_CAPTURE_ENABLED,
  DEFAULT_MOUSE_SENSITIVITY,
  DEFAULT_MOUSE_POINTER_DISPLAY
} from "@common/settings/mouse-capture";
import { DEFAULT_JOYSTICK_BINDINGS } from "@common/settings/joystick-bindings";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_KEYBOARD_LAYOUT,
  SETTING_EMU_SHOW_INSTANT_SCREEN,
  SETTING_EMU_SHOW_KEYBOARD,
  SETTING_EMU_SHOW_STATUS_BAR,
  SETTING_EMU_SHOW_TOOLBAR,
  SETTING_EMU_STAY_ON_TOP,
  SETTING_EMU_SCANLINE_EFFECT,
  SETTING_EMU_ZOOM_STEP,
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_MOUSE_SHOW_POINTER,
  SETTING_EMU_MOUSE_SENSITIVITY,
  SETTING_EMU_JOYSTICK_BINDINGS,
  SETTING_IDE_ACTIVE_OUTPUT_PANE,
  SETTING_IDE_ACTIVE_TOOL,
  SETTING_IDE_CLOSE_EMU,
  SETTING_IDE_NAV_RECORD_TAB_SWITCH,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_FONT_FAMILY,
  SETTING_PANEL_FONT_FAMILY,
  SETTING_PANEL_FONT_SIZE,
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_OPEN_LAST_PROJECT,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SIDEBAR_WIDTH,
  SETTING_IDE_SYNC_BREAKPOINTS,
  SETTING_IDE_BP_GROUP_BY_KIND,
  SETTING_IDE_TOOLPANEL_HEIGHT,
  SETTING_IDE_TOOLS_ON_TOP,
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_TABSIZE,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EMU_KEYBOARD_HEIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE
} from "@common/settings/setting-const";

const settingDefinitions: Setting[] = [
  {
    id: SETTING_EMU_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the Emulator view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_KEYBOARD,
    title: "Show the Virtual Keyboard",
    description: "Show or hide the virtual keyboard in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SHOW_INSTANT_SCREEN,
    title: "Show the Instant Screen",
    description: "Show or hide the instant screen in the Emulator view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_SCANLINE_EFFECT,
    title: "Scanline Effect Intensity",
    description: "Intensity of the CRT scanline effect (off, 50%, 25%, or 12.5%).",
    type: "string",
    defaultValue: "off",
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_ZOOM_STEP,
    title: "Screen Zoom Steps",
    description:
      "Granularity of the emulator screen's fit to its panel: 1 (whole steps), 0.5 (half steps) " +
      "or 0.25 (quarter steps).",
    type: "number",
    defaultValue: DEFAULT_ZOOM_STEP,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_MOUSE_CAPTURE,
    title: "Capture the mouse",
    description:
      "Let the emulator take the host mouse, so it can drive the machine's own mouse. While " +
      "captured the host cursor is hidden; press Esc to release it.",
    type: "boolean",
    defaultValue: DEFAULT_MOUSE_CAPTURE_ENABLED,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_MOUSE_SHOW_POINTER,
    title: "Show the captured pointer",
    description:
      "When to draw Klive's own pointer over the screen while the mouse is captured: always, " +
      "only while no program on the machine reads the mouse, or never.",
    type: "string",
    defaultValue: DEFAULT_MOUSE_POINTER_DISPLAY,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_MOUSE_SENSITIVITY,
    title: "Mouse sensitivity",
    description:
      "How far the machine's pointer travels for a given movement of the host mouse. Separate " +
      "from the machine's own DPI setting, which software controls.",
    type: "number",
    defaultValue: DEFAULT_MOUSE_SENSITIVITY,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_JOYSTICK_BINDINGS,
    title: "Joystick bindings",
    description:
      "Which host key drives each pin of the machine's two joystick connectors, and whether each " +
      "connector is driven by the keyboard, a gamepad, or nothing.",
    type: "object",
    defaultValue: DEFAULT_JOYSTICK_BINDINGS,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_FAST_LOAD,
    title: "Fast load",
    description: "Allows the emulator fast tape load mode.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_STAY_ON_TOP,
    title: "Keep Emulator on Top",
    description: "Allows the emulator to stay on top of other windows.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_KEYBOARD_LAYOUT,
    title: "Keyboard Layout",
    description: "Keyboard layout for the emulator.",
    type: "string",
    defaultValue: "uk",
    saveWithIde: true,
    boundTo: "emu"
  },
  {
    id: SETTING_EMU_KEYBOARD_HEIGHT,
    title: "(keyboard height)",
    type: "string",
    defaultValue: "33%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_SHOW_TOOLBAR,
    title: "Show the Toolbar",
    description: "Show or hide the toolbar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_STATUS_BAR,
    title: "Show the Status Bar",
    description: "Show or hide the status bar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_SIDEBAR,
    title: "Show the Sidebar",
    description: "Show or hide the sidebar in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_TO_RIGHT,
    title: "Move the Sidebar to the Right",
    description: "Moves the sidebar to the right side of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SHOW_TOOLS,
    title: "Show Command and Output",
    description: "Displays the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_TOOLS_ON_TOP,
    title: "Move Commands and Output to the top",
    description: "Moves the command and output panels to the top of the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_MAXIMIZE_TOOLS,
    title: "Maximize Commands and Output",
    description: "Maximizes the command and output panels in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SYNC_BREAKPOINTS,
    title: "Sync the Source with the Current Breakpoint",
    description: "Sync the source with the current breakpoint in the IDE view.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_BP_GROUP_BY_KIND,
    title: "Group Breakpoints by Kind",
    description:
      "Show the Breakpoints view grouped under a header per breakpoint kind. Turning this off " +
      "hides the headers; it does not change the order of the rows.",
    type: "boolean",
    // --- On by default: grouping is the right shape for a mixed set, and it is also what makes
    // --- the six type icons learnable. The toggle is for someone watching one routine, where the
    // --- single header costs a row and says nothing.
    defaultValue: true,
    // --- Bound to the IDE, not to a project: a view preference that travelled in `.kliveproject`
    // --- would be shared through source control.
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_SIDEBAR_WIDTH,
    title: "(Sidebar width)",
    type: "string",
    defaultValue: "25%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_TOOLPANEL_HEIGHT,
    title: "(Toolpanel height)",
    type: "string",
    defaultValue: "33%",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_ACTIVE_TOOL,
    title: "(active tool)",
    type: "string",
    defaultValue: "commands",
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_ACTIVE_OUTPUT_PANE,
    title: "(active output pane)",
    type: "string",
    defaultValue: PANE_ID_EMU,
    saveWithIde: true,
    volatile: true
  },
  {
    id: SETTING_IDE_OPEN_LAST_PROJECT,
    title: "Open the last project at startup",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_CLOSE_EMU,
    title: "Close Emulator when IDE is closed",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_IDE_NAV_RECORD_TAB_SWITCH,
    title: "Record tab switches in the navigation history",
    description:
      "Switching documents with a tab, the Open Editors panel or the Explorer adds a Go Back / Go Forward location.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
    boundTo: "ide"
  },
  {
    id: SETTING_PANEL_FONT_FAMILY,
    title: "Panel Font",
    description:
      "Monospace font used by the monitoring panels and views (memory, disassembly, CPU, ULA and " +
      "the rest). Chosen from the same list as the editor font; the choices offered depend on the " +
      "platform.",
    type: "string",
    defaultValue: DEFAULT_MONOSPACE_FONT_ID,
    saveWithIde: true,
  },
  {
    id: SETTING_PANEL_FONT_SIZE,
    title: "Panel Font Size",
    description:
      "Font size, in pixels, of the data shown by the monitoring panels and views. Panel titles, " +
      "tabs and the status bar keep their own size, just as the editor's font size leaves the " +
      "chrome around it alone.",
    type: "number",
    defaultValue: DEFAULT_PANEL_FONT_SIZE,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_FONT_FAMILY,
    title: "Font Family",
    description: "Monospace font used by the editor. The choices offered depend on the platform.",
    type: "string",
    defaultValue: DEFAULT_MONOSPACE_FONT_ID,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_FONT_SIZE,
    title: "Font Size",
    description: "Font size for the editor.",
    type: "number",
    defaultValue: DEFAULT_EDITOR_FONT_SIZE,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_AUTOCOMPLETE,
    title: "Enable AutoComplete",
    description: "Enable or disable the auto-complete feature in the editor.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_TABSIZE,
    title: "Tab size",
    description: "Number of spaces per tab in the editor.",
    type: "number",
    defaultValue: 4,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_INSERT_SPACES,
    title: "Insert Spaces Instead of Tabs",
    description: "Use spaces instead of tabs for indentation.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_RENDER_WHITESPACE,
    title: "Render whitespace characters",
    description: "Render whitespace characters in the editor.",
    type: "string",
    defaultValue: "none",
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_DETECT_INDENTATION,
    title: "Detect Indentation",
    description: "Automatically detect indentation settings.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_SELECTION_HIGHLIGHT,
    title: "Enable Selection Highlight",
    description: "Enable or disable the selection highlight feature in the editor.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
    title: "Enable Occurrences Highlight",
    description: "Enable or disable the occurrences highlight feature in the editor.",
    type: "boolean",
    defaultValue: true,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
    title: "Quick Suggestion Delay",
    description: "Delay in milliseconds for quick suggestions.",
    type: "number",
    defaultValue: 100,
    saveWithIde: true,
  },
  {
    id: SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE,
    title: "Allow Background Compile",
    description: "Enable or disable background compilation in the editor.",
    type: "boolean",
    defaultValue: false,
    saveWithIde: true,
  }
];

export const KliveGlobalSettings: Record<string, Setting> = settingDefinitions.reduce(
  (acc, setting) => {
    acc[setting.id] = setting;
    return acc;
  },
  {}
);
