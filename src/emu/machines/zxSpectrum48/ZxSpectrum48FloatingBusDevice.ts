import type { IFloatingBusDevice } from "../../abstractions/IFloatingBusDevice";
import type { IZxSpectrumMachine } from "../../abstractions/IZxSpectrumMachine";

import { RenderingPhase } from "../../abstractions/RenderingPhase";

/**
 * This class implements the ZX Spectrum 48 floating bus device.
 */
export class ZxSpectrum48FloatingBusDevice implements IFloatingBusDevice {
  /**
   * Initialize the floating port device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZxSpectrumMachine) {}

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }

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
    const screen = this.machine.screenDevice;
    const currentTactIndex =
      (this.machine.currentFrameTact - 5 + this.machine.tactsInFrame) %
      this.machine.tactsInFrame;
    const renderingTact = screen.renderingTactTable[currentTactIndex];
    switch (renderingTact?.phase) {
      case RenderingPhase.BorderFetchPixel:
      case RenderingPhase.DisplayB1FetchB2:
      case RenderingPhase.DisplayB2FetchB1:
        return this.machine.readScreenMemory(renderingTact.pixelAddress);
      case RenderingPhase.BorderFetchAttr:
      case RenderingPhase.DisplayB1FetchA2:
      case RenderingPhase.DisplayB2FetchA1:
        return this.machine.readScreenMemory(renderingTact.attributeAddress);
      default:
        return 0xff;
    }
  }
}
