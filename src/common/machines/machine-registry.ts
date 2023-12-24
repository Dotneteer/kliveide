import {
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_Z88,
  MF_TAPE_SUPPORT,
  MI_SPECTRUM_P2_3,
  MC_SCREEN_FREQ,
  MF_ROM,
  MF_BANK,
  MC_DISK_SUPPORT
} from "./constants";
import { MachineInfo } from "./info-types";

/**
 * The registry of available machine types with their available models
 */
export const machineRegistry: MachineInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    displayName: "ZX Spectrum 48K",
    features: {
      [MF_TAPE_SUPPORT]: true
    },
    models: [
      {
        modelId: "pal",
        displayInMainMenu: false,
        displayName: "ZX Spectrum 48K (PAL, 50Hz)",
        config: {
          [MC_SCREEN_FREQ]: "pal"
        }
      },
      {
        modelId: "ntsc",
        displayInMainMenu: false,
        displayName: "ZX Spectrum 48K (NTSC, 60Hz)",
        config: {
          [MC_SCREEN_FREQ]: "ntsc"
        }
      }
    ]
  },
  {
    machineId: MI_SPECTRUM_128,
    displayName: "ZX Spectrum 128K",
    features: {
      [MF_TAPE_SUPPORT]: true,
      [MF_ROM]: 2,
      [MF_BANK]: 8
    }
  },
  {
    machineId: MI_SPECTRUM_P2_3,
    displayName: "ZX Spectrum +2E/+3E",
    features: {
      [MF_TAPE_SUPPORT]: true,
      [MF_ROM]: 4,
      [MF_BANK]: 8
    },
    models: [
      {
        modelId: "nofdd",
        displayInMainMenu: true,
        displayName: "ZX Spectrum +2E (no FDD)",
        config: {
          [MC_DISK_SUPPORT]: 0
        }
      },
      {
        modelId: "fdd1",
        displayInMainMenu: true,
        displayName: "ZX Spectrum +3E (1 FDD)",
        config: {
          [MC_DISK_SUPPORT]: 1
        }
      },
      {
        modelId: "fdd2",
        displayInMainMenu: false,
        displayName: "ZX Spectrum +3E (2 FDDs)",
        config: {
          [MC_DISK_SUPPORT]: 2
        }
      }
    ],
    hasDefaultModel: true
  },
  {
    machineId: MI_Z88,
    displayName: "Cambridge Z88",
    features: {
      [MF_BANK]: 256
    }
  }
];
