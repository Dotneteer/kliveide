import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { FileProvider } from "../zxnext/FileProvider";

/**
 * Creates a test-ready ZX Spectrum 48K machine with ROMs loaded.
 */
export async function createTestSpectrum48Machine(): Promise<TestSpectrum48Machine> {
  const machine = new TestSpectrum48Machine();
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
}

/**
 * Test wrapper around ZxSpectrum48Machine providing helpers for unit testing.
 */
export class TestSpectrum48Machine extends ZxSpectrum48Machine {
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
   * Set CPU frame tact position. Also sets tacts for consistency.
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
   * Useful for ensuring predictable contention during multi-tact instructions.
   */
  setContentionRange(startTact: number, count: number, value: number): void {
    for (let i = 0; i < count; i++) {
      this.setContentionValue(startTact + i, value);
    }
  }
}
