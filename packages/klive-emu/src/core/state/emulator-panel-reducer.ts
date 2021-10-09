import { EmulatorPanelState, FrameDiagData } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const emuSetSizeAction: ActionCreator = (
  width: number,
  height: number
) => ({ type: "EMU_SET_SIZE", payload: { width, height } });

export const emuSetExecutionStateAction: ActionCreator = (
  executionState: number
) => ({ type: "EMU_SET_EXEC_STATE", payload: { executionState } });

export const emuSetFrameIdAction: ActionCreator = (
  startCount: number,
  frameCount: number
) => ({ type: "EMU_SET_FRAME_ID", payload: { startCount, frameCount } });

export const emuMuteSoundAction: ActionCreator = (flag: boolean) => ({
  type: "EMU_MUTE",
  payload: { flag },
});

export const emuSetDebugModeAction: ActionCreator = (runsInDebug: boolean) => ({
  type: "EMU_SET_DEBUG",
  payload: { runsInDebug },
});

export const emuSetMessageAction: ActionCreator = (panelMessage: string) => ({
  type: "EMU_SET_MESSAGE",
  payload: { panelMessage },
});

export const emuSetSoundLevelAction: ActionCreator = (soundLevel: number) => ({
  type: "EMU_SET_SOUND_LEVEL",
  payload: { soundLevel },
});

export const emuSetClockMultiplierAction: ActionCreator = (
  clockMultiplier: number
) => ({
  type: "EMU_SET_CLOCK_MULTIPLIER",
  payload: { clockMultiplier },
});

export const emuSetKeyboardLayoutAction: ActionCreator = (
  keyboardLayout: string
) => ({
  type: "EMU_SET_KEYBOARD",
  payload: { keyboardLayout },
});

export const emuMachineContextAction: ActionCreator = (
  machineContext: string
) => ({
  type: "EMU_MACHINE_CONTEXT",
  payload: { machineContext },
});

export const emuKeyboardHeightAction: ActionCreator = (
  keyboardHeight: number
) => ({
  type: "EMU_KEYBOARD_HEIGHT",
  payload: { keyboardHeight },
});

export const emuSetFirmWareAction: ActionCreator = (
  firmware: Uint8Array[]
) => ({
  type: "EMU_SET_FIRMWARE",
  payload: { firmware },
});

export const emuSetExtraFeaturesAction: ActionCreator = (
  extraFeatures: string[]
) => ({
  type: "EMU_SET_EXTRA",
  payload: { extraFeatures },
});

export const emuSetBaseFrequencyAction: ActionCreator = (
  baseClockFrequency: number
) => ({
  type: "EMU_SET_BASE_FREQ",
  payload: { baseClockFrequency },
});

export const emuSetDiagDataAction: ActionCreator = (
  frameDiagData: FrameDiagData
) => ({
  type: "EMU_SET_DIAG_DATA",
  payload: { frameDiagData },
});

// ============================================================================
// Reducer

const initialState: EmulatorPanelState = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): EmulatorPanelState {
  switch (type) {
    case "EMU_SET_SIZE":
      return { ...state, width: payload.width, height: payload.height };
    case "EMU_SET_EXEC_STATE":
      return { ...state, executionState: payload.executionState };
    case "EMU_SET_FRAME_ID":
      return {
        ...state,
        startCount: payload.startCount,
        frameCount: payload.frameCount,
      };
    case "EMU_MUTE":
      return { ...state, muted: payload.flag };
    case "EMU_SET_DEBUG":
      return { ...state, runsInDebug: payload.runsInDebug };
    case "EMU_SET_MESSAGE":
      return { ...state, panelMessage: payload.panelMessage };
    case "EMU_SET_SOUND_LEVEL":
      return { ...state, soundLevel: payload.soundLevel };
    case "EMU_SET_CLOCK_MULTIPLIER":
      return { ...state, clockMultiplier: payload.clockMultiplier };
    case "EMU_SET_KEYBOARD":
      return { ...state, keyboardLayout: payload.keyboardLayout };
    case "EMU_MACHINE_CONTEXT":
      return { ...state, machineContext: payload.machineContext };
    case "EMU_KEYBOARD_HEIGHT":
      return { ...state, keyboardHeight: payload.keyboardHeight };
    case "EMU_SET_FIRMWARE":
      return { ...state, firmware: payload.firmware };
    case "EMU_SET_EXTRA":
      return { ...state, extraFeatures: payload.extraFeatures };
    case "EMU_SET_BASE_FREQ":
      return { ...state, baseClockFrequency: payload.baseClockFrequency };
    case "EMU_SET_DIAG_DATA":
      return { ...state, frameDiagData: payload.frameDiagData };
    default:
      return state;
  }
}
