import type { MachineUiRendererInfo } from "./info-types";

import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { createZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory";
import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_48,
  MI_SPECTRUM_3E,
  MI_Z88,
  MI_ZXNEXT,
  MI_C64
} from "./constants";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { C64Machine } from "@emu/machines/c64/C64Machine";

export const machineRendererRegistry: MachineUiRendererInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    factory: (_, model, config) => createZxSpectrum48Machine(model, config)
  },
  {
    machineId: MI_SPECTRUM_128,
    factory: (_, model, config) => createZxSpectrum128Machine(model, config)
  },
  {
    machineId: MI_SPECTRUM_3E,
    factory: (_, model, config) => createZxSpectrumP3eMachine(model, config)
  },
  {
    machineId: MI_ZXNEXT,
    factory: (_, model, config, messenger) => createZxNextMachine(model, config, messenger)
  },
  {
    machineId: MI_Z88,
    factory: (_, model, config, messenger) => new Z88Machine(model, config, messenger)
  },
  {
    machineId: MI_C64,
    factory: (_, model) => new C64Machine(model)
  },
];
