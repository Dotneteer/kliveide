import { ActionTypes } from "./ActionTypes"
import { SideBarPanelState } from "./AppState";

/**
 * Available action types you can use with state manangement
 */
export type Action = {
    /**
     * Action type
     */
    type: keyof ActionTypes,

    /**
     * Optional payload
     */
    payload?: Partial<Payload>
}

/**
 * Payload properties
 */
export type Payload = {
    flag: boolean;
    id: string;
    size: number;
    nextId: string;
    nextSize: number;
    panelsState: Record<string, SideBarPanelState>
}

/**
 * Use this function to create concrete actions
 */
export type ActionCreator = (...args: any) => Action;