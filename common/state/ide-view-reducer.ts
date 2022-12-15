import { Action } from "./Action";
import { IdeView } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
 export function ideViewReducer(state: IdeView, {type, payload}: Action): IdeView {
    switch (type) {
        case "SET_ACTIVITY":
            return {...state, activity: payload?.id}
        default:
            return state;
    }
}