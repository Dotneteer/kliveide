import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { FileProvider } from "../zxnext/FileProvider";
import type { MachineModel } from "@common/machines/info-types";

const DEFAULT_P3E_MODEL: MachineModel = {
  modelId: "spp3e",
  displayName: "ZX Spectrum +3E",
  config: {}
};

/**
 * Creates a test-ready ZX Spectrum +3E machine with ROMs loaded.
 */
export async function createTestSpectrumP3eMachine(): Promise<TestSpectrumP3eMachine> {
  const machine = new TestSpectrumP3eMachine();
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
}

/**
 * Test wrapper around ZxSpectrumP3EMachine providing helpers for unit testing.
 */
export class TestSpectrumP3eMachine extends ZxSpectrumP3EMachine {
  constructor() {
    super(DEFAULT_P3E_MODEL);
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

  /**
   * Directly set the special paging mode and config.
   */
  setSpecialPaging(enabled: boolean, configMode: number): void {
    this.inSpecialPagingMode = enabled;
    this.specialConfigMode = configMode;
  }
}
