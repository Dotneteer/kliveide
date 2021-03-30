import emuLoadReducer from "./emu-loaded-reducer";
import ideLoadReducer from "./ide-loaded-reducer";
import themeReducer from "./theme-reducer";
import emuViewOptionsReducer from "./emu-view-options-reducer";

/**
 * Represents the reducers
 */
export const appReducers = {
  emuUiLoaded: emuLoadReducer,
  ideUiLoaded: ideLoadReducer,
  theme: themeReducer,
  emuViewOptions: emuViewOptionsReducer
};
