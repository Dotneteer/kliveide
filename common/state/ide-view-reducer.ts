import { Action } from "./Action";
import { IdeView } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
 export function ideViewReducer(state: IdeView, {type, payload}: Action): IdeView {
    switch (type) {
        case "SET_ACTIVITY":
            return {...state, activity: payload?.id}
        case "SET_SIDEBAR_PANEL_EXPANDED":
            return {...state, 
                sideBarPanels: {
                    ...state.sideBarPanels, 
                    [payload.id]: {...state.sideBarPanels[payload.id], expanded: payload.flag} 
                }
            }
        case "SET_SIDEBAR_PANELS_STATE":
            return {...state, 
                sideBarPanels: {
                    ...state.sideBarPanels,
                    ...payload.panelsState
                }
            }
        case "SET_SIDEBAR_PANEL_SIZE":
            return {...state, 
                sideBarPanels: {
                    ...state.sideBarPanels, 
                    [payload.id]: {...state.sideBarPanels[payload.id], size: payload.size},
                    [payload.nextId]: {...state.sideBarPanels[payload.nextId], size: payload.nextSize},
                }
            }
        default:
            return state;
    }
}