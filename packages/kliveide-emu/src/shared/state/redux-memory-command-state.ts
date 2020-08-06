import { createAction, SpectNetAction } from "./redux-core";
import { MemoryCommand } from "./AppState";

export function memorySetCommandAction(from?: number, to?: number) {
  return createAction("MEMORY_COMMAND", { from, to });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function memoryCommandStateReducer(
  state: MemoryCommand = null,
  { type, payload }: SpectNetAction
): MemoryCommand | null {
  switch (type) {
    case "MEMORY_COMMAND":
      return !payload.from && payload.to
        ? null
        : { from: payload.from ?? 0, to: payload.to ?? 0xffff };
  }
  return state;
}
