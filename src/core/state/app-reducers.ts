import isWindowsReducer from "./is-windows-reducer";
import emuLoadReducer from "./emu-loaded-reducer";
import ideLoadReducer from "./ide-loaded-reducer";
import emuFocusReducer from "./emu-focus-reducer";
import ideFocusReducer from "./ide-focus-reducer";
import themeReducer from "./theme-reducer";
import emuViewOptionsReducer from "./emu-view-options-reducer";
import machineTypeReducer from "./machine-type-reducer";
import emulatorPanelReducer from "./emulator-panel-reducer";
import spectrumSpecificReducer from "./spectrum-specific-reducer";
import showIdeReducer from "./show-ide-reducer";
import activityBarReducer from "./activity-bar-reducer";
import sideBarReducer from "./side-bar-reducer";
import documentFrameReducer from "./document-frame-reducer";
import toolFrameReducer from "./tool-frame-reducer";
import machinesReducer from "./machines-reducer";
import modalReducer from "./modal-reducer";
import projectReducer from "./project-reducer";
import compilationReducer from "./compilation-reducer";
import debuggerReducer from "./debugger-reducer";
import builderReducer from "./builder-reducer";
import editorStatusReducer from "./editor-status-reducer";
import ideConfigReducer from "./ide-config-reducer";

/**
 * Represents the reducers
 */
export const appReducers = {
  isWindows: isWindowsReducer,
  emuUiLoaded: emuLoadReducer,
  ideUiLoaded: ideLoadReducer,
  emuHasFocus: emuFocusReducer,
  ideHasFocus: ideFocusReducer,
  modalDisplayed: modalReducer,
  theme: themeReducer,
  emuViewOptions: emuViewOptionsReducer,
  machineType: machineTypeReducer,
  emulatorPanel: emulatorPanelReducer,
  spectrumSpecific: spectrumSpecificReducer,
  showIde: showIdeReducer,
  activityBar: activityBarReducer,
  sideBar: sideBarReducer,
  documentFrame: documentFrameReducer,
  toolFrame: toolFrameReducer,
  project: projectReducer,
  machines: machinesReducer,
  compilation: compilationReducer,
  debugger: debuggerReducer,
  builder: builderReducer,
  editor: editorStatusReducer,
  ideConfig: ideConfigReducer,
};
