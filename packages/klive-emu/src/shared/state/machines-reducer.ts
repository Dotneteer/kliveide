import { RegisteredMachine } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const registerMachineTypeAction: ActionCreator = (
  machine: RegisteredMachine
) => ({
  type: "REGISTER_MACHINE",
  payload: { machine },
});

// ============================================================================
// Reducer

const initialState: RegisteredMachine[] = [];

export default function (
  state = initialState,
  { type, payload }: KliveAction
): RegisteredMachine[] {
  switch (type) {
    case "REGISTER_MACHINE":
      return [...state, payload.machine];
    default:
      return state;
  }
}
