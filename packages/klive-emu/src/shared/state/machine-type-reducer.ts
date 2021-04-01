import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const setMachineTypeAction: ActionCreator = (machineType: string) => ({
  type: "EMU_SET_MACINE_TYPE",
  payload: { machineType },
});

// ============================================================================
// Reducer

const initialState = "";

export default function (
  state = initialState,
  { type, payload }: KliveAction
): string {
  switch (type) {
    case "EMU_SET_MACINE_TYPE":
      return payload.machineType;
    default:
      return state;
  }
}
