import { Action } from "./Action";
import { MediaState } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
export function mediaReducer (
  state: MediaState,
  { type, payload }: Action
): MediaState {
  switch (type) {
    case "SET_MEDIA":
      return {
        ...state,
        [payload!.id!]: payload!.value
      };
    default:
      return state;
  }
}
