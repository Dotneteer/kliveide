import { ZxSpectrumSpecificState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const spectrumFastLoadAction: ActionCreator = (fastLoad: boolean) => ({
  type: "SPECTRUM_FAST_LOAD",
  payload: { fastLoad },
});

export const spectrumBeamPositionAction: ActionCreator = (
  showBeamPosition: boolean
) => ({
  type: "SPECTRUM_BEAM_POSITION",
  payload: { showBeamPosition },
});

export const spectrumTapeContentsAction: ActionCreator = (
  tapeContents: Uint8Array
) => ({
  type: "SPECTRUM_TAPE_CONTENTS",
  payload: { tapeContents },
});

export const spectrumTapeLoadedAction: ActionCreator = () => ({
  type: "SPECTRUM_TAPE_LOADED",
});

export const spectrumLoadModeAction: ActionCreator = (loadMode: boolean) => ({
  type: "SPECTRUM_LOAD_MODE",
  payload: { loadMode },
});

// ============================================================================
// Reducer

const initialState: ZxSpectrumSpecificState = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): ZxSpectrumSpecificState {
  switch (type) {
    case "SPECTRUM_FAST_LOAD":
      return { ...state, fastLoad: payload.fastLoad };
    case "SPECTRUM_BEAM_POSITION":
      return { ...state, showBeamPosition: payload.showBeamPosition };
    case "SPECTRUM_TAPE_CONTENTS":
      return { ...state, tapeContents: payload.tapeContents };
    case "SPECTRUM_TAPE_LOADED":
      return { ...state, tapeLoaded: true };
    case "SPECTRUM_LOAD_MODE":
      return { ...state, loadMode: payload.loadMode };
    default:
      return state;
  }
}
