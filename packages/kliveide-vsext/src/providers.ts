import { Z80RegistersProvider } from "./views/z80-registers";
import {
  onFrameInfoChanged,
  onExecutionStateChanged,
} from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";

/**
 * Z80RegisterProvider singleton instance
 */
let z80RegistersProvider: Z80RegistersProvider;

/**
 * Sets the singleton Z80 register provider object
 * @param provider Z80 register provider instance
 */
export function setZ80RegisterProvider(provider: Z80RegistersProvider): void {
  z80RegistersProvider = provider;

  // --- Notify entities about virtual machine frame information change
  let refreshCounter = 0;
  onFrameInfoChanged(async () => {
    refreshCounter++;
    if (refreshCounter % 10 !== 0) {
      return;
    }
    try {
      const regData = await communicatorInstance.getRegisters();
      z80RegistersProvider.refresh(regData);
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  });

  // --- Notify entities about virtual machine execution state changes
  onExecutionStateChanged(async () => {
    const regData = await communicatorInstance.getRegisters();
    z80RegistersProvider.refresh(regData);
  });
}

/**
 * Gets the Z80 Register provider object
 */
export function getZ80RegisterProvider(): Z80RegistersProvider {
  return z80RegistersProvider;
}
