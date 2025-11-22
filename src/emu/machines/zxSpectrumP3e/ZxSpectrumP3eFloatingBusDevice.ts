import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";

import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import { ZxSpectrumP3EMachine } from "./ZxSpectrumP3eMachine";

/**
 * This class implements the ZX Spectrum 128 floating bus device.
 */
export class ZxSpectrumP3eFloatingBusDevice implements IFloatingBusDevice {
  /**
   * Initialize the floating port device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZxSpectrumMachine) {}

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    // --- Intentionally empty
  }

  /**
   * Reads the current floating bus value.
   * @returns The value read from the floating bus
   */
  public readFloatingBus (): number {
    const machine = (this.machine as ZxSpectrumP3EMachine);
    const screen = this.machine.screenDevice;
    const currentTactIndex =
      (this.machine.currentFrameTact - 3 + this.machine.tactsInFrame) %
      this.machine.tactsInFrame;
    const renderingTact = screen.renderingTactTable[currentTactIndex];
    switch (renderingTact?.phase) {
      case RenderingPhase.Border:
      case RenderingPhase.None:
      case RenderingPhase.DisplayB1:  
      case RenderingPhase.DisplayB2:
        return machine.lastContendedValue | 0x01;
      default:
        return machine.lastUlaReadValue;
    }
  }
}

/**
 * Floating bus ports for the ZX Spectrum +2/+3 machine
 */
export const zxSpectrumP32FloatingBusPorts: Record<string, boolean> = {};
for (let n = 0; n < 0x1000; n++) {
  zxSpectrumP32FloatingBusPorts[4 * n + 1] = true;
}
