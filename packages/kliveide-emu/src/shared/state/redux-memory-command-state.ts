import { createAction, SpectNetAction } from "./redux-core";
import { MemoryCommandType, MemoryCommand } from "./AppState";

export function memorySetCommandAction(
  seqNo: number,
  command: MemoryCommandType,
  index: number
) {
  return createAction("MEMORY_COMMAND", { seqNo, command, index });
}

export function memorySetResultAction(
  seqNo: number,
  memoryCommandResult?: Uint8Array
) {
  return createAction("MEMORY_COMMAND_RESULT", { seqNo, memoryCommandResult });
}

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function memoryCommandStateReducer(
  state: MemoryCommand = {
    seqNo: 0,
    command: "",
  },
  { type, payload }: SpectNetAction
): MemoryCommand {
  switch (type) {
    case "MEMORY_COMMAND":
      return {
        seqNo: payload.seqNo,
        command: payload.command as MemoryCommandType,
        index: payload.index,
      };
    case "MEMORY_COMMAND_RESULT":
      return {
        seqNo: payload.seqNo,
        command: "",
        memoryCommandResult: payload.memoryCommandResult,
      };
  }
  return state;
}
