import { createAction, SpectNetAction } from "./redux-core";
import { CodeToInject } from "../spectrum/api-data";
import { InjectCommand } from "./AppState";

export function codeInjectAction(codeToInject: CodeToInject) {
  return createAction("CODE_INJECT", { codeToInject });
}

export function codeInjectResultAction(success: boolean, errorCode?: string) {
  return createAction("CODE_INJECT", { success, errorCode });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function injectCodeCommandStateReducer(
  state: InjectCommand = {},
  { type, payload }: SpectNetAction
): InjectCommand {
  switch (type) {
    case "CODE_INJECT":
      return {
        codeToInject: payload.codeToInject,
      };
    case "CODE_INJECT_RESULT":
      return {
        success: payload.success,
        errorCode: payload.errorCode,
      };
  }
  return state;
}
