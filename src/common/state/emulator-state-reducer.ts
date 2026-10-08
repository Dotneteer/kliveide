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
    // --- A machine or model change rebuilds the machine, which empties its quick-save slot
    case "SET_MACHINE_TYPE":
      return { ...state, machineId: payload?.id, quickStateAvailable: false, historyPosition: undefined, historySequence: undefined };

    case "SET_MODEL_TYPE":
      return { ...state, modelId: payload?.id, quickStateAvailable: false };

    case "SET_RZX_STATE":
      return { ...state, rzx: payload?.value };

    case "SET_REVERSE_DEBUG_STATE":
      return { ...state, reverseDebug: payload?.value };

    case "SET_QUICK_STATE_AVAILABLE":
      return { ...state, quickStateAvailable: payload?.flag as boolean };

    case "SET_HISTORY_POSITION":
      return {
        ...state,
        historyPosition: payload?.value?.position || undefined,
        historySequence: payload?.value?.position ? payload?.value?.sequence : undefined,
        historyMemoryIsHistorical: payload?.value?.position ? !!payload?.value?.memoryIsHistorical : undefined
      };

    case "SET_MACHINE_STATE":
      return {
        ...state,
        // --- Only a paused machine has a history cursor (D1)
        ...(payload?.state === MachineControllerState.Paused ? {} : { historyPosition: undefined, historySequence: undefined, historyMemoryIsHistorical: undefined }),
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

    case "SET_MOUSE_CAPTURED":
      return {
        ...state,
        mouseCaptured: payload?.flag
      };

    case "SET_NEXT_LAYERS":
      return {
        ...state,
        nextLayers: payload?.value
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

    case "INC_BP_HITS_VERSION":
      return {
        ...state,
        breakpointHitsVersion: (state.breakpointHitsVersion ?? 0) + 1
      };

    case "INC_EMU_VIEW_VERSION":
      return {
        ...state,
        emuViewVersion: (state.emuViewVersion ?? 0) + 1
      };

    case "SET_ADVANCED_DEBUGGING":
      return {
        ...state,
        advancedDebugging: payload?.flag as boolean
      };

    case "SET_SCREEN_RECORDING_AVAILABLE":
      return {
        ...state,
        screenRecordingAvailable: payload?.flag as boolean
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

    case "SET_SCREEN_RECORDING_FORMAT":
      return {
        ...state,
        screenRecordingFormat: payload?.id as import("./AppState").RecordingFormat
      };

    case "SET_WINDOW_RECORDING_STATE":
      return {
        ...state,
        windowRecordingState: payload?.id as import("./AppState").WindowRecordingState,
        windowRecordingFile: payload?.file ?? state.windowRecordingFile
      };

    case "SET_WINDOW_RECORDING_IDE_POSITION":
      return {
        ...state,
        windowRecordingIdePosition: payload?.id as import("./AppState").RecordingIdePosition
      };

    case "SET_WINDOW_RECORDING_POINTER":
      return { ...state, windowRecordingPointer: !!payload?.flag };

    case "SET_WINDOW_RECORDING_CLICKS":
      return { ...state, windowRecordingClicks: !!payload?.flag };

    case "SET_WINDOW_RECORDING_HIDPI":
      return { ...state, windowRecordingHiDpi: !!payload?.flag };

    default:
      return state;
  }
}
