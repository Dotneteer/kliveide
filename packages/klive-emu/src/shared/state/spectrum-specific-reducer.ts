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
    default:
      return state;
  }
}
