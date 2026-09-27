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

    // --- Replaces the whole list, which is how a project's saved watches are restored. An absent
    // --- payload means "this project has none", so it clears rather than keeping the previous
    // --- project's watches around.
    case "SET_WATCHES":
      return payload?.watches ?? [];

    default:
      return state;
  }
}

/** The BASIC watch expressions of the Variables panel (plan §10.8). */
export function basicWatchReducer(state: string[] = [], { type, payload }: Action): string[] {
  switch (type) {
    case "ADD_BASIC_WATCH": {
      const text = payload?.text?.trim();
      return !text || state.includes(text) ? state : [...state, text];
    }
    case "REMOVE_BASIC_WATCH":
      return payload?.index === undefined ? state : state.filter((_, i) => i !== payload.index);
    case "SET_BASIC_WATCHES":
      return payload?.value ?? [];
    default:
      return state;
  }
}