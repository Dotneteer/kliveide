import { Action } from "./Action";
import { IdeView } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
 export function ideViewReducer(state: IdeView, {type, payload}: Action): IdeView {
    switch (type) {
        case "SET_ACTIVITY":
            return {
                ...state, 
                activity: payload?.id
            }
        
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

        case "CREATE_DOC":
            const newDocs = (state.openDocuments ?? []).slice(0);
            newDocs.splice(payload.index, 0, payload.document);
            return {
                ...state, 
                openDocuments: newDocs, 
                activeDocumentIndex: payload.index
            };

        case "CHANGE_DOC":
                const changedDocs = (state.openDocuments ?? []).slice(0);
                changedDocs[payload.index] = payload.document
                return {
                    ...state, 
                    openDocuments: changedDocs, 
                };
    
        case "ACTIVATE_DOC":
            const index = state.openDocuments.findIndex(d => d.id === payload.id);
            return index >= 0 
            ? {
                ...state, 
                activeDocumentIndex: index
            } 
            : state;
        
        case "CLOSE_DOC":
            const closeIndex = state.openDocuments.findIndex(d => d.id === payload.id);
            if (closeIndex < 0) return state;
            const docsAfterRemove = (state.openDocuments ?? []).slice(0);
            docsAfterRemove.splice(closeIndex, 1);
            const newActive = docsAfterRemove.length === 0 ? -1 : Math.max(0, closeIndex - 1);
            return {
                ...state, 
                openDocuments: docsAfterRemove, 
                activeDocumentIndex: newActive
            }

        case "CLOSE_ALL_DOCS":
            return {
                ...state, 
                openDocuments: [], 
                activeDocumentIndex: -1
            }

        case "SET_TOOLS":
            return {
                ...state,
                tools: payload.tools
            }

        case "CHANGE_TOOL_STATE": {
            const changedTools = state.tools.splice(0) ?? [];
            const existingToolIndex = (changedTools).findIndex(t => t.id === payload.tool.id);
            if (existingToolIndex >= 0) {
                changedTools[existingToolIndex] = payload.tool;
                return {
                    ...state,
                    tools: changedTools
                }
            }
            return state;
        }

        case "CHANGE_TOOL_VISIBILITY": {
            const changedTools = state.tools.splice(0) ?? [];
            const existingToolIndex = (changedTools).findIndex(t => t.id === payload.id);
            if (existingToolIndex >= 0) {
                changedTools[existingToolIndex].visible = payload.flag;
                return {
                    ...state,
                    tools: changedTools
                }
            }
            return state;
        }
    
        case "ACTIVATE_TOOL": {
            return {
                ...state,
                activeTool: payload.id
            }
        }
    
        default:
            return state;
    }
}