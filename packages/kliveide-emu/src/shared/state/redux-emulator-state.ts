import { SpectNetAction, createAction } from "./redux-core";
import { EmulatorPanelState } from "./AppState";

export function emulatorSetSizeAction(width: number, height: number) {
  return createAction("EMULATOR_SET_SIZE", { width, height });
}

export function emulatorSetExecStateAction(executionState: number) {
  return createAction("EMULATOR_SET_EXEC_STATE", { executionState });
}

export function emulatorSetTapeContenstAction(tapeContents: Uint8Array) {
  return createAction("EMULATOR_SET_TAPE_CONTENTS", { tapeContents });
}

export const emulatorLoadTapeAction = createAction("EMULATOR_LOAD_TAPE");
export const emulatorShowKeyboardAction = createAction(
  "EMULATOR_SHOW_KEYBOARD"
);
export const emulatorHideKeyboardAction = createAction(
  "EMULATOR_HIDE_KEYBOARD"
);
export const emulatorToggleKeyboardAction = createAction(
  "EMULATOR_TOGGLE_KEYBOARD"
);
export const emulatorToggleShadowScreenAction = createAction(
  "EMULATOR_TOGGLE_SHADOW_SCREEN"
);
export const emulatorShowBeamPositionAction = createAction(
  "EMULATOR_SHOW_BEAM_POSITION"
);
export const emulatorHideBeamPositionAction = createAction(
  "EMULATOR_HIDE_BEAM_POSITION"
);
export const emulatorToggleBeamPositionAction = createAction(
  "EMULATOR_TOGGLE_BEAM_POSITION"
);
export const emulatorEnableFastLoadAction = createAction(
  "EMULATOR_ENABLE_FAST_LOAD"
);
export const emulatorDisableFastLoadAction = createAction(
  "EMULATOR_DISABLE_FAST_LOAD"
);
export const emulatorToggleFastLoadAction = createAction(
  "EMULATOR_TOGGLE_FAST_LOAD"
);
export const emulatorMuteAction = createAction("EMULATOR_MUTE");
export const emulatorUnmuteAction = createAction("EMULATOR_UNMUTE");

export function emulatorSetFrameIdAction(
  startCount: number,
  frameCount: number
) {
  return createAction("EMULATOR_SET_FRAME_ID", { startCount, frameCount });
}

export const engineInitializedAction = createAction("EMULATOR_INITIALIZED");

export function emulatorSetDebugAction(runsInDebug: boolean) {
  return createAction("EMULATOR_SET_DEBUG", { runsInDebug });
}

export function emulatorSetSavedDataAction(savedData: Uint8Array) {
  return createAction("EMULATOR_SET_SAVED_DATA", { savedData });
}

export function emulatorRequestTypeAction(
  requestedType: string,
  requestedOptions?: Record<string, any>
) {
  return createAction("EMULATOR_REQUEST_TYPE", {
    requestedType,
    requestedOptions,
  });
}

export function emulatorSetupTypeAction(currentType: string) {
  return createAction("EMULATOR_SETUP_TYPE", { currentType });
}

export function emulatorSelectRomAction(selectedRom: number) {
  return createAction("EMULATOR_SELECT_ROM", { selectedRom });
}

export function emulatorSelectBankAction(selectedBank: number) {
  return createAction("EMULATOR_SELECT_BANK", { selectedBank });
}

export function emulatorSetLoadModeAction(isLoading: boolean) {
  return createAction("EMULATOR_LOAD_MODE", { isLoading });
}

export function emulatorSetPanelMessageAction(panelMessage: string) {
  return createAction("EMULATOR_SET_MESSAGE", { panelMessage });
}

export function emulatorSetSoundLevelAction(soundLevel: number) {
  return createAction("EMULATOR_SET_SOUND_LEVEL", { soundLevel });
}

export const emulatorShowStatusbarAction = createAction(
  "EMULATOR_SHOW_STATUSBAR"
);
export const emulatorHideStatusbarAction = createAction(
  "EMULATOR_HIDE_STATUSBAR"
);

export function emulatorSetInternalStateAction(
  internalState: Record<string, any>
) {
  return createAction("EMULATOR_SET_INTERNAL_STATE", { internalState });
}

export function emulatorSetClockMultiplierAction(clockMultiplier: number) {
  return createAction("EMULATOR_SET_CLOCK_MULTIPLIER", { clockMultiplier });
}

export const emulatorShowFramesAction = createAction("EMULATOR_SHOW_FRAMES");
export const emulatorHideFramesAction = createAction("EMULATOR_HIDE_FRAMES");
export const emulatorShowToolbarAction = createAction("EMULATOR_SHOW_TOOLBAR");
export const emulatorHideToolbarAction = createAction("EMULATOR_HIDE_TOOLBAR");

export function emulatorSetKeyboardAction(keyboardLayout: string) {
  return createAction("EMULATOR_SET_KEYBOARD", { keyboardLayout });
}

export function emulatorSetMachineContextAction(machineContext: string) {
  return createAction("EMULATOR_MACHINE_CONTEXT", { machineContext });
}


/**
 * This reducer manages emulator panel state changes
 * @param state Input state
 * @param action Action executed
 */
export function emulatorStateReducer(
  state: EmulatorPanelState = {},
  { type, payload }: SpectNetAction
): EmulatorPanelState {
  switch (type) {
    case "EMULATOR_SET_SIZE":
      return { ...state, width: payload.width, height: payload.height };
    case "EMULATOR_SET_EXEC_STATE":
      return { ...state, executionState: payload.executionState };
    case "EMULATOR_SET_TAPE_CONTENTS":
      return {
        ...state,
        tapeContents: payload.tapeContents,
        tapeLoaded: false,
      };
    case "EMULATOR_LOAD_TAPE":
      return { ...state, tapeLoaded: true };
    case "EMULATOR_SHOW_KEYBOARD":
      return { ...state, keyboardPanel: true };
    case "EMULATOR_HIDE_KEYBOARD":
      return { ...state, keyboardPanel: false };
    case "EMULATOR_TOGGLE_KEYBOARD":
      return {
        ...state,
        keyboardPanel:
          state.keyboardPanel === undefined ? true : !state.keyboardPanel,
      };
    case "EMULATOR_SHOW_BEAM_POSITION":
      return { ...state, beamPosition: true };
    case "EMULATOR_HIDE_BEAM_POSITION":
      return { ...state, beamPosition: false };
    case "EMULATOR_TOGGLE_BEAM_POSITION":
      return {
        ...state,
        beamPosition:
          state.beamPosition === undefined ? true : !state.beamPosition,
      };
    case "EMULATOR_ENABLE_FAST_LOAD":
      return { ...state, fastLoad: true };
    case "EMULATOR_DISABLE_FAST_LOAD":
      return { ...state, fastLoad: false };
    case "EMULATOR_TOGGLE_FAST_LOAD":
      return {
        ...state,
        fastLoad: state.fastLoad === undefined ? true : !state.fastLoad,
      };
    case "EMULATOR_SET_FRAME_ID":
      return {
        ...state,
        startCount: payload.startCount,
        frameCount: payload.frameCount,
      };
    case "EMULATOR_MUTE":
      return { ...state, muted: true };
    case "EMULATOR_UNMUTE":
      return { ...state, muted: false };
    case "EMULATOR_INITIALIZED":
      return { ...state, engineInitialized: true };
    case "EMULATOR_SET_DEBUG":
      return { ...state, runsInDebug: payload.runsInDebug };
    case "EMULATOR_SET_SAVED_DATA":
      return { ...state, savedData: payload.savedData };
    case "EMULATOR_REQUEST_TYPE":
      return {
        ...state,
        requestedType: payload.requestedType,
        requestedOptions: payload.requestedOptions,
      };
    case "EMULATOR_SETUP_TYPE":
      return { ...state, currentType: payload.currentType, executionState: 0 };
    case "EMULATOR_SELECT_ROM":
      return { ...state, selectedRom: payload.selectedRom };
    case "EMULATOR_SELECT_BANK":
      return { ...state, selectedBank: payload.selectedBank };
    case "EMULATOR_LOAD_MODE":
      return { ...state, isLoading: payload.isLoading };
    case "EMULATOR_SET_MESSAGE":
      return { ...state, panelMessage: payload.panelMessage };
    case "EMULATOR_SET_SOUND_LEVEL":
      return { ...state, soundLevel: payload.soundLevel };
    case "EMULATOR_SHOW_STATUSBAR":
      return { ...state, statusbar: true };
    case "EMULATOR_HIDE_STATUSBAR":
      return { ...state, statusbar: false };
    case "EMULATOR_SET_INTERNAL_STATE":
      return { ...state, internalState: payload.internalState };
    case "EMULATOR_SET_CLOCK_MULTIPLIER":
      return { ...state, clockMultiplier: payload.clockMultiplier };
    case "EMULATOR_SHOW_FRAMES":
      return { ...state, showFrames: true };
    case "EMULATOR_HIDE_FRAMES":
      return { ...state, showFrames: false };
    case "EMULATOR_SHOW_TOOLBAR":
      return { ...state, showToolbar: true };
    case "EMULATOR_HIDE_TOOLBAR":
      return { ...state, showToolbar: false };
    case "EMULATOR_SET_KEYBOARD":
      return { ...state, keyboardLayout: payload.keyboardLayout };
    case "EMULATOR_MACHINE_CONTEXT":
        return { ...state, machineContext: payload.machineContext };
    }
  return state;
}
