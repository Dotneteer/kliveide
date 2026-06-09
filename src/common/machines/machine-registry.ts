import {
  MC_MEM_SIZE,
  MC_SCREEN_FREQ,
  MF_TAPE_SUPPORT,
  MF_ULA,
  MF_Z80,
  MI_SPECTRUM_48
} from "./constants";
import type { MachineConfigSet, MachineInfo, MachineModel } from "./info-types";

export type MachineSelection = {
  machineId: string;
  modelId?: string;
  config: MachineConfigSet;
};

export const DEFAULT_MACHINE_ID = MI_SPECTRUM_48;
export const DEFAULT_MODEL_ID = "pal";

export const machineRegistry: MachineInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    displayName: "ZX Spectrum 48K",
    features: {
      [MF_Z80]: true,
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
  }
  // {
  //   machineId: MI_SPECTRUM_128,
  //   displayName: "ZX Spectrum 128K",
  //   features: {
  //     [MF_Z80]: true,
  //     [MF_TAPE_SUPPORT]: true,
  //     [MF_ULA]: true,
  //     [MF_PSG]: true,
  //     [MF_ROM]: 2,
  //     [MF_BANK]: 8
  //   }
  // },
  // {
  //   machineId: MI_SPECTRUM_3E,
  //   displayName: "ZX Spectrum +2E/+3E",
  //   features: {
  //     [MF_Z80]: true,
  //     [MF_TAPE_SUPPORT]: true,
  //     [MF_ULA]: true,
  //     [MF_PSG]: true,
  //     [MF_ROM]: 4,
  //     [MF_BANK]: 8
  //   },
  //   models: [
  //     {
  //       modelId: "nofdd",
  //       displayName: "ZX Spectrum +2E",
  //       config: {
  //         [MC_DISK_SUPPORT]: 0
  //       }
  //     },
  //     {
  //       modelId: "fdd1",
  //       displayName: "ZX Spectrum +3E (1 FDD)",
  //       config: {
  //         [MC_DISK_SUPPORT]: 1
  //       }
  //     },
  //     {
  //       modelId: "fdd2",
  //       displayName: "ZX Spectrum +3E (2 FDDs)",
  //       config: {
  //         [MC_DISK_SUPPORT]: 2
  //       }
  //     }
  //   ]
  // },
  // {
  //   machineId: MI_ZXNEXT,
  //   displayName: "ZX Spectrum Next",
  //   features: {
  //     [MF_Z80]: true,
  //     [MF_TAPE_SUPPORT]: false,
  //     [MF_ULA]: true,
  //     [MF_ROM]: 7,
  //     [MF_BANK]: 224,
  //     [MF_ALLOW_SCAN_LINES]: false
  //   }
  // }
];

export function getMachineInfo(machineId?: string): MachineInfo | undefined {
  return machineRegistry.find((machine) => machine.machineId === machineId);
}

export function getModelInfo(machineId?: string, modelId?: string): MachineModel | undefined {
  return getMachineInfo(machineId)?.models?.find((model) => model.modelId === modelId);
}

export function getMachineConfig(machineId?: string, modelId?: string): MachineConfigSet {
  const machine = getMachineInfo(machineId);
  const model = getModelInfo(machineId, modelId);
  return {
    ...(machine?.config ?? {}),
    ...(model?.config ?? {})
  };
}

export function getMachineName(machineId?: string, modelId?: string): string {
  const machine = getMachineInfo(machineId);
  if (!machine) {
    return machineId ?? "";
  }

  if (!modelId) {
    return machine.displayName;
  }

  return getModelInfo(machineId, modelId)?.displayName ?? machine.displayName;
}

export function resolveMachineSelection(
  machineId?: string,
  modelId?: string,
  config?: MachineConfigSet
): MachineSelection {
  const machine = getMachineInfo(machineId) ?? getMachineInfo(DEFAULT_MACHINE_ID);
  if (!machine) {
    return {
      machineId: DEFAULT_MACHINE_ID,
      modelId: DEFAULT_MODEL_ID,
      config: {}
    };
  }

  const resolvedModel = machine.models?.length
    ? getModelInfo(machine.machineId, modelId) ?? machine.models[0]
    : undefined;
  const resolvedModelId = resolvedModel?.modelId;
  const baseConfig = getMachineConfig(machine.machineId, resolvedModelId);

  return {
    machineId: machine.machineId,
    modelId: resolvedModelId,
    config: {
      ...baseConfig,
      ...(config ?? {})
    }
  };
}
