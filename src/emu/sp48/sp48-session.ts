import type { Sp48MachineController } from "./Sp48MachineController";
import type { Sp48TapeBlock } from "../tape/tape-parser";

let activeController: Sp48MachineController | null = null;
let pendingTape: { blocks: Sp48TapeBlock[]; fileName: string } | null = null;

export function setActiveSp48Controller(controller: Sp48MachineController | null): void {
  activeController = controller;
  if (controller && pendingTape) {
    console.info(`[sp48-tape] uploading-queued ${describePendingTape()}`);
  }
  uploadPendingTape();
}

export function getActiveSp48Controller(): Sp48MachineController | null {
  return activeController;
}

export function uploadTapeToActiveSp48ControllerOrQueue(
  blocks: Sp48TapeBlock[],
  fileName: string
): "uploaded" | "queued" {
  pendingTape = { blocks, fileName };
  const result = uploadPendingTape() ? "uploaded" : "queued";
  console.info(
    `[sp48-tape] tape-${result} file="${fileName}" blocks=${blocks.length} bytes=${getTapeDataLength(blocks)}`
  );
  return result;
}

export function clearQueuedSp48Tape(): void {
  pendingTape = null;
}

function uploadPendingTape(): boolean {
  if (!activeController || !pendingTape) {
    return false;
  }

  activeController.setTape(pendingTape.blocks, pendingTape.fileName);
  pendingTape = null;
  return true;
}

function describePendingTape(): string {
  if (!pendingTape) {
    return "none";
  }
  return `"${pendingTape.fileName}" blocks=${pendingTape.blocks.length} bytes=${getTapeDataLength(
    pendingTape.blocks
  )}`;
}

function getTapeDataLength(blocks: Sp48TapeBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.data.length, 0);
}
