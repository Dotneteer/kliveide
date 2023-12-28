import {
  MI_SPECTRUM_48,
  MI_SPECTRUM_128,
  MI_Z88,
  MF_TAPE_SUPPORT,
  MI_SPECTRUM_3E,
  MC_SCREEN_FREQ,
  MF_ROM,
  MF_BANK,
  MC_DISK_SUPPORT,
  MC_MEM_SIZE,
  MC_SCREEN_SIZE,
  MF_ULA,
  MF_BLINK,
  MF_PSG
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
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true,
    },
    models: [
      {
        modelId: "pal",
        displayName: "ZX Spectrum 48K",
        config: {
          [MC_SCREEN_FREQ]: "pal"
        }
      },
      {
        modelId: "ntsc",
        displayName: "ZX Spectrum 48K (NTSC)",
        config: {
          [MC_SCREEN_FREQ]: "ntsc"
        }
      },
      {
        modelId: "pal-16k",
        displayName: "ZX Spectrum 16K",
        config: {
          [MC_SCREEN_FREQ]: "pal",
          [MC_MEM_SIZE]: 16
        }
      }
    ]
  },
  {
    machineId: MI_SPECTRUM_128,
    displayName: "ZX Spectrum 128K",
    features: {
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true,
      [MF_PSG]: true,
      [MF_ROM]: 2,
      [MF_BANK]: 8
    }
  },
  {
    machineId: MI_SPECTRUM_3E,
    displayName: "ZX Spectrum +2E/+3E",
    features: {
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true,
      [MF_PSG]: true,
      [MF_ROM]: 4,
      [MF_BANK]: 8
    },
    models: [
      {
        modelId: "nofdd",
        displayName: "ZX Spectrum +2E",
        config: {
          [MC_DISK_SUPPORT]: 0
        }
      },
      {
        modelId: "fdd1",
        displayName: "ZX Spectrum +3E (1 FDD)",
        config: {
          [MC_DISK_SUPPORT]: 1
        }
      },
      {
        modelId: "fdd2",
        displayName: "ZX Spectrum +3E (2 FDDs)",
        config: {
          [MC_DISK_SUPPORT]: 2
        }
      }
    ]
  },
  {
    machineId: MI_Z88,
    displayName: "Cambridge Z88 WIP",
    features: {
      [MF_BANK]: 256,
      [MF_BLINK]: true,
    },
    models: [
      {
        modelId: "640_64",
        displayName: "Cambridge Z88 WIP (640x64)",
        config: {
          [MC_SCREEN_SIZE]: "640x64"
        }
      },
      {
        modelId: "640_320",
        displayName: "Cambridge Z88 WIP (640x320)",
        config: {
          [MC_SCREEN_SIZE]: "640x320"
        }
      },
      {
        modelId: "640_480",
        displayName: "Cambridge Z88 WIP (640x480)",
        config: {
          [MC_SCREEN_SIZE]: "640x480"
        }
      },
      {
        modelId: "800_320",
        displayName: "Cambridge Z88 WIP (800x320)",
        config: {
          [MC_SCREEN_SIZE]: "800x320"
        }
      },
      {
        modelId: "800_480",
        displayName: "Cambridge Z88 WIP (800x480)",
        config: {
          [MC_SCREEN_SIZE]: "800x480"
        }
      }
    ]
  }
];
