import { BreakpointDefinition } from "@abstractions/code-runner-service";
import { addBreakpoint, removeBreakpoint } from "../../renderer/ide/debug-helpers";
import { DebuggerState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const clearBreakpointsAction: ActionCreator = () => ({
  type: "CLEAR_BREAKPOINTS",
});
export const addBreakpointAction: ActionCreator = (
  breakpoint: BreakpointDefinition
) => ({
  type: "ADD_BREAKPOINT",
  payload: { breakpoint },
});
export const removeBreakpointAction: ActionCreator = (
  breakpoint: BreakpointDefinition
) => ({
  type: "REMOVE_BREAKPOINT",
  payload: { breakpoint },
});

// ============================================================================
// Reducer

const initialState: DebuggerState = {
  breakpoints: []
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): DebuggerState {
  switch (type) {
    case "CLEAR_BREAKPOINTS":
      return {
        ...state,
        breakpoints: []
      };
    case "ADD_BREAKPOINT":
      return {
        ...state,
        breakpoints: addBreakpoint(state.breakpoints, payload.breakpoint)
      };
      case "REMOVE_BREAKPOINT":
        return {
          ...state,
          breakpoints: removeBreakpoint(state.breakpoints, payload.breakpoint)
        };
      default:
      return state;
  }
}
