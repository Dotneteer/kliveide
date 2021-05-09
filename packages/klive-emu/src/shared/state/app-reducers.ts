import emuLoadReducer from "./emu-loaded-reducer";
import ideLoadReducer from "./ide-loaded-reducer";
import themeReducer from "./theme-reducer";
import emuViewOptionsReducer from "./emu-view-options-reducer";
import machineTypeReducer from "./machine-type-reducer";
import emulatorPanelReducer from "./emulator-panel-reducer";
import spectrumSpecificReducer from "./spectrum-specific-reducer";
import showIdeReducer from "./show-ide-reducer";
import activityBarReducer from "./activity-bar-reducer";

/**
 * Represents the reducers
 */
export const appReducers = {
  emuUiLoaded: emuLoadReducer,
  ideUiLoaded: ideLoadReducer,
  theme: themeReducer,
  emuViewOptions: emuViewOptionsReducer,
  machineType: machineTypeReducer,
  emulatorPanel: emulatorPanelReducer,
  spectrumSpecific: spectrumSpecificReducer,
  showIde: showIdeReducer,
  activityBar: activityBarReducer,
};
