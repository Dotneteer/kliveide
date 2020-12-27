import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "./wa-api";
import {
  Spectrum128MachineState,
  MachineState,
  ExecuteCycleOptions,
  EmulationMode,
  DebugStepMode,
} from "../../shared/machines/machine-state";
import {
  BANK_0_OFFS,
  ROM_128_0_OFFS,
  ROM_48_OFFS,
  STATE_TRANSFER_BUFF,
} from "./memory-map";
import { SpectrumKeyCode } from "./SpectrumKeyCode";
import { MemoryHelper } from "./memory-helpers";

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
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api, roms);
    // --- Turn on hooks for all instruction-related events
    api.setCpuDiagnostics(0x0000);
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
    return ROM_128_0_OFFS;
  }

  /**
   * Gets the specified memory partition
   * @param partition Partition index
   */
  getMemoryPartition(partition: number): Uint8Array {
    let offset = 0;
    if (partition === 0x10) {
      offset = ROM_128_0_OFFS;
    } else if (partition === 0x11) {
      offset = ROM_48_OFFS;
    } else {
      offset = BANK_0_OFFS + (partition & 0x07) * 0x4000;
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

    let mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    // --- Get PSG state
    s.psgToneA = mh.readUint16(420);
    s.psgToneAEnabled = mh.readBool(422);
    s.psgNoiseAEnabled = mh.readBool(423);
    s.psgVolA = mh.readByte(424);
    s.psgEnvA = mh.readBool(425);
    s.psgCntA = mh.readUint16(426);
    s.psgBitA = mh.readBool(428);

    s.psgToneB = mh.readUint16(429);
    s.psgToneBEnabled = mh.readBool(431);
    s.psgNoiseBEnabled = mh.readBool(432);
    s.psgVolB = mh.readByte(433);
    s.psgEnvB = mh.readBool(434);
    s.psgCntB = mh.readUint16(435);
    s.psgBitB = mh.readBool(437);

    s.psgToneC = mh.readUint16(438);
    s.psgToneCEnabled = mh.readBool(440);
    s.psgNoiseCEnabled = mh.readBool(441);
    s.psgVolC = mh.readByte(442);
    s.psgEnvC = mh.readBool(443);
    s.psgCntC = mh.readUint16(444);
    s.psgBitC = mh.readBool(446);

    s.psgNoiseSeed = mh.readUint16(447);
    s.psgNoiseFreq = mh.readUint16(449);
    s.psgCntNoise = mh.readUint16(451);
    s.psgBitNoise = mh.readBool(453);
    s.psgEvnFreq = mh.readUint16(454);
    s.psgEnvStyle = mh.readByte(456);
    s.psgCntEnv = mh.readUint16(457);
    s.psgPosEnv = mh.readUint16(459);

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
      await controller.delayKey(SpectrumKeyCode.N6, SpectrumKeyCode.CShift);
      await controller.delayKey(SpectrumKeyCode.Enter);
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
    await controller.delayKey(SpectrumKeyCode.N6, SpectrumKeyCode.CShift);
    await controller.delayKey(SpectrumKeyCode.N6, SpectrumKeyCode.CShift);
    await controller.delayKey(SpectrumKeyCode.N6, SpectrumKeyCode.CShift);
    await controller.delayKey(SpectrumKeyCode.Enter);
    await controller.waitForCycleTermination();
    return SP48_MAIN_ENTRY;
  }

  private ioLog: [string, string][] = [];

  /**
   * Override this method to define an action when the virtual machine has
   * started.
   * @param debugging Is started in debug mode?
   */
  async beforeStarted(debugging: boolean): Promise<void> {
    await super.beforeStarted(debugging);
    this.ioLog = [];
  }

  /**
   * Override this action to define an action when the virtual machine
   * has paused.
   * @param isFirstPause Is the machine paused the first time?
   */
  async onPaused(isFirstPause: boolean): Promise<void> {
    await super.onPaused(isFirstPause);
  }

  /**
   * CPU hook. Invoked when the CPU writes to an I/O port
   * @param address The memory address read
   * @param value The memory value read
   */
  ioWritten(address: number, value: number): void {
    this.ioLog.push([
      address.toString(16),
      value.toString(16).padStart(2, "0"),
    ]);
  }
}
