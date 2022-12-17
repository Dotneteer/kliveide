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
      renderer: explorerPanelRenderer
    },
    {
      id: "cpuPanel",
      title: "CPU Panel",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: cpuPanelRenderer
    },
    {
      id: "ulaPanel",
      title: "ULA Panel",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: ulaPanelRenderer
    },
    {
      id: "breakpointsPanel",
      title: "Breakpoints",
      hostActivity: ACTIVITY_DEBUG_ID,
      renderer: breakpointsPanelRenderer
    },
  ]
  
  