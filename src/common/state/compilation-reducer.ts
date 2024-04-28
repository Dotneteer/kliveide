import { Action } from "./Action";
import { CompilationState } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
export function compilationReducer(
  state: CompilationState,
  { type, payload }: Action
): CompilationState {
  switch (type) {
    case "RESET_COMPILE":
      return {
        ...state,
        inProgress: false,
        failed: undefined,
        result: undefined
      };

    case "START_COMPILE":
      return {
        ...state,
        inProgress: true,
        result: undefined
      };

    case "END_COMPILE":
      return {
        ...state,
        inProgress: false,
        result: payload?.compileResult,
        failed: payload?.failed
      };

    case "INC_INJECTION_VERSION":
      return {
        ...state,
        injectionVersion: (state.injectionVersion ?? 0) + 1
      };

    default:
      return state;
  }
}
