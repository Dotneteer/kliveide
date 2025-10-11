import { Action } from "./Action";
import { WatchpointInfo } from "./AppState";

/**
 * This reducer is used to manage watchpoints
 */
export function watchpointsReducer(
  state: WatchpointInfo[] = [],
  { type, payload }: Action
): WatchpointInfo[] {
  switch (type) {
    case "ADD_WATCHPOINT":
      if (!payload?.watchpoint) return state;
      
      // Check if watchpoint with this symbol already exists
      const existingIndex = state.findIndex(wp => wp.symbol === payload.watchpoint.symbol);
      if (existingIndex >= 0) {
        // Update existing watchpoint
        const newState = [...state];
        newState[existingIndex] = payload.watchpoint;
        return newState;
      } else {
        // Add new watchpoint
        return [...state, payload.watchpoint];
      }

    case "REMOVE_WATCHPOINT":
      if (!payload?.symbol) return state;
      return state.filter(wp => wp.symbol !== payload.symbol);

    case "CLEAR_WATCHPOINTS":
      return [];

    default:
      return state;
  }
}