import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { FileProvider } from "../zxnext/FileProvider";

/**
 * Creates a test-ready ZX Spectrum 128K machine with ROMs loaded.
 */
export async function createTestSpectrum128Machine(): Promise<TestSpectrum128Machine> {
  const machine = new TestSpectrum128Machine();
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
}

/**
 * Test wrapper around ZxSpectrum128Machine providing helpers for unit testing.
 */
export class TestSpectrum128Machine extends ZxSpectrum128Machine {
  constructor() {
    super();
  }

  /**
   * Write code bytes into memory at the specified address.
   */
  initCode(code: number[], startAddress: number): void {
    for (let i = 0; i < code.length; i++) {
      this.doWriteMemory(startAddress + i, code[i]);
    }
  }

  /**
   * Set CPU frame tact position.
   */
  setFrameTact(frameTact: number): void {
    this.frameTacts = frameTact;
    this.tacts = frameTact;
    this.currentFrameTact = frameTact;
  }

  /**
   * Execute a single CPU instruction cycle.
   */
  executeOne(): void {
    this.executeCpuCycle();
  }

  /**
   * Reset contention delay counters.
   */
  resetContentionCounters(): void {
    this.totalContentionDelaySinceStart = 0;
    this.contentionDelaySincePause = 0;
  }

  /**
   * Set contention values for a contiguous range of frame tacts.
   */
  setContentionRange(startTact: number, count: number, value: number): void {
    for (let i = 0; i < count; i++) {
      this.setContentionValue(startTact + i, value);
    }
  }

  /**
   * Directly set the selected RAM bank at 0xC000.
   */
  setSelectedBank(bank: number): void {
    this.selectedBank = bank;
  }
}
