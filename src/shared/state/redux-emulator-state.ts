import { SpectNetAction, createAction } from "./redux-core";
import { EmulatorPanelState } from "./AppState";

export function emulatorSetSizeAction(width: number, height: number) {
  return createAction("EMULATOR_SET_SIZE", { width, height });
}

export function emulatorSetZoomAction(zoom: number) {
  return createAction("EMULATOR_SET_ZOOM", { zoom });
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
  }
  return state;
}
