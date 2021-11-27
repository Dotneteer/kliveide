import { KliveCompilerOutput } from "@abstractions/compiler-registry";
import { CompilationState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const resetCompileAction: ActionCreator = () => ({
  type: "RESET_COMPILE",
});
export const startCompileAction: ActionCreator = (filename: string) => ({
  type: "START_COMPILE",
  payload: { filename },
});
export const endCompileAction: ActionCreator = (
  compileResult: KliveCompilerOutput,
  failed?: string
) => ({
  type: "END_COMPILE",
  payload: { compileResult, failed },
});

// ============================================================================
// Reducer

const initialState: CompilationState = {
  inProgress: false,
  filename: null,
  result: null,
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): CompilationState {
  switch (type) {
    case "START_COMPILE":
      return {
        ...state,
        inProgress: true,
        filename: payload.filename,
        result: null,
      };
    case "END_COMPILE":
      return {
        ...state,
        inProgress: false,
        result: payload.compileResult,
        failed: payload.failed,
      };
    case "RESET_COMPILE":
      return {
        inProgress: false,
        filename: null,
        result: null,
      };
    default:
      return state;
  }
}
