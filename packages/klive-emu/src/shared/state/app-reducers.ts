import emuLoadReducer from "./emu-loaded-reducer";
import ideLoadReducer from "./ide-loaded-reducer";

/**
 * Represents the reducers
 */
export const appReducers = {
    emuUiLoaded: emuLoadReducer,
    ideUiLoaded: ideLoadReducer,
}
