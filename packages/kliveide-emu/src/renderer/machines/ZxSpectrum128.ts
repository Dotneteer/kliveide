import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "./wa-api";
import {
  Spectrum128MachineState,
  MachineState,
  ExecuteCycleOptions,
  EmulationMode,
  DebugStepMode,
} from "../../shared/machines/machine-state";
import { ROM_128_0_OFFS } from "./memory-map";
import { SpectrumKeyCode } from "./SpectrumKeyCode";

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
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(model: string): Promise<number> {
    const controller = this.vmEngineController;
    await controller.run(
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
      await controller.run(
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
    await controller.run(
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
   * @param _debugging Is started in debug mode?
   * @param _isFirstStart Is the machine started from stopped state?
   */
  async onStarted(_debugging: boolean, _isFirstStart: boolean): Promise<void> {
    this.ioLog = [];
  }

  /**
   * Override this action to define an action when the virtual machine
   * has paused.
   * @param _isFirstPause Is the machine paused the first time?
   */
  async onPaused(_isFirstPause: boolean): Promise<void> {
    super.onPaused(_isFirstPause);
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
