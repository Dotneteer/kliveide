import {
  DISASSEMBLY_EDITOR,
  MEMORY_EDITOR,
  BASIC_EDITOR,
  COMMAND_RESULT_EDITOR,
  CODE_EDITOR
} from "@common/state/common-ids";
import { MachineInfo } from "./abstractions/MachineInfo";
import { Activity } from "./appIde/abstractions/Activity";
import { DocumentRendererInfo } from "./appIde/abstractions/DocumentRendererInfo";
import { FileTypeEditor } from "./appIde/abstractions/FileTypePattern";
import { OutputPaneInfo } from "./appIde/abstractions/OutputPaneInfo";
import { SideBarPanelInfo } from "./appIde/abstractions/SideBarPanelInfo";
import { ToolRendererInfo } from "./appIde/abstractions/ToolRendererInfo";
import { createBasicPanel } from "./appIde/DocumentPanels/BasicPanel";
import { createCodeEditorPanel } from "./appIde/DocumentPanels/CodeEditorPanel";
import { createCommandResultPanel } from "./appIde/DocumentPanels/CommandResult";
import { createDisassemblyPanel } from "./appIde/DocumentPanels/DisassemblyPanel";
import { createMemoryPanel } from "./appIde/DocumentPanels/MemoryPanel";
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
import { ZxSpectrum48Machine } from "./emu/machines/zxSpectrum48/ZxSpectrum48Machine";

const ACTIVITY_FILE_ID = "file-view";
const ACTIVITY_DEBUG_ID = "debug-view";
const ACTIVITY_MACHINE_INFO_ID = "log-view";
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
    id: "ulaPanel",
    title: "ULA",
    hostActivity: ACTIVITY_DEBUG_ID,
    renderer: ulaPanelRenderer,
    initialSize: 500
  },
  {
    id: "breakpointsPanel",
    title: "Breakpoints",
    hostActivity: ACTIVITY_DEBUG_ID,
    noScrollViewer: false,
    renderer: breakpointsPanelRenderer
  },
  {
    id: "sysVarsPanel",
    title: "System Variables",
    hostActivity: ACTIVITY_MACHINE_INFO_ID,
    noScrollViewer: false,
    renderer: sysVarsPanelRenderer
  }
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
    id: "emu",
    displayName: "Emulator"
  },
  {
    id: "build",
    displayName: "Build"
  }
];

// --- Set up document panel renderers
export const documentPanelRegistry: DocumentRendererInfo[] = [
  {
    id: CODE_EDITOR,
    renderer: createCodeEditorPanel
  },
  {
    id: DISASSEMBLY_EDITOR,
    renderer: createDisassemblyPanel,
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
  }
];

// --- Set up machine type registry
export const machineRegistry: MachineInfo[] = [
  {
    machineId: "sp48",
    displayName: "ZX Spectrum 48K",
    factory: () => new ZxSpectrum48Machine()
  }
];

// --- The registry of ile types
export const fileTypeRegistry: FileTypeEditor[] = [
  {
    matchType: "full",
    pattern:"klive.project",
    editor: CODE_EDITOR,
    subType: "json",
    icon: "@file-project"
  },
  {
    matchType: "ends",
    pattern:".kz80.asm",
    editor: CODE_EDITOR,
    subType: "",
    icon: "@file-kz80-asm"
  },
  {
    matchType: "ends",
    pattern:".zxb.asm",
    editor: CODE_EDITOR,
    subType: "",
    icon: "@file-zxb-asm"
  },
  {
    matchType: "ends",
    pattern:".zxbas",
    editor: CODE_EDITOR,
    subType: "",
    icon: "@file-zxbas"
  },
]
