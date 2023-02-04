import {
  Activity,
  ACTIVITY_DEBUG_ID,
  ACTIVITY_FILE_ID,
  ACTIVITY_LOG_ID,
  ACTIVITY_TEST_ID,
  SideBarPanelInfo
} from "./core/abstractions";
import { cpuPanelRenderer } from "./appIde/SiteBarPanels/CpuPanel";
import { explorerPanelRenderer } from "./appIde/SiteBarPanels/ExplorerPanel";
import { ulaPanelRenderer } from "./appIde/SiteBarPanels/UlaPanel";
import { breakpointsPanelRenderer } from "./appIde/SiteBarPanels/BreakpointsPanel";
import {
  DocumentRendererInfo,
  MachineInfo,
  OutputPaneInfo,
  ToolRendererInfo
} from "./appIde/abstractions";
import {
  outputPanelHeaderRenderer,
  outputPanelRenderer
} from "./appIde/ToolArea/OutputPanel";
import { ZxSpectrum48Machine } from "./emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import {
  commandPanelHeaderRenderer,
  commandPanelRenderer
} from "./appIde/ToolArea/CommandPanel";
import { createCodeEditorPanel } from "./appIde/DocumentPanels/CodeEditorPanel";
import { createDisassemblyPanel } from "./appIde/DocumentPanels/DisassemblyPanel";
import {
  BASIC_EDITOR,
  DISASSEMBLY_EDITOR,
  MEMORY_EDITOR,
  COMMAND_RESULT_EDITOR
} from "@state/common-ids";
import { createMemoryPanel } from "./appIde/DocumentPanels/MemoryPanel";
import { createBasicPanel } from "./appIde/DocumentPanels/BasicPanel";
import { createCommandResultPanel } from "./appIde/DocumentPanels/CommandResult";

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
    id: ACTIVITY_LOG_ID,
    title: "Machine logs",
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
    title: "Explorer Panel",
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
    id: "CodeEditor",
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
