import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "../wa-api";
import {
  Spectrum128MachineState,
  MachineState,
  ExecuteCycleOptions,
  EmulationMode,
  DebugStepMode,
} from "../../../shared/machines/machine-state";
import {
  BANK_0_OFFSET,
  CPU_STATE_BUFFER,
  ROM_128_0_OFFSET,
  ROM_48_OFFSET,
} from "../memory-map";
import { MemoryHelper } from "../memory-helpers";
import { spectrumKeyCodes } from "../spectrum-keys";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
const SP48_MAIN_ENTRY = 0x12ac;

/**
 * Entry point in the ROM when the start menu is ready
 */
const SP128_MENU = 0x2653;

/**
 * The ZX Spectrum 128 editor entry point in the ROM
 */
const SP128_EDITOR = 0x2604;

/**
 * This class represents a ZX Spectrum 48 machine
 */
export class ZxSpectrum128 extends ZxSpectrumBase {
  /**
   * The type identifier of the machine
   */
  readonly typeId = "sp128";

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 128K";

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Uint8Array[]) {
    super(api, roms);
  }

  /**
   * ZX Spectrum 128 supports the AY-3-8912 PSG chip
   */
  get supportsPsg(): boolean {
    return true;
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new Spectrum128MachineState();
  }

  /**
   * Gets the memory address of the first ROM page of the machine
   */
  getRomPageBaseAddress(): number {
    return 0;
  }

  /**
   * Gets the specified memory partition
   * @param partition Partition index
   */
  getMemoryPartition(partition: number): Uint8Array {
    let offset = 0;
    if (partition === 0x10) {
      offset = ROM_128_0_OFFSET;
    } else if (partition === 0x11) {
      offset = ROM_48_OFFSET;
    } else {
      offset = BANK_0_OFFSET + (partition & 0x07) * 0x4000;
    }
    const mh = new MemoryHelper(this.api, offset);
    const result = new Uint8Array(0x4000);
    for (let j = 0; j < 0x4000; j++) {
      result[j] = mh.readByte(j);
    }
    return result;
  }

  /**
   * Gets the current state of the ZX Spectrum machine
   */
  getMachineState(): MachineState {
    const s = super.getMachineState() as Spectrum128MachineState;
    // --- Done.
    return s as MachineState;
  }

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(model: string): Promise<number> {
    const controller = this.vmEngineController;
    await controller.start(
      new ExecuteCycleOptions(
        EmulationMode.UntilExecutionPoint,
        DebugStepMode.None,
        true,
        0,
        SP128_MENU
      )
    );
    await controller.waitForCycleTermination();

    if (model !== "48") {
      // --- Use ZX Spectrum 128
      await controller.start(
        new ExecuteCycleOptions(
          EmulationMode.UntilExecutionPoint,
          DebugStepMode.None,
          true,
          0,
          SP128_EDITOR
        )
      );
      await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
      await controller.delayKey(spectrumKeyCodes.Enter);
      await controller.waitForCycleTermination();
      return SP128_EDITOR;
    }

    // --- Use ZX Spectrum 48
    await controller.start(
      new ExecuteCycleOptions(
        EmulationMode.UntilExecutionPoint,
        DebugStepMode.None,
        true,
        1,
        SP48_MAIN_ENTRY
      )
    );
    await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
    await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
    await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
    await controller.delayKey(spectrumKeyCodes.Enter);
    await controller.waitForCycleTermination();
    return SP48_MAIN_ENTRY;
  }
}
