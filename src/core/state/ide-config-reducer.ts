import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const setIdeConfigAction: ActionCreator = (
  ideConfig: Record<string, any>
) => ({
  type: "SET_IDE_CONFIG",
  payload: { ideConfig },
});

// ============================================================================
// Reducer

const initialState: Record<string, any> = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): Record<string, any> {
  switch (type) {
    case "SET_IDE_CONFIG":
      return payload.ideConfig;
    default:
      return state;
  }
}
