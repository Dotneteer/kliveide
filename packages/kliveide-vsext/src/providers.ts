import { HardwareRegistersProvider } from "./views/hw-registers";
import {
  onFrameInfoChanged,
  onExecutionStateChanged,
} from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";

/**
 * Z80RegisterProvider singleton instance
 */
let z80RegistersProvider: HardwareRegistersProvider;

/**
 * Sets the singleton Z80 register provider object
 * @param provider Z80 register provider instance
 */
export function setZ80RegisterProvider(provider: HardwareRegistersProvider): void {
  z80RegistersProvider = provider;

  // --- Notify entities about virtual machine frame information change
  let refreshCounter = 0;
  onFrameInfoChanged(async () => {
    refreshCounter++;
    if (refreshCounter % 10 !== 0) {
      return;
    }
    try {
      const machineState = await communicatorInstance.getMachineState();
      z80RegistersProvider.refresh(machineState);
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  });

  // --- Notify entities about virtual machine execution state changes
  onExecutionStateChanged(async () => {
    const machineState = await communicatorInstance.getMachineState();
    z80RegistersProvider.refresh(machineState);
});
}

/**
 * Gets the Z80 Register provider object
 */
export function getZ80RegisterProvider(): HardwareRegistersProvider {
  return z80RegistersProvider;
}
