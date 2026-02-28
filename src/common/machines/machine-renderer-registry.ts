import type { MachineUiRendererInfo } from "./info-types";

import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_48,
  MI_SPECTRUM_3E,
  MI_Z88,
  MI_ZXNEXT,
  MI_C64
} from "./constants";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { C64Machine } from "@emu/machines/c64/C64Machine";

export const machineRendererRegistry: MachineUiRendererInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    factory: (_, model, config) => new ZxSpectrum48Machine(model, config)
  },
  {
    machineId: MI_SPECTRUM_128,
    factory: () => new ZxSpectrum128Machine()
  },
  {
    machineId: MI_SPECTRUM_3E,
    factory: (_, model) => new ZxSpectrumP3EMachine(model!)
  },
  {
    machineId: MI_ZXNEXT,
    factory: (_, model, _c, messenger) => new ZxNextMachine(model, messenger)
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
