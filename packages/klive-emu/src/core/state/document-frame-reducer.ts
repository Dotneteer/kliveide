// ============================================================================
// Actions

import { DocumentFrameState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

/**
 * Creates an action for setting the activity bar contents
 */
export const setDocumentFrameStateAction: ActionCreator = (
  documentFrame: DocumentFrameState
) => ({
  type: "SET_DOCUMENT_FRAME_STATE",
  payload: {
    documentFrame,
  },
});

// ============================================================================
// Reducer

const initialState: DocumentFrameState = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): DocumentFrameState {
  switch (type) {
    case "SET_DOCUMENT_FRAME_STATE":
      return payload.documentFrame;
    default:
      return state;
  }
}
