import { MachineControllerState } from "../abstractions/MachineControllerState";
import type { MachineCommand } from "../abstractions/MachineCommand";
import type { Action } from "./Action";
import type { EmulatorState } from "./AppState";

const CLOCK_MULTIPLIER_VALUES = new Set([1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64]);

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
        soundLevel: payload?.flag ? 0.0 : normalizeSavedSoundLevel(state.savedSoundLevel),
        savedSoundLevel: payload?.flag
          ? getLastUnmutedSoundLevel(state.soundLevel, state.savedSoundLevel)
          : normalizeSavedSoundLevel(state.savedSoundLevel)
      };

    case "SET_SOUND_LEVEL": {
      const soundLevel = normalizeSoundLevel(payload?.numValue);
      return {
        ...state,
        soundLevel,
        soundMuted: soundLevel === 0.0,
        savedSoundLevel: soundLevel === 0.0
          ? getLastUnmutedSoundLevel(state.soundLevel, state.savedSoundLevel, payload?.value)
          : soundLevel
      };
    }

    case "SET_CLOCK_MULTIPLIER": {
      const multiplier = payload?.numValue;
      return {
        ...state,
        clockMultiplier:
          typeof multiplier === "number" && CLOCK_MULTIPLIER_VALUES.has(multiplier)
            ? multiplier
            : 1
      };
    }

    default:
      return state;
  }
}

function normalizeSoundLevel(value: unknown): number {
  return typeof value === "number" && [0.0, 0.2, 0.4, 0.8, 1.0].includes(value)
    ? value
    : 0.8;
}

function normalizeSavedSoundLevel(value: unknown): number {
  return typeof value === "number" && [0.2, 0.4, 0.8, 1.0].includes(value)
    ? value
    : 0.8;
}

function getLastUnmutedSoundLevel(
  soundLevel: unknown,
  savedSoundLevel: unknown,
  fallbackSoundLevel?: unknown
): number {
  return typeof fallbackSoundLevel === "number" && fallbackSoundLevel > 0.0
    ? normalizeSavedSoundLevel(fallbackSoundLevel)
    : typeof soundLevel === "number" && soundLevel > 0.0
    ? normalizeSavedSoundLevel(soundLevel)
    : normalizeSavedSoundLevel(savedSoundLevel);
}
