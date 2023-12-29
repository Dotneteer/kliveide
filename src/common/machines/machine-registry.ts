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
  MF_PSG,
  MC_Z88_INTROM
} from "./constants";
import {
  MachineConfigSet,
  MachineInfo,
  MachineModel,
  MachineWithModel
} from "./info-types";

/**
 * The registry of available machine types with their available models
 */
export const machineRegistry: MachineInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    displayName: "ZX Spectrum 48K",
    features: {
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true
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
    displayName: "Cambridge Z88",
    features: {
      [MF_BANK]: 256,
      [MF_BLINK]: true
    },
    models: [
      {
        modelId: "OZ50",
        displayName: "Cambridge Z88 (OZ v5.0 r1f99aaae)",
        config: {
          [MC_Z88_INTROM]: "z88v50-r1f99aaae"
        }
      },
      {
        modelId: "OZ47",
        displayName: "Cambridge Z88 (OZ v4.7)",
        config: {
          [MC_Z88_INTROM]: "z88v47"
        }
      },
      {
        modelId: "OZ40",
        displayName: "Cambridge Z88 (OZ v4.0 UK)",
        config: {
          [MC_Z88_INTROM]: "z88v40"
        }
      }
    ]
  }
];

/**
 * Gets all available machine models
 * @returns
 */
export function getAllMachineModels (): MachineWithModel[] {
  const result: MachineWithModel[] = [];
  for (const machine of machineRegistry) {
    if (machine.models) {
      result.push(
        ...machine.models.map(m => ({
          ...m,
          machineId: machine.machineId
        }))
      );
    } else {
      result.push({
        machineId: machine.machineId,
        displayName: machine.displayName
      });
    }
  }
  return result;
}

/**
 * Gets the configuration of the specified machine
 * @param machineId Machine ID
 * @param modelId Model ID
 * @returns Machine configuration
 */
export function getModelConfig (
  machineId: string,
  modelId?: string
): MachineConfigSet | undefined {
  const machine = machineRegistry.find(m => m.machineId === machineId);
  if (!machine) {
    return undefined;
  }
  if (!modelId) {
    return machine.config;
  }
  const model = machine.models?.find(m => m.modelId === modelId);
  return model?.config;
}
