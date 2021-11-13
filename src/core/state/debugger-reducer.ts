import { BreakpointDefinition } from "@abstractions/code-runner-service";
import {
  addBreakpoint,
  disableBreakpoint as makeUnreachableBreakpoint,
  makeReachableAllBreakpoints,
  makeReachableBreakpoint,
  normalizeBreakpoints,
  removeBreakpoint,
  removeSourceBreakpoints,
  scrollBreakpoints,
} from "@abstractions/debug-helpers";
import { DebuggerState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const clearBreakpointsAction: ActionCreator = () => ({
  type: "CLEAR_BREAKPOINTS",
});

export const removeSourceBreakpointsAction: ActionCreator = () => ({
  type: "REMOVE_SOURCE_BREAKPOINTS",
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

export const reachableBreakpointAction: ActionCreator = (
  breakpoint: BreakpointDefinition
) => ({
  type: "REACHABLE_BREAKPOINT",
  payload: { breakpoint },
});

export const unreachableBreakpointAction: ActionCreator = (
  breakpoint: BreakpointDefinition
) => ({
  type: "UNREACHABLE_BREAKPOINT",
  payload: { breakpoint },
});

export const makeReachableAllBreakpointsAction: ActionCreator = () => ({
  type: "ALL_REACHABLE_BREAKPOINTS",
});

export const scrollBreakpointsAction: ActionCreator = (
  breakpoint: BreakpointDefinition,
  shift: number
) => ({
  type: "SCROLL_BREAKPOINTS",
  payload: { breakpoint, shift },
});

export const normalizeBreakpointsAction: ActionCreator = (
  resource: string,
  lineCount: number
) => ({
  type: "NORMALIZE_BREAKPOINTS",
  payload: { resource, lineCount },
});

export const setResolvedBreakpointsAction: ActionCreator = (
  breakpoints: BreakpointDefinition[]
) => ({
  type: "SET_RESOLVED_BREAKPOINTS",
  payload: { breakpoints },
});

// ============================================================================
// Reducer

const initialState: DebuggerState = {
  breakpoints: [],
  resolved: [],
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): DebuggerState {
  switch (type) {
    case "CLEAR_BREAKPOINTS":
      return {
        ...state,
        breakpoints: [],
        resolved: [],
      };
    case "ADD_BREAKPOINT":
      return {
        ...state,
        breakpoints: addBreakpoint(state.breakpoints, payload.breakpoint),
      };
    case "REMOVE_BREAKPOINT":
      return {
        ...state,
        breakpoints: removeBreakpoint(state.breakpoints, payload.breakpoint),
      };
    case "REACHABLE_BREAKPOINT":
      return {
        ...state,
        breakpoints: makeReachableBreakpoint(
          state.breakpoints,
          payload.breakpoint
        ),
      };
    case "UNREACHABLE_BREAKPOINT":
      return {
        ...state,
        breakpoints: makeUnreachableBreakpoint(
          state.breakpoints,
          payload.breakpoint
        ),
      };
    case "ALL_REACHABLE_BREAKPOINTS":
      return {
        ...state,
        breakpoints: makeReachableAllBreakpoints(state.breakpoints),
      };
    case "SCROLL_BREAKPOINTS":
      return {
        ...state,
        breakpoints: scrollBreakpoints(
          state.breakpoints,
          payload.breakpoint,
          payload.shift
        ),
      };
    case "NORMALIZE_BREAKPOINTS":
      return {
        ...state,
        breakpoints: normalizeBreakpoints(
          state.breakpoints,
          payload.resource,
          payload.lineCount
        ),
      };
    case "SET_RESOLVED_BREAKPOINTS":
      return {
        ...state,
        resolved: payload.breakpoints,
      };
    case "REMOVE_SOURCE_BREAKPOINTS":
      return {
        ...state,
        breakpoints: removeSourceBreakpoints(state.breakpoints),
      };
    default:
      return state;
  }
}
