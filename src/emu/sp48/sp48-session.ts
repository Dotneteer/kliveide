import type { Sp48MachineController } from "./Sp48MachineController";
import type { Sp48TapeBlock } from "../tape/tape-parser";

type Sp48QueuedTape = {
  blocks: Sp48TapeBlock[];
  fileName: string;
};

export type Sp48TapeUploadResult = "uploaded" | "queued";

let activeController: Sp48MachineController | null = null;
let selectedTape: Sp48QueuedTape | null = null;
let pendingTape: Sp48QueuedTape | null = null;
let selectedTapeController: Sp48MachineController | null = null;

export function setActiveSp48Controller(controller: Sp48MachineController | null): void {
  if (activeController === controller) {
    return;
  }

  activeController = controller;
  uploadSelectedTapeToActiveController();
}

export function getActiveSp48Controller(): Sp48MachineController | null {
  return activeController;
}

export function uploadTapeToActiveSp48ControllerOrQueue(
  blocks: Sp48TapeBlock[],
  fileName: string
): Sp48TapeUploadResult {
  selectedTape = { blocks, fileName };
  pendingTape = selectedTape;
  selectedTapeController = null;
  const result = uploadSelectedTapeToActiveController() ? "uploaded" : "queued";
  return result;
}

export function clearQueuedSp48Tape(): void {
  selectedTape = null;
  pendingTape = null;
  selectedTapeController = null;
}

function uploadSelectedTapeToActiveController(): boolean {
  if (!activeController) {
    return false;
  }

  const tape = pendingTape ?? selectedTape;
  if (!tape || selectedTapeController === activeController) {
    return false;
  }

  activeController.setTape(tape.blocks, tape.fileName);
  selectedTape = tape;
  pendingTape = null;
  selectedTapeController = activeController;
  return true;
}
