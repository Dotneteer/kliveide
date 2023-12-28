import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_48,
  MI_SPECTRUM_3E,
  MI_Z88
} from "./constants";
import { MachineUiRendererInfo } from "./info-types";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";

export const machineRendererRegistry: MachineUiRendererInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    factory: (_, model) => new ZxSpectrum48Machine(model)
  },
  {
    machineId: MI_SPECTRUM_128,
    factory: () => new ZxSpectrum128Machine()
  },
  {
    machineId: MI_SPECTRUM_3E,
    factory: (store, model) => new ZxSpectrumP3EMachine(store, model)
  },
  {
    machineId: MI_Z88,
    factory: (_, model, config) => new Z88Machine(model, config)
  }
];
