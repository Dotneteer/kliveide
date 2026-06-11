import type { Sp48MachineController } from "./Sp48MachineController";
import type { Sp48TapeBlock } from "../tape/tape-parser";

type Sp48QueuedTape = {
  blocks: Sp48TapeBlock[];
  fileName: string;
};

let activeController: Sp48MachineController | null = null;
let selectedTape: Sp48QueuedTape | null = null;
let pendingTape: Sp48QueuedTape | null = null;
let selectedTapeController: Sp48MachineController | null = null;

export function setActiveSp48Controller(controller: Sp48MachineController | null): void {
  if (activeController === controller) {
    return;
  }

  activeController = controller;
  if (controller && pendingTape) {
    console.info(`[sp48-tape] uploading-queued ${describePendingTape()}`);
  }
  uploadSelectedTapeToActiveController();
}

export function getActiveSp48Controller(): Sp48MachineController | null {
  return activeController;
}

export function uploadTapeToActiveSp48ControllerOrQueue(
  blocks: Sp48TapeBlock[],
  fileName: string
): "uploaded" | "queued" {
  selectedTape = { blocks, fileName };
  pendingTape = selectedTape;
  selectedTapeController = null;
  const result = uploadSelectedTapeToActiveController() ? "uploaded" : "queued";
  console.info(
    `[sp48-tape] tape-${result} file="${fileName}" blocks=${blocks.length} bytes=${getTapeDataLength(blocks)}`
  );
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

function describePendingTape(): string {
  const tape = pendingTape ?? selectedTape;
  if (!tape) {
    return "none";
  }
  return `"${tape.fileName}" blocks=${tape.blocks.length} bytes=${getTapeDataLength(
    tape.blocks
  )}`;
}

function getTapeDataLength(blocks: Sp48TapeBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.data.length, 0);
}
