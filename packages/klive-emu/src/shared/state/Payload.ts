import { Activity } from "../activity/Activity";
import {
  AppState,
  DocumentFrameState,
  FrameDiagData,
  SideBarState,
} from "./AppState";

/**
 * Represents payload properties
 */
export interface Payload {
  theme?: string;
  machineType?: string;
  width?: number;
  height?: number;
  executionState?: number;
  startCount?: number;
  frameCount?: number;
  runsInDebug?: boolean;
  panelMessage?: string;
  soundLevel?: number;
  clockMultiplier?: number;
  keyboardLayout?: string;
  machineContext?: string;
  keyboardHeight?: number;
  fastLoad?: boolean;
  showBeamPosition?: boolean;
  tapeContents?: Uint8Array;
  firmware?: Uint8Array[];
  tapeLoaded?: boolean;
  loadMode?: boolean;
  extraFeatures?: string[];
  baseClockFrequency?: number;
  frameDiagData?: FrameDiagData;
  appState?: AppState;
  activities?: Activity[];
  itemIndex?: number;
  sideBar?: SideBarState;
  documentFrame?: DocumentFrameState;
  hasFocus?: boolean;
  visible?: boolean;
  maximized?: boolean;
  toolState?: Record<string, Record<string, any>>;
  isWindows?: boolean;
}
