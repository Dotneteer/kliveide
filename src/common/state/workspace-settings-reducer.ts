import { Action } from "./Action";

/**
 * This reducer is used to manage the IDE view properties
 */
export function workspaceSettingsReducer(
  state: Record<string, any>,
  { type, payload }: Action
): Record<string, any> {
  switch (type) {
    case "SET_WORKSPACE_SETTINGS":
      if (payload.id === undefined) {
        return payload.value ?? {};
      }
      if (payload.value !== undefined) {
        return {
          ...state,
          [payload.id]: payload.value
        };
      } else {
        const newState = { ...state };
        delete newState[payload.id];
        return newState;
      }

    default:
      return state;
  }
}
