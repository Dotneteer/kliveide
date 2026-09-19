import { machineRegistry } from "@common/machines/machine-registry";
import { MC_Z88_INTRAM } from "@common/machines/constants";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";

/**
 * The configuration of the TypeScript Z88 test machine: 512K internal RAM and the default 640x64
 * LCD. `setup()` is never called, so no ROM is loaded: slot 0 holds the blank 512K ROM card the
 * banked memory starts with.
 *
 * Until 2026-09-19 the test machine passed its arguments in the wrong order
 * (`super({} as Store, model, {})`), so the machine's config was the model object itself and every
 * `MC_*` lookup fell back to its default. This configuration states those defaults explicitly; the
 * machine the suites see is unchanged.
 */
export const Z88_TEST_CONFIG = {
  [MC_Z88_INTRAM]: 0x1f
};

/**
 * The TypeScript Z88 machine the core test suites use (through `z88-backends.ts`) and the partition
 * description tests use directly.
 */
export class Z88TestMachine extends Z88Machine {
  constructor() {
    const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
    super(model, Z88_TEST_CONFIG, undefined);
  }
}
