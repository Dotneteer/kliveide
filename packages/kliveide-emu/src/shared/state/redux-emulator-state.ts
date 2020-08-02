import { SpectNetAction, createAction } from "./redux-core";
import { EmulatorPanelState } from "./AppState";

export function emulatorSetSizeAction(width: number, height: number) {
  return createAction("EMULATOR_SET_SIZE", { width, height });
}

export function emulatorSetZoomAction(zoom: number) {
  return createAction("EMULATOR_SET_ZOOM", { zoom });
}

export function emulatorSetExecStateAction(executionState: number) {
  return createAction("EMULATOR_SET_EXEC_STATE", { executionState });
}

export function emulatorSetTapeContenstAction(tapeContents: Uint8Array) {
  return createAction("EMULATOR_SET_TAPE_CONTENTS", { tapeContents });
}

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

export function emulatorSetFrameIdAction(
  startCount: number,
  frameCount: number
) {
  return createAction("EMULATOR_SET_FRAME_ID", { startCount, frameCount });
}

/**
 * This reducer manages keyboard panel state changes
 * @param state Input state
 * @param action Action executed
 */
export function emulatorStateReducer(
  state: EmulatorPanelState = {
    zoom: 1,
  },
  { type, payload }: SpectNetAction
): EmulatorPanelState {
  switch (type) {
    case "EMULATOR_SET_SIZE":
      return { ...state, width: payload.width, height: payload.height };
    case "EMULATOR_SET_ZOOM":
      return { ...state, zoom: payload.zoom };
    case "EMULATOR_SET_EXEC_STATE":
      return { ...state, executionState: payload.executionState };
    case "EMULATOR_SET_TAPE_CONTENTS":
      return { ...state, tapeContents: payload.tapeContents };
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
  }
  return state;
}
