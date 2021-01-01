import { createAction, createLocalAction, SpectNetAction } from "./redux-core";

export function machineCommandAction(machineCommand?: string) {
  return createAction("MACHINE_COMMAND", { machineCommand: machineCommand ?? "" });
}

/**
 * This reducer manages machine command state changes
 * @param state Input state
 * @param action Action executed
 */
export function machineCommandStateReducer(
  state: string = "",
  { type, payload }: SpectNetAction
): string {
  switch (type) {
    case "MACHINE_COMMAND":
      return payload.machineCommand;
  }
  return state;
}
