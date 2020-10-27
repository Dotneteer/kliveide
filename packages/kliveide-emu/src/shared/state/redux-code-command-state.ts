import { createAction, SpectNetAction } from "./redux-core";
import { CodeToInject } from "../spectrum/api-data";
import { InjectProgramCommand } from "./AppState";

export function codeInjectAction(codeToInject: CodeToInject) {
  return createAction("CODE_INJECT", { codeToInject });
}

export function codeInjectResultAction(errorCode: string) {
  return createAction("CODE_INJECT_RESULT", { errorCode });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function injectCodeCommandStateReducer(
  state: InjectProgramCommand = {},
  { type, payload }: SpectNetAction
): InjectProgramCommand {
  switch (type) {
    case "CODE_INJECT":
      return {
        codeToInject: payload.codeToInject,
      };
    case "CODE_INJECT_RESULT":
      return {
        errorCode: payload.errorCode,
      };
  }
  return state;
}
