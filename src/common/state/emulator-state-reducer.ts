import { MachineControllerState } from "@abstractions/MachineControllerState";
import { Action } from "./Action";
import { EmulatorState } from "./AppState";

/**
 * This reducer is used to manage the emulator view option properties
 */
export function emulatorStateReducer(
  state: EmulatorState,
  { type, payload }: Action
): EmulatorState {
  switch (type) {
    case "SET_MACHINE_TYPE":
      return { ...state, machineId: payload?.id };

    case "SET_MODEL_TYPE":
      return { ...state, modelId: payload?.id };

    case "SET_MACHINE_STATE":
      return {
        ...state,
        machineState: payload?.state,
        isProjectDebugging:
          payload?.state === MachineControllerState.Stopped ||
          payload?.state === MachineControllerState.None
            ? false
            : state.isProjectDebugging,
        pcValue: payload?.numValue
      };

    case "SET_MACHINE_CONFIG":
      return {
        ...state,
        config: payload?.value
      };

    case "SET_MACHINE_SPECIFIC":
      return {
        ...state,
        machineSpecific: payload?.value
      };

    case "MUTE_SOUND":
      return {
        ...state,
        soundMuted: payload?.flag,
        soundLevel: payload?.flag ? 0.0 : state.savedSoundLevel,
        savedSoundLevel: payload?.flag ? state.soundLevel : state.savedSoundLevel
      };

    case "SET_SOUND_LEVEL":
      return {
        ...state,
        soundLevel: payload?.numValue,
        soundMuted: payload?.numValue === 0.0,
        savedSoundLevel: payload?.numValue === 0.0 ? state.soundLevel : payload?.numValue
      };

    case "SET_DEBUGGING":
      return {
        ...state,
        isDebugging: payload?.flag
      };

    case "SET_PROJECT_DEBUGGING":
      return {
        ...state,
        isProjectDebugging: payload?.flag
      };

    case "SET_CLOCK_MULTIPLIER":
      return {
        ...state,
        clockMultiplier: payload?.numValue
      };

    case "SET_AUDIO_SAMPLE_RATE":
      return {
        ...state,
        audioSampleRate: payload?.numValue
      };

    case "INC_BPS_VERSION":
      return {
        ...state,
        breakpointsVersion: (state.breakpointsVersion ?? 0) + 1
      };

    case "INC_EMU_VIEW_VERSION":
      return {
        ...state,
        emuViewVersion: (state.emuViewVersion ?? 0) + 1
      };

    case "SET_SCREEN_RECORDING_STATE":
      return {
        ...state,
        screenRecordingState: payload?.id as import("./AppState").ScreenRecordingState,
        screenRecordingFile: payload?.value ?? state.screenRecordingFile,
        screenRecordingFps: (payload?.text as import("./AppState").RecordingFps) ?? state.screenRecordingFps
      };

    case "SET_SCREEN_RECORDING_QUALITY":
      return {
        ...state,
        screenRecordingQuality: payload?.id as import("./AppState").RecordingQuality
      };

    default:
      return state;
  }
}
