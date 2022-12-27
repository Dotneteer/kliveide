import { 
    Activity, 
    ACTIVITY_DEBUG_ID, 
    ACTIVITY_FILE_ID, 
    ACTIVITY_LOG_ID, 
    ACTIVITY_TEST_ID, 
    SideBarPanelInfo 
} from "./core/abstractions";
import { cpuPanelRenderer } from "./ide/CpuPanel";
import { explorerPanelRenderer } from "./ide/ExplorerPanel";
import { ulaPanelRenderer } from "./ide/UlaPanel";
import { breakpointsPanelRenderer } from "./ide/BreakpointsPanel";
import { MachineInfo, ToolRendereInfo } from "./ide/abstractions";
import { outputPanelRenderer } from "./controls/ToolArea/OutputPanel";
import { ZxSpectrum48Machine } from "./emu/machines/zxSpectrum48/ZxSpectrum48Machine";

// --- Set up activities
export const activityRegistry: Activity[] = [
    {
      id: ACTIVITY_FILE_ID,
      title: "Explorer",
      iconName: "files",
    },
    {
      id: ACTIVITY_DEBUG_ID,
      title: "Debug",
      iconName: "debug-alt",
    },
    {
      id: ACTIVITY_LOG_ID,
      title: "Machine logs",
      iconName: "output",
    },
    {
      id: ACTIVITY_TEST_ID,
      title: "Testing",
      iconName: "beaker",
    },
  ];
  
// --- Set up side bar panels
export const sideBarPanelRegistry: SideBarPanelInfo[] = [
    {
      id: "explorerPanel",
      title: "Explorer Panel",
      hostActivity: ACTIVITY_FILE_ID,
      renderer: explorerPanelRenderer,
      expandedOnInit: true,
    },
    {
      id: "cpuPanel",
      title: "CPU Panel",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: cpuPanelRenderer,
      expandedOnInit: true
    },
    {
      id: "ulaPanel",
      title: "ULA Panel",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: ulaPanelRenderer,
      initialSize: 500
    },
    {
      id: "breakpointsPanel",
      title: "Breakpoints",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: breakpointsPanelRenderer
    },
  ]
  
// --- Set up tool panels
export const toolPanelRegistry: ToolRendereInfo[] = [
  {
    id: "output",
    name: "Output",
    renderer: outputPanelRenderer
  },
  {
    id: "commands",
    name: "Commands",
    renderer: outputPanelRenderer
  },
]

// --- Set up machine type registry
export const machineRegistry: MachineInfo[] = [
  {
    machineId: "sp48",
    displayName: "ZX Spectrum 48K",
    factory: () => new ZxSpectrum48Machine()
  }
]