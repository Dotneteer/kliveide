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
export const emulatorShowShadowScreenAction = createAction(
  "EMULATOR_SHOW_SHADOW_SCREEN"
);
export const emulatorHideShadowScreenAction = createAction(
  "EMULATOR_HIDE_SHADOW_SCREEN"
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

export function emulatorSetMemoryContentsAction(memoryContents: Uint8Array) {
  return createAction("EMULATOR_SET_MEMORY_CONTENTS", { memoryContents });
}

export function emulatorSetMemWriteMapAction(memWriteMap: Uint8Array) {
  return createAction("EMULATOR_SET_MEMWRITE_MAP", { memWriteMap });
}

export const engineInitializedAction = createAction("EMULATOR_INITIALIZED");

export function emulatorSetDebugAction(runsInDebug: boolean) {
  return createAction("EMULATOR_SET_DEBUG", { runsInDebug });
}

export function emulatorSetSavedDataAction(savedData: Uint8Array) {
  return createAction("EMULATOR_SET_SAVED_DATA", { savedData });
}

export function emulatorRequestTypeAction(requestedType: string) {
  return createAction("EMULATOR_REQUEST_TYPE", { requestedType });
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

/**
 * This reducer manages keyboard panel state changes
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
    case "EMULATOR_SHOW_SHADOW_SCREEN":
      return { ...state, shadowScreen: true };
    case "EMULATOR_HIDE_SHADOW_SCREEN":
      return { ...state, shadowScreen: false };
    case "EMULATOR_TOGGLE_SHADOW_SCREEN":
      return {
        ...state,
        shadowScreen:
          state.shadowScreen === undefined ? true : !state.shadowScreen,
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
    case "EMULATOR_SET_MEMORY_CONTENTS":
      return { ...state, memoryContents: payload.memoryContents };
    case "EMULATOR_SET_MEMWRITE_MAP":
      return { ...state, memWriteMap: payload.memWriteMap };
    case "EMULATOR_INITIALIZED":
      return { ...state, engineInitialized: true };
    case "EMULATOR_SET_DEBUG":
      return { ...state, runsInDebug: payload.runsInDebug };
    case "EMULATOR_SET_SAVED_DATA":
      return { ...state, savedData: payload.savedData };
    case "EMULATOR_REQUEST_TYPE":
      return { ...state, requestedType: payload.requestedType };
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
  }
  return state;
}
