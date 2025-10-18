import { Action } from "./Action";
import { WatchInfo } from "./AppState";

/**
 * This reducer is used to manage watch expressions
 */
export function watchReducer(
  state: WatchInfo[] = [],
  { type, payload }: Action
): WatchInfo[] {
  switch (type) {
    case "ADD_WATCH":
      if (!payload?.watch) return state;
      
      // Check if watch expression with this symbol already exists
      const existingIndex = state.findIndex(w => w.symbol === payload.watch.symbol);
      if (existingIndex >= 0) {
        // Update existing watch expression
        const newState = [...state];
        newState[existingIndex] = payload.watch;
        return newState;
      } else {
        // Add new watch expression
        return [...state, payload.watch];
      }

    case "REMOVE_WATCH":
      if (!payload?.symbol) return state;
      return state.filter(w => w.symbol.toLowerCase() !== payload.symbol.toLowerCase());

    case "CLEAR_WATCH":
      return [];

    default:
      return state;
  }
}