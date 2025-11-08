import type { MachineConfigSet, MachineInfo, MachineWithModel } from "./info-types";

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
  MF_ULA,
  MF_BLINK,
  MF_PSG,
  MC_Z88_INTRAM,
  MC_Z88_INTROM,
  CT_CUSTOM_DISASSEMBLER,
  CT_DISASSEMBLER_VIEW,
  MC_Z88_KEYBOARD,
  MC_Z88_SLOT0,
  MI_ZXNEXT,
  MF_ALLOW_CLOCK_MULTIPLIER,
  MI_C64,
  MF_Z80,
  MF_M6510,
  CT_DISASSEMBLER,
  MF_VIC
} from "./constants";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "../../common/structs/project-const";
import { ZxNextChars, ZxSpectrumChars } from "./char-codes";
import { DisassemblyOptions, MemorySection } from "../disassemblers/common-types";
import { Z80Disassembler } from "../disassemblers/z80-disassembler/z80-disassembler";
import { ZxSpectrum48CustomDisassembler } from "../disassemblers/z80-disassembler/zx-spectrum-48-disassembler";
import { ZxSpectrumNextCustomDisassembler } from "../disassemblers/z80-disassembler/zx-spectrum-next-disassembler";
import { Z88CustomDisassembler } from "../disassemblers/z80-disassembler/z88-custom.disassembler";
import { M6510Disassembler } from "../disassemblers/6510-disassembler/m6510-disassembler";

/**
 * The registry of available machine types with their available models
 */
export const machineRegistry: MachineInfo[] = [
  {
    machineId: MI_SPECTRUM_48,
    displayName: "ZX Spectrum 48K",
    charSet: ZxSpectrumChars,
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
    ],
    mediaIds: [MEDIA_TAPE],
    toolInfo: {
      [CT_DISASSEMBLER]: (
        memorySections: MemorySection[],
        memoryContents: Uint8Array,
        partitionLabels?: string[],
        options?: DisassemblyOptions
      ) => new Z80Disassembler(memorySections, memoryContents, partitionLabels, options),
      [CT_CUSTOM_DISASSEMBLER]: () => new ZxSpectrum48CustomDisassembler()
    }
  },
  {
    machineId: MI_SPECTRUM_128,
    displayName: "ZX Spectrum 128K",
    charSet: ZxSpectrumChars,
    features: {
      [MF_Z80]: true,
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true,
      [MF_PSG]: true,
      [MF_ROM]: 2,
      [MF_BANK]: 8
    },
    mediaIds: [MEDIA_TAPE],
    toolInfo: {
      [CT_DISASSEMBLER]: (
        memorySections: MemorySection[],
        memoryContents: Uint8Array,
        partitionLabels?: string[],
        options?: DisassemblyOptions
      ) => new Z80Disassembler(memorySections, memoryContents, partitionLabels, options)
    }
  },
  {
    machineId: MI_SPECTRUM_3E,
    displayName: "ZX Spectrum +2E/+3E",
    charSet: ZxSpectrumChars,
    features: {
      [MF_Z80]: true,
      [MF_TAPE_SUPPORT]: true,
      [MF_ULA]: true,
      [MF_PSG]: true,
      [MF_ROM]: 4,
      [MF_BANK]: 8
    },
    mediaIds: [MEDIA_TAPE, MEDIA_DISK_A, MEDIA_DISK_B],
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
    ],
    toolInfo: {
      [CT_DISASSEMBLER]: (
        memorySections: MemorySection[],
        memoryContents: Uint8Array,
        partitionLabels?: string[],
        options?: DisassemblyOptions
      ) => new Z80Disassembler(memorySections, memoryContents, partitionLabels, options)
    }
  },
  {
    machineId: MI_ZXNEXT,
    displayName: "ZX Spectrum Next",
    charSet: ZxNextChars,
    features: {
      [MF_Z80]: true,
      [MF_TAPE_SUPPORT]: false,
      [MF_ULA]: true,
      [MF_ROM]: 7,
      [MF_BANK]: 224,
      [MF_ALLOW_CLOCK_MULTIPLIER]: false
    },
    mediaIds: [MEDIA_TAPE],
    toolInfo: {
      [CT_DISASSEMBLER]: (
        memorySections: MemorySection[],
        memoryContents: Uint8Array,
        partitionLabels?: string[],
        options?: DisassemblyOptions
      ) => new Z80Disassembler(memorySections, memoryContents, partitionLabels, options),
      [CT_CUSTOM_DISASSEMBLER]: () => new ZxSpectrumNextCustomDisassembler()
    }
  },
  {
    machineId: MI_Z88,
    displayName: "Cambridge Z88",
    charSet: ZxSpectrumChars,
    features: {
      [MF_Z80]: true,
      [MF_BANK]: 256,
      [MF_BLINK]: true
    },
    models: [
      {
        // Default Intel 4S5 chip type for 512K image file, default 512K RAM for slot 0, default UK KB Layout
        modelId: "OZ50",
        displayName: "Cambridge Z88 (OZ v5.0 r1f99aaae)",
        config: {
          [MC_Z88_INTRAM]: 0x1f, // 512K
          [MC_Z88_INTROM]: "z88v50-r1f99aaae",
          [MC_Z88_SLOT0]: {
            size: 512,
            cardType: "AMDF29F040B",
            file: "z88v50-r1f99aaae"
          }
        }
      },
      {
        // Default Intel 4S5 chip type for 512K image file, default 512K RAM for slot 0, default UK KB Layout
        modelId: "OZ47",
        displayName: "Cambridge Z88 (OZ v4.7)",
        config: {
          [MC_Z88_INTRAM]: 0x1f, // 512K
          [MC_Z88_INTROM]: "z88v47",
          [MC_Z88_SLOT0]: {
            size: 512,
            cardType: "AMDF29F040B",
            file: "z88v47"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 128K RAM for slot 0, default UK KB Layout
        modelId: "OZ40",
        displayName: "Cambridge Z88 (OZ v4.0 UK)",
        config: {
          [MC_Z88_INTRAM]: 0x07, // 128K
          [MC_Z88_INTROM]: "z88ukv40",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88ukv40"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 128K RAM for slot 0, default Swedish/Finish KB Layout
        modelId: "OZ40FI",
        displayName: "Cambridge Z88 (OZ v4.01 SE/FI)",
        config: {
          [MC_Z88_INTRAM]: 0x07, // 128K
          [MC_Z88_INTROM]: "z88fiv401",
          [MC_Z88_KEYBOARD]: "se",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88fiv401"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default UK KB Layout
        modelId: "OZ30",
        displayName: "Cambridge Z88 (OZ v3.0 UK)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88ukv30",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88ukv30"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default Italian KB Layout
        modelId: "OZ323IT",
        displayName: "Cambridge Z88 (OZ v3.23 IT)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88itv323",
          [MC_Z88_KEYBOARD]: "it",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88itv323"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default French KB Layout
        modelId: "OZ326FR",
        displayName: "Cambridge Z88 (OZ v3.26 FR)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88frv326",
          [MC_Z88_KEYBOARD]: "fr",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88frv326"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default Spanish KB Layout
        modelId: "OZ319ES",
        displayName: "Cambridge Z88 (OZ v3.19 ES)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88esv319",
          [MC_Z88_KEYBOARD]: "es",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88esv319"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default Danish KB Layout
        modelId: "OZ321DK",
        displayName: "Cambridge Z88 (OZ v3.21 DK)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88dkv321",
          [MC_Z88_KEYBOARD]: "dk",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88dkv321"
          }
        }
      },
      {
        // Default ROM type for 128K image file, default 32K RAM for slot 0, default German KB Layout
        modelId: "OZ318DE",
        displayName: "Cambridge Z88 (OZ v3.18 DE)",
        config: {
          [MC_Z88_INTRAM]: 0x01, // 32K
          [MC_Z88_INTROM]: "z88dev318",
          [MC_Z88_KEYBOARD]: "de",
          [MC_Z88_SLOT0]: {
            size: 128,
            cardType: "ROM",
            file: "z88dev318"
          }
        }
      }
    ],
    toolInfo: {
      [CT_CUSTOM_DISASSEMBLER]: () => new Z88CustomDisassembler(),
      [CT_DISASSEMBLER_VIEW]: {
        showRamOption: false,
        showScreenOption: false
      }
    }
  },
  {
    machineId: MI_C64,
    displayName: "Commodore 64 (experimental)",
    charSet: ZxSpectrumChars,
    features: {
      [MF_M6510]: true,
      [MF_VIC]: true,
      [MF_TAPE_SUPPORT]: true
    },
    models: [
      {
        modelId: "pal",
        displayName: "Commodore 64 (experimental)",
        config: {
          [MC_SCREEN_FREQ]: "pal"
        }
      },
      {
        modelId: "ntsc",
        displayName: "Commodore 64 (experimental, NTSC)",
        config: {
          [MC_SCREEN_FREQ]: "ntsc"
        }
      }
    ],
    mediaIds: [MEDIA_TAPE],
    toolInfo: {
      [CT_DISASSEMBLER]: (
        memorySections: MemorySection[],
        memoryContents: Uint8Array,
        _?: string[],
        options?: DisassemblyOptions
      ) => new M6510Disassembler(memorySections, memoryContents, options),
      [CT_CUSTOM_DISASSEMBLER]: () => new ZxSpectrum48CustomDisassembler()
    }
  }
];

/**
 * Gets the name of the specified machine
 * @param machineId Machine ID to get
 * @param modelId Model ID to get
 * @returns Model name
 */
export function getMachineName(machineId: string, modelId?: string): string {
  const machine = machineRegistry.find((m) => m.machineId === machineId);
  if (!machine) {
    return "";
  }
  if (!modelId) {
    return machine.displayName;
  }
  const model = machine.models?.find((m) => m.modelId === modelId);
  return model?.displayName ?? "";
}

/**
 * Gets all available machine models
 * @returns
 */
export function getAllMachineModels(): MachineWithModel[] {
  const result: MachineWithModel[] = [];
  for (const machine of machineRegistry) {
    if (machine.models) {
      result.push(
        ...machine.models.map((m) => ({
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
export function getModelConfig(machineId: string, modelId?: string): MachineConfigSet | undefined {
  const machine = machineRegistry.find((m) => m.machineId === machineId);
  if (!machine) {
    return undefined;
  }
  if (!modelId) {
    return machine.config;
  }
  const model = machine.models?.find((m) => m.modelId === modelId);
  return model?.config;
}
