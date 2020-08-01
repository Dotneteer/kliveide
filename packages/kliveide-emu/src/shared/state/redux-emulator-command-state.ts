import { createAction, SpectNetAction } from "./redux-core";

export function emulatorSetCommandAction(command: string) {
  return createAction("EMULATOR_COMMAND", { command });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function emulatorCommandStateReducer(
  state: string = "",
  { type, payload }: SpectNetAction
): string {
  switch (type) {
    case "EMULATOR_COMMAND":
      return payload.command;
  }
  return state;
}
