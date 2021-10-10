import { CompilerOutput } from "@abstractions/z80-compiler-service";
import { CompilationState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const startCompileAction: ActionCreator = (filename: string) => ({
  type: "START_COMPILE",
  payload: { filename },
});
export const endCompileAction: ActionCreator = (
  compileResult: CompilerOutput
) => ({
  type: "END_COMPILE",
  payload: { compileResult },
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
        result: payload.compileResult
      };
    default:
      return state;
  }
}
