import { createAction, SpectNetAction } from "./redux-core";
import { VmInfo, IdeConfiguration } from "./AppState";

export function ideConfigSetAction(ideConfiguration: IdeConfiguration) {
  return createAction("IDE_CONFIG_SET", { ideConfiguration });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function ideConfigStateReducer(
  state: IdeConfiguration = {
    projectFolder: "",
    saveFolder: "",
  },
  { type, payload }: SpectNetAction
): IdeConfiguration {
  switch (type) {
    case "IDE_CONFIG_SET":
      return payload.ideConfiguration;
  }
  return state;
}
