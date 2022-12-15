import { Action } from "./Action";
import { AppState } from "./AppState";

/**
 * This reducer is used to manage the AppState flags and simple properties
 */
export function appStateFlagsReducer(state: AppState, {type, payload}: Action): AppState {
    switch (type) {
        case "UI_LOADED":
            return {...state, uiLoaded: payload?.flag}
        case "SET_THEME":
            return {...state, theme: payload?.id}
        default:
            return state;
    }
}