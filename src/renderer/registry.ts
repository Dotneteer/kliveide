import {
  BASIC_EDITOR,
  COMMAND_RESULT_EDITOR,
  CODE_EDITOR,
  TAP_VIEWER,
  DSK_VIEWER,
  NEX_VIEWER,
  Z80_VIEWER,
  SNA_VIEWER,
  SCR_VIEWER,
  SHC_VIEWER,
  SHR_VIEWER,
  SLR_VIEWER,
  SL2_VIEWER,
  PAL_EDITOR,
  NPL_EDITOR,
  NXI_EDITOR,
  SPR_EDITOR,
  VID_VIEWER,
  STATIC_MEMORY_DUMP_VIEWER,
  SCRIPT_OUTPUT_VIEWER,
  MEMORY_EDITOR,
  DISASSEMBLY_EDITOR,
  UNKNOWN_EDITOR
} from "@state/common-ids";
import { BUILD_FILE, PROJECT_FILE } from "@common/structs/project-const";
import { Activity } from "./abstractions/Activity";
import { MonacoAwareCustomLanguageInfo } from "./abstractions/CustomLanguageInfo";
import { DocumentRendererInfo } from "./abstractions/DocumentRendererInfo";
import { FileTypeEditor } from "./abstractions/FileTypePattern";
import { OutputPaneInfo } from "./abstractions/OutputPaneInfo";
import { SideBarPanelInfo } from "./abstractions/SideBarPanelInfo";
import { ToolRendererInfo } from "./abstractions/ToolRendererInfo";
import { createBasicPanel } from "./appIde/DocumentPanels/BasicPanel";
import { createCodeEditorPanel } from "./appIde/DocumentPanels/CodeEditorPanel";
import { createCommandResultPanel } from "./appIde/DocumentPanels/CommandResult";
import { asmKz80LanguageProvider } from "./appIde/project/asmKz80LangaugeProvider";
import { asmZxbLanguageProvider } from "./appIde/project/asmZxbLanguageProvider";
import { zxBasLanguageProvider } from "./appIde/project/zxBasLanguageProvider";
import { breakpointsPanelRenderer } from "./appIde/SiteBarPanels/BreakpointsPanel";
import { cpuPanelRenderer } from "./appIde/SiteBarPanels/CpuPanel";
import { explorerPanelRenderer } from "./appIde/SiteBarPanels/ExplorerPanel";
import { sysVarsPanelRenderer } from "./appIde/SiteBarPanels/SysVarsPanel";
import { ulaPanelRenderer } from "./appIde/SiteBarPanels/UlaPanel";
import {
  commandPanelRenderer,
  commandPanelHeaderRenderer
} from "./appIde/ToolArea/CommandPanel";
import {
  outputPanelRenderer,
  outputPanelHeaderRenderer
} from "./appIde/ToolArea/OutputPanel";
import { createTapViewerPanel } from "./appIde/DocumentPanels/TapViewerPanel";
import { psgPanelRenderer } from "./appIde/SiteBarPanels/PsgPanel";
import { necUpd765PanelRenderer } from "./appIde/SiteBarPanels/NecUpd765Panel";
import { createDskViewerPanel } from "./appIde/DocumentPanels/DskViewerPanel";
import {
  MC_DISK_SUPPORT,
  MF_BLINK,
  MF_PSG,
  MF_ULA,
  MI_ZXNEXT
} from "@common/machines/constants";
import { blinkPanelRenderer } from "./appIde/SiteBarPanels/BlinkPanel";
import { createNexFileViewerPanel } from "./appIde/DocumentPanels/Next/NexFileViewerPanel";
import { createZ80FileViewerPanel } from "./appIde/DocumentPanels/Next/Z80FileViewerPanel";
import { createSnaFileViewerPanel } from "./appIde/DocumentPanels/Next/SnaFileViewerPanel";
import { createScrFileViewerPanel } from "./appIde/DocumentPanels/Next/ScrFileViewerPanel";
import { createShcFileViewerPanel } from "./appIde/DocumentPanels/Next/ShcFileViewerPanel";
import { createShrFileViewerPanel } from "./appIde/DocumentPanels/Next/ShrFileViewerPanel";
import { createSlrFileViewerPanel } from "./appIde/DocumentPanels/Next/SlrFileViewerPanel";
import { createSl2FileViewerPanel } from "./appIde/DocumentPanels/Next/Sl2FileViewerPanel";
import { createPalFileEditorPanel } from "./appIde/DocumentPanels/Next/PalFileEditorPanel";
import { createNxiFileEditorPanel } from "./appIde/DocumentPanels/Next/NxiFileEditorPanel";
import { createSprFileEditorPanel } from "./appIde/DocumentPanels/Next/SpriteEditorPanel/SprFileEditorPanel";
import { createVidFileViewerPanel } from "./appIde/DocumentPanels/Next/VidFileViewerPanel";
import { createStaticMemoryDump } from "./appIde/DocumentPanels/Memory/StaticMemoryDump";
import { ksxLanguageProvider } from "./appIde/project/ksxLanguageProvider";
import {
  PANE_ID_BUILD,
  PANE_ID_EMU,
  PANE_ID_SCRIPTIMG
} from "@common/integration/constants";
import { scriptingHistoryPanelRenderer } from "./appIde/SiteBarPanels/ScriptingHistoryPanel";
import { getScriptingContextMenuIfo, scriptingCommandBarRenderer } from "./appIde/DocumentArea/ScriptingCommandBar";
import { createScriptOutputPanel } from "./appIde/DocumentPanels/ScriptOutputPanel";
import { createBankedDisassemblyPanel } from "./appIde/DocumentPanels/DisassemblyPanel";
import { createMemoryPanel } from "./appIde/DocumentPanels/Memory/MemoryPanel";
import { createUnknownFileViewerPanel } from "./appIde/DocumentPanels/UnknownFileViewerPanel";
import { nextRegPanelRenderer } from "./appIde/SiteBarPanels/NextRegPanel";
import { nextMemMappingPanelRenderer } from "./appIde/SiteBarPanels/MemMappingPanel";
import { callStackPanelRenderer } from "./appIde/SiteBarPanels/CallStackPanel";
import { nextPalettePanelRenderer } from "./appIde/SiteBarPanels/PalettePanel";
import { sjasmZ80LanguageProvider } from "./appIde/project/sjasmZ80LanguageProvider";

const ACTIVITY_FILE_ID = "file-view";
const ACTIVITY_DEBUG_ID = "debug-view";
const ACTIVITY_MACHINE_INFO_ID = "log-view";
const ACTIVITY_SCRIPTING_ID = "scripting-view";
const ACTIVITY_TEST_ID = "test-view";

// --- Set up activities
export const activityRegistry: Activity[] = [
  {
    id: ACTIVITY_FILE_ID,
    title: "Explorer",
    iconName: "files"
  },
  {
    id: ACTIVITY_DEBUG_ID,
    title: "Debug",
    iconName: "debug-alt"
  },
  {
    id: ACTIVITY_MACHINE_INFO_ID,
    title: "Machine info",
    iconName: "output"
  },
  {
    id: ACTIVITY_SCRIPTING_ID,
    title: "Scripting",
    iconName: "symbol-event"
  },
  {
    id: ACTIVITY_TEST_ID,
    title: "Testing",
    iconName: "beaker"
  }
];

// --- Set up side bar panels
export const sideBarPanelRegistry: SideBarPanelInfo[] = [
  {
    id: "explorerPanel",
    title: "Klive Project",
    hostActivity: ACTIVITY_FILE_ID,
    renderer: explorerPanelRenderer,
    expandedOnInit: true
  },
  {
    id: "cpuPanel",
    title: "Z80 CPU",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: cpuPanelRenderer,
    expandedOnInit: true
  },
  {
    id: "callStackPanel",
    title: "Call Stack",
    hostActivity: ACTIVITY_DEBUG_ID,
    noScrollViewer: false,
    renderer: callStackPanelRenderer,
  },
  {
    id: "nextMemoryMappingPanel",
    title: "Next Memory Mapping",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: nextMemMappingPanelRenderer,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "nextRegPanel",
    title: "Next Registers",
    hostActivity: ACTIVITY_DEBUG_ID,
    noScrollViewer: false,
    renderer: nextRegPanelRenderer,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "ulaPanel",
    title: "ULA & I/O",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: ulaPanelRenderer,
    initialSize: 500,
    requireFeature: [MF_ULA]
  },
  {
    id: "blinkPanel",
    title: "BLINK",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: blinkPanelRenderer,
    initialSize: 500,
    requireFeature: [MF_BLINK]
  },
  {
    id: "breakpointsPanel",
    title: "Breakpoints",
    hostActivity: ACTIVITY_DEBUG_ID,
    noScrollViewer: false,
    renderer: breakpointsPanelRenderer,
    expandedOnInit: true
  },
  {
    id: "sysVarsPanel",
    title: "System Variables",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    noScrollViewer: false,
    renderer: sysVarsPanelRenderer
  },
  {
    id: "psgPanel",
    title: "PSG (AY-3-8912)",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: psgPanelRenderer,
    initialSize: 500,
    requireFeature: [MF_PSG]
  },
  {
    id: "necUpd765Panel",
    title: "NEC UPD 765 Log",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: necUpd765PanelRenderer,
    initialSize: 500,
    requireConfig: [MC_DISK_SUPPORT]
  },
  {
    id: "nextPalettePanel",
    title: "Next Palettes",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: nextPalettePanelRenderer,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "scriptingHistory",
    title: "Scripting History",
    hostActivity: ACTIVITY_SCRIPTING_ID,
    renderer: scriptingHistoryPanelRenderer,
    initialSize: 500
  },
];

// --- Set up tool panels
export const toolPanelRegistry: ToolRendererInfo[] = [
  {
    id: "commands",
    name: "Commands",
    renderer: commandPanelRenderer,
    headerRenderer: commandPanelHeaderRenderer
  },
  {
    id: "output",
    name: "Output",
    renderer: outputPanelRenderer,
    headerRenderer: outputPanelHeaderRenderer
  }
];

// --- Set up output panes
export const outputPaneRegistry: OutputPaneInfo[] = [
  {
    id: PANE_ID_EMU,
    displayName: "Emulator"
  },
  {
    id: PANE_ID_BUILD,
    displayName: "Build"
  },
  {
    id: PANE_ID_SCRIPTIMG,
    displayName: "Script Output"
  }
];

// --- Set up document panel renderers
export const documentPanelRegistry: DocumentRendererInfo[] = [
  {
    id: UNKNOWN_EDITOR,
    renderer: createUnknownFileViewerPanel
  },
  {
    id: CODE_EDITOR,
    renderer: createCodeEditorPanel
  },
  {
    id: DISASSEMBLY_EDITOR,
    renderer: createBankedDisassemblyPanel,
    icon: "disassembly-icon",
    iconFill: "--console-ansi-bright-cyan"
  },
  {
    id: MEMORY_EDITOR,
    renderer: createMemoryPanel,
    icon: "memory-icon",
    iconFill: "--console-ansi-bright-cyan"
  },
  {
    id: BASIC_EDITOR,
    renderer: createBasicPanel,
    icon: "code",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: COMMAND_RESULT_EDITOR,
    renderer: createCommandResultPanel,
    icon: "code",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: STATIC_MEMORY_DUMP_VIEWER,
    renderer: createStaticMemoryDump,
    icon: "memory-icon",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: TAP_VIEWER,
    renderer: createTapViewerPanel,
    icon: "@file-tap-tzx",
    iconFill: "--console-ansi-bright-cyan"
  },
  {
    id: DSK_VIEWER,
    renderer: createDskViewerPanel,
    icon: "floppy",
    iconFill: "--console-ansi-bright-blue"
  },
  {
    id: NEX_VIEWER,
    renderer: createNexFileViewerPanel,
    icon: "chip",
    iconFill: "--console-ansi-bright-blue"
  },
  {
    id: Z80_VIEWER,
    renderer: createZ80FileViewerPanel,
    icon: "chip",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: SNA_VIEWER,
    renderer: createSnaFileViewerPanel,
    icon: "chip",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: SCR_VIEWER,
    renderer: createScrFileViewerPanel,
    icon: "vm",
    iconFill: "--console-ansi-bright-blue"
  },
  {
    id: SHC_VIEWER,
    renderer: createShcFileViewerPanel,
    icon: "vm",
    iconFill: "--console-ansi-bright-green"
  },
  {
    id: SHR_VIEWER,
    renderer: createShrFileViewerPanel,
    icon: "vm",
    iconFill: "--console-ansi-bright-cyan"
  },
  {
    id: SLR_VIEWER,
    renderer: createSlrFileViewerPanel,
    icon: "vm",
    iconFill: "--console-ansi-bright-red"
  },
  {
    id: SL2_VIEWER,
    renderer: createSl2FileViewerPanel,
    icon: "vm",
    iconFill: "--console-ansi-yellow"
  },
  {
    id: PAL_EDITOR,
    renderer: createPalFileEditorPanel,
    icon: "palette",
    iconFill: "--console-ansi-bright-blue"
  },
  {
    id: NPL_EDITOR,
    renderer: createPalFileEditorPanel,
    icon: "palette",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    id: NXI_EDITOR,
    renderer: createNxiFileEditorPanel,
    icon: "layers",
    iconFill: "--console-ansi-bright-blue"
  },
  {
    id: SPR_EDITOR,
    renderer: createSprFileEditorPanel,
    icon: "sprite",
    iconFill: "--console-ansi-bright-green"
  },
  {
    id: VID_VIEWER,
    renderer: createVidFileViewerPanel,
    icon: "video",
    iconFill: "--console-ansi-bright-cyan"
  },
  {
    id: SCRIPT_OUTPUT_VIEWER,
    renderer: createScriptOutputPanel,
    icon: "note",
    iconFill: "--console-ansi-bright-green"
  },
];

// --- The registry of ile types
export const fileTypeRegistry: FileTypeEditor[] = [
  {
    matchType: "full",
    pattern: PROJECT_FILE,
    editor: CODE_EDITOR,
    subType: "json",
    isReadOnly: true,
    icon: "@file-project"
  },
  {
    matchType: "full",
    pattern: BUILD_FILE,
    editor: CODE_EDITOR,
    subType: "ksx",
    icon: "combine",
    iconFill: "--console-ansi-bright-magenta"
  },
  {
    matchType: "ends",
    pattern: ".c",
    canBeBuildRoot: true,
    editor: CODE_EDITOR,
    subType: "c",
    icon: "@file-c"
  },
  {
    matchType: "ends",
    pattern: ".lua",
    canBeBuildRoot: true,
    editor: CODE_EDITOR,
    subType: "lua",
    icon: "@file-c"
  },
  {
    matchType: "ends",
    pattern: ".h",
    editor: CODE_EDITOR,
    subType: "c",
    icon: "@file-h"
  },
  {
    matchType: "ends",
    pattern: ".kz80.asm",
    editor: CODE_EDITOR,
    subType: "kz80-asm",
    icon: "@file-kz80-asm"
  },
  {
    matchType: "ends",
    pattern: ".sjasm",
    editor: CODE_EDITOR,
    subType: "sjasm",
    icon: "@file-kz80-asm"
  },
  {
    matchType: "ends",
    pattern: ".asm",
    editor: CODE_EDITOR,
    subType: "kz80-asm",
    icon: "@file-kz80-asm"
  },
  {
    matchType: "ends",
    pattern: ".zxb.asm",
    editor: CODE_EDITOR,
    subType: "zxbasm",
    icon: "@file-zxb-asm"
  },
  {
    matchType: "ends",
    pattern: ".zxbas",
    editor: CODE_EDITOR,
    subType: "zxbas",
    icon: "@file-zxbas"
  },
  {
    matchType: "ends",
    pattern: ".bas",
    editor: CODE_EDITOR,
    subType: "zxbas",
    icon: "@file-zxbas"
  },
  {
    matchType: "ends",
    pattern: ".txt",
    editor: CODE_EDITOR,
    subType: "plain-text",
    icon: "@file-text-txt"
  },
  {
    matchType: "full",
    pattern: "build.ksx",
    editor: CODE_EDITOR,
    subType: "ksx",
    icon: "@file-ksx",
  },
  {
    matchType: "ends",
    pattern: ".ksx",
    editor: CODE_EDITOR,
    subType: "ksx",
    icon: "@file-ksx",
    documentTabRenderer: scriptingCommandBarRenderer,
    contextMenuInfo: getScriptingContextMenuIfo
  },
  {
    matchType: "ends",
    pattern: ".tzx",
    editor: TAP_VIEWER,
    icon: "@file-tap-tzx",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".tap",
    editor: TAP_VIEWER,
    icon: "@file-tap-tzx",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".dsk",
    editor: DSK_VIEWER,
    icon: "floppy",
    iconFill: "--console-ansi-bright-blue",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".nex",
    editor: NEX_VIEWER,
    icon: "chip",
    iconFill: "--console-ansi-bright-blue",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".z80",
    editor: Z80_VIEWER,
    icon: "chip",
    iconFill: "--console-ansi-bright-magenta",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".sna",
    editor: SNA_VIEWER,
    icon: "chip",
    iconFill: "--console-ansi-bright-magenta",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".scr",
    editor: SCR_VIEWER,
    icon: "vm",
    iconFill: "--console-ansi-bright-blue",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".shc",
    editor: SHC_VIEWER,
    icon: "vm",
    iconFill: "--console-ansi-bright-green",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".shr",
    editor: SHR_VIEWER,
    icon: "vm",
    iconFill: "--console-ansi-bright-cyan",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".slr",
    editor: SLR_VIEWER,
    icon: "vm",
    iconFill: "--console-ansi-bright-red",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".sl2",
    editor: SL2_VIEWER,
    icon: "vm",
    iconFill: "--console-ansi-yellow",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".pal",
    editor: PAL_EDITOR,
    icon: "palette",
    iconFill: "--console-ansi-bright-blue",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".npl",
    editor: NPL_EDITOR,
    icon: "palette",
    iconFill: "--console-ansi-bright-magenta",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".nxi",
    editor: NXI_EDITOR,
    icon: "layers",
    iconFill: "--console-ansi-bright-blue",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".spr",
    editor: SPR_EDITOR,
    icon: "sprite",
    iconFill: "--console-ansi-bright-green",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".vid",
    editor: VID_VIEWER,
    icon: "video",
    iconFill: "--console-ansi-bright-cyan",
    isBinary: true,
    openPermanent: true
  }
];

export const unknownFileType: FileTypeEditor = {
  pattern: "*",
  editor: UNKNOWN_EDITOR,
  icon: "code",
  iconFill: "--console-ansi-bright-yellow"
};

// --- Supported custom languages
export const customLanguagesRegistry: MonacoAwareCustomLanguageInfo[] = [
  asmKz80LanguageProvider,
  asmZxbLanguageProvider,
  zxBasLanguageProvider,
  ksxLanguageProvider,
  sjasmZ80LanguageProvider
];
