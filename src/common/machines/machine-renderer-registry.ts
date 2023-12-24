import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_48,
  MI_SPECTRUM_P2_3,
  MI_Z88
} from "./constants";
import { MachineUiRendererInfo } from "./info-types";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";

export const machineRendererRegistry: MachineUiRendererInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    factory: (store, model) => new ZxSpectrum48Machine()
  },
  {
    machineId: MI_SPECTRUM_128,
    factory: (store, model) => new ZxSpectrum128Machine()
  },
  {
    machineId: MI_SPECTRUM_P2_3,
    factory: (store, model) => new ZxSpectrum128Machine()
  },
  {
    machineId: MI_Z88,
    factory: (store, model) => new Z88Machine()
  }
];
