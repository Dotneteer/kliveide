import { createAction, SpectNetAction } from "./redux-core";
import { RegisterData } from "../machines/api-data";
import { VmInfo } from "./AppState";

export function vmSetRegistersAction(registers: RegisterData) {
  return createAction("VM_SET_REGISTERS", { registers });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function vmInfoStateReducer(
  state: VmInfo = {},
  { type, payload }: SpectNetAction
): VmInfo {
  switch (type) {
    case "VM_SET_REGISTERS":
      return {
        ...state,
        registers: payload.registers,
      };
    case "EMULATOR_SETUP_TYPE":
      return { ...state, registers: null };
  }
  return state;
}
