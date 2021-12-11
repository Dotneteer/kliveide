import { CodeToInject } from "@abstractions/code-runner-service";
import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  MachineCreationOptions,
} from "@abstractions/vm-core-types";
import { spectrumKeyCodes } from "./spectrum-keys";
import {
  SP128_MAIN_WAITING_LOOP,
  SP128_RETURN_TO_EDITOR,
  SP48_MAIN_ENTRY,
  ZxSpectrumCoreBase,
} from "./ZxSpectrumCoreBase";

/**
 * ZX Spectrum +3E core implementation
 */
export class ZxSpectrumP3eCore extends ZxSpectrumCoreBase {
  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
  }

  /**
   * Gets the unique model identifier of the machine
   */
  getModelId(): string {
    return "spP3e";
  }

  /**
   * The name of the module file with the WA machine engine
   */
  readonly waModuleFile: string = "sp128.wasm";

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum +3E";

  /**
   * Indicates if this model supports the AY-3-8912 PSG chip
   */
  get supportsPsg(): boolean {
    return true;
  }

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(model: string): Promise<number> {
    const controller = this.controller;
    console.log(model);
    switch (model) {
      default:
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_MAIN_WAITING_LOOP
          )
        );
        await controller.waitForCycleTermination();
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_RETURN_TO_EDITOR
          )
        );
        await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
        await controller.delayKey(spectrumKeyCodes.Enter);
        await controller.waitForCycleTermination();
        return SP128_RETURN_TO_EDITOR;
      case "48":
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_MAIN_WAITING_LOOP
          )
        );
        await controller.waitForCycleTermination();
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
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

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  async injectCodeToRun(codeToInject: CodeToInject): Promise<number> {
    // --- Inject the code as with ZX Spectrum 48
    const startPoint = await super.injectCodeToRun(codeToInject);

    // --- In ZX Spectrum 48 mode, we're done.
    if (codeToInject.model === "48") {
      return startPoint;
    }

    // --- Inject calling stub
    const stubAddr = 0x5b68;
    const stubCode: number[] = [
      0xcd,
      0x00,
      0x5b, // call $5b00
      0xcd,
      startPoint & 0xff,
      (startPoint >> 8) & 0xff, // call the program
      0x21,
      0x08,
      0x5c, // ld hl,(LAST_K)
      0x36,
      0xff, // ld (hl),$ff
      0xfb, // ei
      0x7e, // wait: ld a,(hl)
      0xfe,
      0xff, // cp $ff
      0x28,
      0xfb, // jr z,wait
      0xc3,
      0x00,
      0x5b, // jp $5b00
    ];
    for (let i = 0; i < stubCode.length; i++) {
      this.writeMemory(stubAddr + i, stubCode[i]);
    }
    return stubAddr;
  }
}
