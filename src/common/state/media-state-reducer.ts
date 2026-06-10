import type { Action } from "./Action";
import type { MediaState } from "./AppState";

export function mediaStateReducer(state: MediaState, { type, payload }: Action): MediaState {
  switch (type) {
    case "SET_TAPE_MEDIA":
      return {
        ...state,
        tape: { ...(payload?.value ?? {}) }
      };

    case "CLEAR_TAPE_MEDIA": {
      const { tape: _tape, ...rest } = state;
      return rest;
    }

    default:
      return state;
  }
}
