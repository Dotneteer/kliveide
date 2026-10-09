import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { IFileProvider } from "@renderer/core/IFileProvider";

import { machineRegistry } from "@common/machines/machine-registry";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { artifactNameOf, headlessUnsupportedMessage } from "./headlessMachines";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { ZxSpectrumP3eWasmV2Machine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { Zx8081WasmV2Machine } from "@emu/machines/zx8081/Zx8081WasmV2Machine";
import { getSp128Model } from "@emu/machines/zxSpectrum128/sp128Timings";

/*
 * The machines that run without the emulator window (`.plans/Z80_UNIT_TESTS_PLAN.md` D6, D18;
 * `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D15, D16): the production `*WasmV2Machine` classes,
 * created the way the test harnesses create them - the WASM core's bytes come from the caller
 * (`readArtifact`) and the ROMs from a file provider - so the unit-test runner works in a
 * `worker_threads` worker and in a vitest test, and `klive test`/`klive run` work from the command
 * line. Nothing here reads settings or imports Electron (Z80_UNIT_TESTS_PLAN T11).
 */

/** The machines the factory can create */
export type HeadlessMachine =
  | ZxSpectrum48WasmV2Machine
  | ZxSpectrum128WasmV2Machine
  | ZxSpectrumP3eWasmV2Machine
  | ZxNextWasmV2Machine
  | Zx8081WasmV2Machine;

/** What a headless machine is created from */
export type HeadlessMachineSpec = {
  /** The machine id: `sp48`, `sp128`, `spp3e`, `zxnext`, `zx80`, `zx81` */
  machineId: string;
  /** The model id, as the project names it (`pal-16k`, `fdd1`, ...); the machine's first model when absent */
  modelId?: string;
  /** Configuration over the model's own */
  config?: MachineConfigSet;
  /** The WASM core's bytes, by artifact name (`zx-spectrum48.wasm`, ...) */
  readArtifact: (artifactName: string) => Uint8Array | Promise<Uint8Array>;
  /** ROMs and firmware: paths relative to the app's public folder (`roms/sp48.rom`) or absolute */
  fileProvider: IFileProvider;
};

/** The registry model of a machine: the one named, or the first */
export function modelOf(machineId: string, modelId: string | undefined): MachineModel | undefined {
  const models = machineRegistry.find((m) => m.machineId === machineId)?.models;
  return models?.find((m) => m.modelId === modelId) ?? models?.[0];
}

/**
 * Creates a machine, sets it up and hard-resets it, as the IDE's machine start does
 * @throws Error naming the machine when it cannot run headless
 */
export async function createHeadlessMachine(spec: HeadlessMachineSpec): Promise<HeadlessMachine> {
  const unsupported = headlessUnsupportedMessage(spec.machineId);
  if (unsupported) throw new Error(unsupported);
  const artifactName = artifactNameOf(spec.machineId);
  const loader = {
    artifactName: `headless-${artifactName}`,
    readArtifact: async (): Promise<BufferSource> => (await spec.readArtifact(artifactName)) as Uint8Array<ArrayBuffer>
  };
  const model =
    spec.machineId === MI_SPECTRUM_128
      ? (getSp128Model(spec.modelId) ?? modelOf(spec.machineId, spec.modelId))
      : modelOf(spec.machineId, spec.modelId);
  const config: MachineConfigSet = { ...(model?.config ?? {}), ...(spec.config ?? {}) };

  let machine: HeadlessMachine;
  switch (spec.machineId) {
    case MI_SPECTRUM_48:
      machine = new ZxSpectrum48WasmV2Machine(model, config, loader);
      break;
    case MI_SPECTRUM_128:
      machine = new ZxSpectrum128WasmV2Machine(model, config, loader);
      break;
    case MI_SPECTRUM_3E:
      machine = new ZxSpectrumP3eWasmV2Machine(model ? { ...model, config } : undefined, config, loader);
      break;
    case MI_ZX80:
    case MI_ZX81:
      machine = new Zx8081WasmV2Machine(spec.machineId, model, config, undefined, loader);
      break;
    default:
      machine = new ZxNextWasmV2Machine(model, config, undefined, loader);
      break;
  }
  machine.setMachineProperty(FILE_PROVIDER, spec.fileProvider);
  await machine.setup();
  machine.hardReset();
  return machine;
}
