import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { Sp48WasmV2LoaderOptions, Sp48WasmV2Runtime } from "../zxSpectrum48/wasm/Sp48WasmV2Loader";
import type { JoystickConnector } from "../zxNext/IZxNextHostInputMachine";

import { MI_TIMEX } from "@common/machines/constants";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { TIMEX_ROM_FILE } from "../machine-props";
import { SP48_MAIN_ENTRY } from "../ZxSpectrumBase";
import { ZxSpectrum48WasmV2Machine } from "../zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { WasmFloatingBusDevice } from "../zxSpectrum/WasmSpectrumSupport";
import { TC2048_ROM_SIZE, getTimexModel, type TimexModel } from "./timexModels";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import {
  timexLoaderOptions,
  validateTimexOwnExports,
  type TimexWasmV2Exports
} from "./wasm/TimexWasmV2Loader";

/**
 * The Timex Computer 2048 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a) on the Timex core.
 *
 * The core is the 48K machine built with Timex's SCLD (`timex.c`), so this is the 48K's machine
 * with the SCLD's own parts: the model's hard reset, the 704-wide picture shown at half width, the
 * built-in Kempston port, and the ROM - the user's TC2048 ROM when the settings name one, the
 * Sinclair 48K ROM otherwise (plan P5: Klive cannot ship Timex's).
 */
export class TimexWasmV2Machine extends ZxSpectrum48WasmV2Machine {
  public override readonly machineId: string = MI_TIMEX;
  /** The model's facts (`timexModels.ts`) */
  readonly timexModel: TimexModel;
  /** Which ROM the machine booted, for the Machine menu and the docs' wording */
  romInUse: "tc2048" | "sp48" = "sp48";
  /** Why the TC2048 ROM named in the settings is not in use (undefined when none is named or it is) */
  timexRomProblem?: string;

  constructor(modelInfo?: MachineModel, config?: MachineConfigSet, loaderOptions?: Sp48WasmV2LoaderOptions) {
    super(modelInfo, config, timexLoaderOptions(loaderOptions));
    this.timexModel = getTimexModel(modelInfo?.config);
    this.baseClockFrequency = this.timexModel.clockHz;
    // --- Port $FF belongs to the SCLD here, so the floating bus is read through its own export
    this.floatingBusDevice = new WasmFloatingBusDevice(
      this,
      () => this.wasmV2Runtime?.exports.sp48ReadFloatingBus?.() ?? 0xff
    );
  }

  /** The Timex core's exports */
  get timexExports(): TimexWasmV2Exports {
    return this.requireWasmV2Runtime().exports as TimexWasmV2Exports;
  }

  /** The 48K ROM's resources serve the fallback; the TC2048 ROM comes from the settings */
  override get romId(): string {
    return "sp48";
  }

  protected override async loadMachineRom(): Promise<Uint8Array> {
    this.romInUse = "sp48";
    this.timexRomProblem = undefined;
    const path = this.getMachineProperty(TIMEX_ROM_FILE) as string | undefined;
    if (path) {
      try {
        const rom = await this.loadRomFromResource(path);
        if (rom.length === TC2048_ROM_SIZE) {
          this.romInUse = "tc2048";
          return rom;
        }
        this.timexRomProblem = `The TC2048 ROM must be ${TC2048_ROM_SIZE} bytes; ${path} has ${rom.length}`;
      } catch (err) {
        this.timexRomProblem = `Cannot read the TC2048 ROM ${path}: ${(err as Error)?.message ?? err}`;
      }
    }
    return await super.loadMachineRom();
  }

  protected override get stateCoreId(): string {
    return MI_TIMEX;
  }

  protected override hardResetCore(runtime: Sp48WasmV2Runtime): void {
    const exports = runtime.exports as TimexWasmV2Exports;
    validateTimexOwnExports(exports, runtime.artifactName);
    exports.timexHardReset(this.timexModel.coreModel);
  }

  /** Two buffer pixels per Spectrum pixel: a line's tacts are a quarter of the buffer width */
  override get tactsInDisplayLine(): number {
    return this.screenWidthInPixels / 4;
  }

  /** The 704-wide buffer shows at the 48K's proportions (as the Next's 720) */
  getAspectRatio = (): [number, number] => [0.5, 1];

  /**
   * The built-in Kempston port, driven by joystick 1's pins (`useEmulatorJoystick`): the pin order
   * (right, left, down, up, fire 1) is the Kempston port's bit order. The TC2048 has one socket.
   */
  setJoystickState(side: JoystickConnector, bits: number): void {
    if (side !== "left") return;
    (this.wasmV2Runtime?.exports as TimexWasmV2Exports | undefined)?.timexSetKempston(bits & 0x1f);
  }

  /** The SCLD's control register (port $FF) */
  getScldPortFf(): number {
    return this.timexExports.timexGetPortFf();
  }

  /**
   * A snapshot's SCLD: port $FF (the restore's reset cleared it), and the picture redrawn in that
   * mode. The 48K's restore has put everything else in.
   */
  protected override restoreSnapshotExtras(snapshot: SpectrumSnapshot): void {
    const exports = this.timexExports;
    exports.timexSetPortFf((snapshot.timex?.portFf ?? 0) & 0xff);
    exports.sp48RenderInstantScreen();
  }

  /** The 48K's capture, named a TC2048, with the SCLD's ports */
  protected override captureSnapshotExtras(snapshot: SpectrumSnapshot): SpectrumSnapshot {
    return {
      ...snapshot,
      machine: "tc2048",
      timex: { portF4: 0, portFf: this.timexExports.timexGetPortFf() }
    };
  }

  /**
   * Code built for the 48K runs on the TC2048, whose ROM keeps the 48K's main loop
   * (`SP48_MAIN_ENTRY`; the TC2048 ROM changes only the CALL at $1299)
   */
  override async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model === "sp48" || model === MI_TIMEX || model === this.timexModel.id) {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP48_MAIN_ENTRY)})`
        },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: SP48_MAIN_ENTRY }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }
}
