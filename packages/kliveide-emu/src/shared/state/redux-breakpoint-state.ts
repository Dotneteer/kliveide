import { createAction, SpectNetAction } from "./redux-core";

export function breakpointSetAction(breakpoints: number[]) {
  return createAction("BREAKPOINT_SET", { breakpoints });
}

export function breakpointRemoveAction(breakpoints: number[]) {
  return createAction("BREAKPOINT_REMOVE", { breakpoints });
}

export const breakpointEraseAllAction = createAction("BREAKPOINT_ERASE_ALL");

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function breakpointsStateReducer(
  state: Set<number> = new Set<number>(),
  { type, payload }: SpectNetAction
): Set<number> {
  switch (type) {
    case "BREAKPOINT_SET":
      if (payload.breakpoints) {
        const newState = new Set<number>();
        for (const val of Array.from(state)) newState.add(val);
        for (const val of Array.from(payload.breakpoints)) newState.add(val);
        return newState;
      }
    case "BREAKPOINT_REMOVE":
      if (payload.breakpoints) {
        const newState = new Set<number>();
        for (const val of Array.from(state)) newState.add(val);
        for (const val of Array.from(payload.breakpoints)) newState.delete(val);
        return newState;
      }
    case "BREAKPOINT_ERASE_ALL":
      return new Set<number>();
  }
  return state;
}
