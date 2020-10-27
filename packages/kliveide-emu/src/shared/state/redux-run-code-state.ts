import { createAction, SpectNetAction } from "./redux-core";
import { CodeToInject } from "../spectrum/api-data";
import { RunProgramCommand } from "./AppState";

export function codeRunAction(codeToInject: CodeToInject, debug?: boolean) {
  return createAction("CODE_RUN", { codeToInject, debug });
}

export function codeRunResultAction(errorCode: string) {
  return createAction("CODE_RUN_RESULT", { errorCode });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function runCodeCommandStateReducer(
  state: RunProgramCommand = {},
  { type, payload }: SpectNetAction
): RunProgramCommand {
  switch (type) {
    case "CODE_RUN":
      return {
        codeToInject: payload.codeToInject,
        debug: payload.debug,
      };
    case "CODE_RUN_RESULT":
      return {
        errorCode: payload.errorCode,
      };
  }
  return state;
}
