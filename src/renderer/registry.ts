import {
  BASIC_EDITOR,
  COMMAND_RESULT_EDITOR,
  CODE_EDITOR,
  TEXT_EDITOR,
  BIN_VIEWER,
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
  IMAGE_VIEWER,
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
import { createTextNavigationAdapter } from "./appIde/navigation/textNavigationAdapter";
import { getMonacoTextModel } from "./appIde/navigation/monacoTextModels";

// --- One instance for both editor types: it holds the line-drift tracking state.
const textNavigationAdapter = createTextNavigationAdapter({ getModel: getMonacoTextModel });
import { FileTypeEditor } from "./abstractions/FileTypePattern";
import { OutputPaneInfo } from "./abstractions/OutputPaneInfo";
import { SideBarPanelInfo } from "./abstractions/SideBarPanelInfo";
import { ToolRendererInfo } from "./abstractions/ToolRendererInfo";
import { createBasicPanel } from "./appIde/DocumentPanels/BasicPanel";
import { createCodeEditorPanel } from "./appIde/DocumentPanels/CodeEditorPanel";
import { createTextEditorPanel } from "./appIde/DocumentPanels/TextEditorPanel";
import { createCommandResultPanel } from "./appIde/DocumentPanels/CommandResult";
import { asmKz80LanguageProvider } from "./appIde/project/asmKz80LanguageProvider";
import { asmZxbLanguageProvider } from "./appIde/project/asmZxbLanguageProvider";
import { zxBasLanguageProvider } from "./appIde/project/zxBasLanguageProvider";
import { BreakpointsPanel } from "./appIde/SideBarPanels/BreakpointsPanel";
import { BreakpointsBadge } from "./appIde/SideBarPanels/BreakpointsBadge";
import { WatchBadge } from "./appIde/SideBarPanels/WatchBadge";
import { Z80CpuPanel } from "./appIde/SideBarPanels/Z80CpuPanel";
import { ExplorerPanel } from "@renderer/features/explorer/ExplorerPanel";
import { OpenEditorsPanel } from "@renderer/features/openEditors/OpenEditorsPanel";
import { OpenEditorsBadge } from "@renderer/features/openEditors/OpenEditorsBadge";
import { SysVarsPanel } from "./appIde/SideBarPanels/SysVarsPanel";
import { UlaPanel } from "./appIde/SideBarPanels/UlaPanel";
import {
  CommandPanel,
  CommandPanelHeader
} from "./appIde/ToolArea/CommandPanel";
import {
  OutputPanel,
  OutputPanelHeader
} from "./appIde/ToolArea/OutputPanel";
import { createTapViewerPanel } from "./appIde/DocumentPanels/TapViewerPanel";
import { PsgPanel } from "./appIde/SideBarPanels/PsgPanel";
import { NecUpd765Panel } from "./appIde/SideBarPanels/NecUpd765Panel";
import { createDskViewerPanel } from "./appIde/DocumentPanels/DskViewerPanel";
import {
  MC_DISK_SUPPORT,
  MF_BLINK,
  MF_M6510,
  MF_PSG,
  MF_ULA,
  MF_VIC,
  MF_Z80,
  MI_ZXNEXT
} from "@common/machines/constants";
import { BlinkPanel } from "./appIde/SideBarPanels/BlinkPanel";
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
import { createSprFileEditorPanel } from "@renderer/features/sprite-editor/SprFileEditorPanel";
import { createVidFileViewerPanel } from "./appIde/DocumentPanels/Next/VidFileViewerPanel";
import { createBinFileViewerPanel } from "./appIde/DocumentPanels/BinFileViewerPanel";
import { createImageViewerPanel } from "./appIde/DocumentPanels/ImageViewerPanel";
import {
  createStaticMemoryDump,
  openStaticMemoryDump
} from "@renderer/features/memory/StaticMemoryDump";
import {
  createStaticDumpNavigationAdapter,
  disassemblyNavigationAdapter,
  memoryNavigationAdapter
} from "./appIde/navigation/addressNavigationAdapters";
import { readNexBankBytes } from "./appIde/DocumentPanels/Next/nexBankReveal";
import { fileDocumentNavigationAdapter } from "./appIde/navigation/fileDocumentNavigationAdapter";
import { ksxLanguageProvider } from "./appIde/project/ksxLanguageProvider";
import {
  PANE_ID_BUILD,
  PANE_ID_EMU,
  PANE_ID_SCRIPTIMG
} from "@common/integration/constants";
import { ScriptingHistoryPanel } from "./appIde/SideBarPanels/ScriptingHistoryPanel";
import { ScriptingHistoryBadge } from "./appIde/SideBarPanels/ScriptingHistoryBadge";
import { getScriptingContextMenuIfo, scriptingCommandBarRenderer } from "@renderer/features/documents/ScriptingCommandBar";
import {
  getNexLaunchContextMenuInfo,
  nexLaunchCommandBarRenderer
} from "@renderer/features/documents/NexLaunchContextMenu";
import { createScriptOutputPanel } from "./appIde/DocumentPanels/ScriptOutputPanel";
import { createBankedDisassemblyPanel } from "./appIde/DocumentPanels/DisassemblyPanel";
import { createMemoryPanel } from "@renderer/features/memory/MemoryPanel";
import { createUnknownFileViewerPanel } from "./appIde/DocumentPanels/UnknownFileViewerPanel";
import { NextRegPanel } from "./appIde/SideBarPanels/NextRegPanel";
import { MemMappingPanel } from "./appIde/SideBarPanels/MemMappingPanel";
import { CallStackPanel } from "./appIde/SideBarPanels/CallStackPanel";
import { PalettePanel } from "./appIde/SideBarPanels/PalettePanel";
import { sjasmZ80LanguageProvider } from "./appIde/project/sjasmZ80LanguageProvider";
import { M6510CpuPanel } from "./appIde/SideBarPanels/M6510CpuPanel";
import { asm6510LanguageProvider } from "./appIde/project/asm6510LanguageProvider";
import { VicPanel } from "./appIde/SideBarPanels/VicPanel";
import { WatchPanel } from "./appIde/SideBarPanels/WatchPanel";
import { turboPascalLanguageProvider } from "./appIde/project/turboPascalLanguageProvider";

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
    id: "openEditorsPanel",
    title: "Open Editors",
    hostActivity: ACTIVITY_FILE_ID,
    renderer: OpenEditorsPanel,
    badge: OpenEditorsBadge,
    // Collapsed until asked for: the project tree is what the file activity is opened for, and a
    // second expanded panel above it would push the tree down for everyone. The badge keeps the
    // open-editor count visible while the panel stays shut.
    expandedOnInit: false,
    initialSize: 300
  },
  {
    id: "explorerPanel",
    title: "Klive Project",
    hostActivity: ACTIVITY_FILE_ID,
    renderer: ExplorerPanel,
    expandedOnInit: true
  },
  {
    id: "z80CpuPanel",
    title: "Z80 CPU",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: Z80CpuPanel,
    expandedOnInit: true,
    requireFeature: [MF_Z80]
  },
  {
    id: "m6510CpuPanel",
    title: "6510 CPU",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: M6510CpuPanel,
    expandedOnInit: true,
    requireFeature: [MF_M6510]
  },
  {
    id: "callStackPanel",
    title: "Call Stack",
    hostActivity: ACTIVITY_DEBUG_ID,
    useScrollViewer: false,
    renderer: CallStackPanel,
  },
  {
    id: "nextMemoryMappingPanel",
    title: "Next Memory Mapping",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: MemMappingPanel,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "nextRegPanel",
    title: "Next Registers",
    hostActivity: ACTIVITY_DEBUG_ID,
    useScrollViewer: false,
    renderer: NextRegPanel,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "ulaPanel",
    title: "ULA & I/O",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: UlaPanel,
    initialSize: 500,
    requireFeature: [MF_ULA]
  },
  {
    id: "vicPanel",
    title: "VIC",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: VicPanel,
    initialSize: 500,
    requireFeature: [MF_VIC]
  },
  {
    id: "blinkPanel",
    title: "BLINK",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: BlinkPanel,
    initialSize: 500,
    requireFeature: [MF_BLINK]
  },
  {
    id: "watchPanel",
    title: "Watch",
    hostActivity: ACTIVITY_DEBUG_ID,
    useScrollViewer: false,
    renderer: WatchPanel,
    badge: WatchBadge,
    expandedOnInit: true
  },
  {
    id: "breakpointsPanel",
    title: "Breakpoints",
    hostActivity: ACTIVITY_DEBUG_ID,
    useScrollViewer: false,
    renderer: BreakpointsPanel,
    badge: BreakpointsBadge,
    expandedOnInit: true
  },
  {
    id: "sysVarsPanel",
    title: "System Variables",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    useScrollViewer: false,
    renderer: SysVarsPanel
  },
  {
    id: "psgPanel",
    title: "PSG (AY-3-8912)",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: PsgPanel,
    initialSize: 500,
    requireFeature: [MF_PSG]
  },
  {
    id: "necUpd765Panel",
    title: "NEC UPD 765 Log",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: NecUpd765Panel,
    initialSize: 500,
    // Renders a VirtualizedList, which brings its own ScrollViewer.
    useScrollViewer: false,
    requireConfig: [MC_DISK_SUPPORT]
  },
  {
    id: "nextPalettePanel",
    title: "Next Palettes",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    renderer: PalettePanel,
    restrictTo: [MI_ZXNEXT]
  },
  {
    id: "scriptingHistory",
    title: "Scripting History",
    hostActivity: ACTIVITY_SCRIPTING_ID,
    renderer: ScriptingHistoryPanel,
    badge: ScriptingHistoryBadge,
    initialSize: 500,
    // Renders a VirtualizedList, which brings its own ScrollViewer.
    useScrollViewer: false
  },
];

// --- Set up tool panels
export const toolPanelRegistry: ToolRendererInfo[] = [
  {
    id: "commands",
    name: "Commands",
    renderer: CommandPanel,
    headerRenderer: CommandPanelHeader
  },
  {
    id: "output",
    name: "Output",
    renderer: OutputPanel,
    headerRenderer: OutputPanelHeader
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
    renderer: createCodeEditorPanel,
    navigation: textNavigationAdapter
  },
  {
    id: TEXT_EDITOR,
    renderer: createTextEditorPanel,
    icon: "note",
    navigation: textNavigationAdapter
  },
  {
    id: DISASSEMBLY_EDITOR,
    renderer: createBankedDisassemblyPanel,
    icon: "disassembly-icon",
    navigation: disassemblyNavigationAdapter
  },
  {
    id: MEMORY_EDITOR,
    renderer: createMemoryPanel,
    icon: "memory-icon",
    navigation: memoryNavigationAdapter
  },
  {
    id: BASIC_EDITOR,
    renderer: createBasicPanel,
    icon: "code"
  },
  {
    id: COMMAND_RESULT_EDITOR,
    renderer: createCommandResultPanel,
    icon: "code"
  },
  {
    id: STATIC_MEMORY_DUMP_VIEWER,
    renderer: createStaticMemoryDump,
    icon: "memory-icon",
    navigation: createStaticDumpNavigationAdapter({ openStaticMemoryDump, readNexBankBytes })
  },
  {
    id: TAP_VIEWER,
    renderer: createTapViewerPanel,
    icon: "@file-tap-tzx"
  },
  {
    id: DSK_VIEWER,
    renderer: createDskViewerPanel,
    icon: "floppy"
  },
  {
    id: NEX_VIEWER,
    renderer: createNexFileViewerPanel,
    icon: "chip",
    navigation: fileDocumentNavigationAdapter
  },
  {
    id: Z80_VIEWER,
    renderer: createZ80FileViewerPanel,
    icon: "chip"
  },
  {
    id: SNA_VIEWER,
    renderer: createSnaFileViewerPanel,
    icon: "chip"
  },
  {
    id: SCR_VIEWER,
    renderer: createScrFileViewerPanel,
    icon: "vm"
  },
  {
    id: SHC_VIEWER,
    renderer: createShcFileViewerPanel,
    icon: "vm"
  },
  {
    id: SHR_VIEWER,
    renderer: createShrFileViewerPanel,
    icon: "vm"
  },
  {
    id: SLR_VIEWER,
    renderer: createSlrFileViewerPanel,
    icon: "vm"
  },
  {
    id: SL2_VIEWER,
    renderer: createSl2FileViewerPanel,
    icon: "vm"
  },
  {
    id: PAL_EDITOR,
    renderer: createPalFileEditorPanel,
    icon: "palette"
  },
  {
    id: NPL_EDITOR,
    renderer: createPalFileEditorPanel,
    icon: "palette"
  },
  {
    id: NXI_EDITOR,
    renderer: createNxiFileEditorPanel,
    icon: "layers"
  },
  {
    id: SPR_EDITOR,
    renderer: createSprFileEditorPanel,
    icon: "sprite"
  },
  {
    id: VID_VIEWER,
    renderer: createVidFileViewerPanel,
    icon: "video"
  },
  {
    id: BIN_VIEWER,
    renderer: createBinFileViewerPanel,
    icon: "file-code"
  },
  {
    id: IMAGE_VIEWER,
    renderer: createImageViewerPanel,
    icon: "preview"
  },
  {
    id: SCRIPT_OUTPUT_VIEWER,
    renderer: createScriptOutputPanel,
    icon: "note"
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
    icon: "file-project"
  },
  {
    matchType: "full",
    pattern: BUILD_FILE,
    editor: CODE_EDITOR,
    subType: "ksx",
    icon: "combine"
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
    icon: "file-kz80-asm"
  },
  {
    matchType: "ends",
    pattern: ".6510.asm",
    editor: CODE_EDITOR,
    subType: "6510-asm",
    icon: "@file-6510-asm"
  },
  {
    matchType: "ends",
    pattern: ".sjasm",
    editor: CODE_EDITOR,
    subType: "sjasmp",
    canBeBuildRoot: true,
    icon: "file-sjasmp"
  },
  {
    matchType: "ends",
    pattern: ".asm",
    editor: CODE_EDITOR,
    subType: "kz80-asm",
    canBeBuildRoot: true,
    icon: "file-kz80-asm"
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
    icon: "file-zxbas"
  },
  {
    matchType: "ends",
    pattern: ".bas",
    editor: CODE_EDITOR,
    subType: "zxbas",
    icon: "file-zxbas"
  },
  {
    matchType: "ends",
    pattern: ".pas",
    editor: CODE_EDITOR,
    subType: "pasta80",
    icon: "@file-text-txt"
  },
  {
    matchType: "ends",
    pattern: ".txt",
    editor: TEXT_EDITOR,
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
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".nex.dis",
    editor: CODE_EDITOR,
    subType: "json",
    icon: "note",
    isReadOnly: true
  },
  {
    matchType: "ends",
    pattern: ".nex",
    editor: NEX_VIEWER,
    icon: "chip",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true,
    documentTabRenderer: nexLaunchCommandBarRenderer,
    contextMenuInfo: getNexLaunchContextMenuInfo
  },
  /*
   * Re-enabled in Phase 37, after six months dark.
   *
   * This entry went in live in January 2024 and was commented out in March 2026 by the experimental
   * PASTA/80 integration — a Pascal-compiler feature with no relationship to snapshot viewing, whose
   * compiler writes a `<stem>.z80` temp file beside its `.bin` and deletes it again unless the user
   * has opted into `pasta80.keepTempFiles`. So the collision it avoided affects only that opt-in,
   * and it cost every user the viewer for the most widely supported ZX Spectrum snapshot format
   * there is — 913 lines of complete, working parser that nothing could reach.
   *
   * If that temp file turns out not to be a snapshot, `loadZ80FileContents` now says so rather than
   * throwing: its length guard is the other half of this change.
   */
  {
    matchType: "ends",
    pattern: ".z80",
    editor: Z80_VIEWER,
    icon: "chip",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".sna",
    editor: SNA_VIEWER,
    icon: "chip",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".scr",
    editor: SCR_VIEWER,
    icon: "vm",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".shc",
    editor: SHC_VIEWER,
    icon: "vm",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".shr",
    editor: SHR_VIEWER,
    icon: "vm",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".slr",
    editor: SLR_VIEWER,
    icon: "vm",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".sl2",
    editor: SL2_VIEWER,
    icon: "vm",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".pal",
    editor: PAL_EDITOR,
    icon: "palette",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".npl",
    editor: NPL_EDITOR,
    icon: "palette",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".nxi",
    editor: NXI_EDITOR,
    icon: "layers",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".spr",
    editor: SPR_EDITOR,
    icon: "sprite",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".vid",
    editor: VID_VIEWER,
    icon: "video",
    isBinary: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".bin",
    editor: BIN_VIEWER,
    icon: "file-code",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".rom",
    editor: BIN_VIEWER,
    icon: "file-code",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".png",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".jpg",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".jpeg",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".gif",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".bmp",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".webp",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".ico",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".svg",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".tiff",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },
  {
    matchType: "ends",
    pattern: ".tif",
    editor: IMAGE_VIEWER,
    icon: "preview",
    isBinary: true,
    isReadOnly: true,
    openPermanent: true
  },];

export const unknownFileType: FileTypeEditor = {
  pattern: "*",
  editor: UNKNOWN_EDITOR,
  icon: "code"
};

// --- Supported custom languages
export const customLanguagesRegistry: MonacoAwareCustomLanguageInfo[] = [
  asmKz80LanguageProvider,
  asmZxbLanguageProvider,
  zxBasLanguageProvider,
  ksxLanguageProvider,
  sjasmZ80LanguageProvider,
  asm6510LanguageProvider,
  turboPascalLanguageProvider,
];
