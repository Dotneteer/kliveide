import { MachineControllerState } from "../abstractions/MachineControllerState";
import type { MachineCommand } from "../abstractions/MachineCommand";
import type { Action } from "./Action";
import type { EmulatorState } from "./AppState";

export function emulatorStateReducer(state: EmulatorState, { type, payload }: Action): EmulatorState {
  switch (type) {
    case "SET_MACHINE_TYPE":
      return {
        ...state,
        machineId: payload?.id,
        modelId: payload?.nextId,
        config: payload?.value ?? {},
        machineState: MachineControllerState.None,
        pcValue: 0,
        isDebugging: false,
        sp48FrameInfo: undefined
      };

    case "SET_MACHINE_STATE":
      return {
        ...state,
        machineState: payload?.state,
        isDebugging:
          payload?.state === MachineControllerState.Stopped || payload?.state === MachineControllerState.None
            ? false
            : state.isDebugging,
        pcValue: payload?.numValue
      };

    case "ISSUE_MACHINE_COMMAND":
      return {
        ...state,
        lastMachineCommand: payload?.id as MachineCommand | undefined,
        machineCommandSequence: (state.machineCommandSequence ?? 0) + 1
      };

    case "SET_SP48_FRAME_INFO":
      return {
        ...state,
        sp48FrameInfo: payload?.value
      };

    case "MUTE_SOUND":
      return {
        ...state,
        soundMuted: payload?.flag,
        soundLevel: payload?.flag ? 0.0 : state.savedSoundLevel,
        savedSoundLevel: payload?.flag ? state.soundLevel : state.savedSoundLevel
      };

    default:
      return state;
  }
}
