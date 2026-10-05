import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import { MC_DISK_SUPPORT, MC_SP3_ROM_SET } from "@common/machines/constants";

/*
 * The ROM sets the `spp3e` core boots (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md`, P2-P4). The core is the
 * Amstrad +2A/+3 gate array whichever set is loaded; what differs between the sets is the ROM
 * images and the few ROM addresses the IDE's flows wait for. This table owns those addresses: no
 * flow writes one as a literal.
 *
 * The Amstrad addresses were found by running each ROM in the test harness (P5): the menu is
 * reached once, when it is drawn and starts waiting for a key; the editor point is passed once on
 * the way into "+3 BASIC", with the same stack as on the +3E ($5BF3), and a program returning there
 * leaves a working editor. All of them are in ROM 0; the 48 BASIC entry is the 48K ROM's, in ROM 3.
 * The +3E is derived from v4.0 and keeps its addresses; v4.1 and the Spanish v4.1 moved them.
 * `test/zxSpectrum/p3-rom-sets.test.ts` checks every row on the real ROMs.
 */

/** The ROM set ids, the values of `MC_SP3_ROM_SET` */
export type P3RomSetId = "plus3e" | "amstrad40" | "amstrad41" | "amstrad41es";

/** What Klive knows about one ROM set */
export type P3RomSet = {
  id: P3RomSetId;
  /** The ROM file name stem: pages are `roms/<romId>-0..3.rom` */
  romId: string;
  /** How the set is described in the machine list and the hardware sheet */
  description: string;
  /** True for Amstrad's own ROMs; false for the +3E replacement */
  amstrad: boolean;
  /** Where the start-up menu settles to wait for a key, in ROM 0 */
  mainWaitingLoop: number;
  /**
   * Where "+3 BASIC" enters its editor, in ROM 0; a program injected there returns to it and the
   * editor carries on
   */
  returnToEditor: number;
  /** The 48 BASIC main execution cycle, in ROM 3 */
  sp48MainEntry: number;
};

/** The default set: no `MC_SP3_ROM_SET` means the +3E ROMs */
export const P3_DEFAULT_ROM_SET: P3RomSetId = "plus3e";

export const P3_ROM_SETS: Record<P3RomSetId, P3RomSet> = {
  plus3e: {
    id: "plus3e",
    romId: "spp3e",
    description: "+3E ROMs (Garry Lancaster)",
    amstrad: false,
    mainWaitingLoop: 0x0706,
    returnToEditor: 0x0937,
    sp48MainEntry: 0x12ac
  },
  amstrad40: {
    id: "amstrad40",
    romId: "spp3-40",
    description: "Amstrad ROMs v4.0",
    amstrad: true,
    mainWaitingLoop: 0x0706,
    returnToEditor: 0x0937,
    sp48MainEntry: 0x12ac
  },
  amstrad41: {
    id: "amstrad41",
    romId: "spp3-41",
    description: "Amstrad ROMs v4.1",
    amstrad: true,
    mainWaitingLoop: 0x070b,
    returnToEditor: 0x093c,
    sp48MainEntry: 0x12ac
  },
  amstrad41es: {
    id: "amstrad41es",
    romId: "spp3-41es",
    description: "Amstrad ROMs v4.1 (Spanish)",
    amstrad: true,
    mainWaitingLoop: 0x070b,
    returnToEditor: 0x0953,
    sp48MainEntry: 0x12ac
  }
};

/** The ROM set a machine configuration selects; an unknown or missing value is the +3E set */
export function getP3RomSet(config: MachineConfigSet | undefined): P3RomSet {
  const id = config?.[MC_SP3_ROM_SET];
  return (typeof id === "string" && P3_ROM_SETS[id as P3RomSetId]) || P3_ROM_SETS[P3_DEFAULT_ROM_SET];
}

/**
 * The snapshot machine a +2A/+3/+2E/+3E is: an Amstrad set is a +2A without drives and a +3 with
 * them; the +3E ROMs make it a "+3e" whatever the drives.
 */
export function p3SnapshotKind(set: P3RomSet, drives: number): "plus2a" | "plus3" | "plus3e" {
  if (!set.amstrad) return "plus3e";
  return drives > 0 ? "plus3" : "plus2a";
}

/** The model ids of the `spp3e` machine */
export type P3ModelId =
  | "nofdd"
  | "fdd1"
  | "fdd2"
  | "plus2a"
  | "plus2a-es"
  | "plus3-fdd1"
  | "plus3-fdd2"
  | "plus3-v40-fdd1"
  | "plus3-v40-fdd2"
  | "plus3-es-fdd1"
  | "plus3-es-fdd2";

/** The registry models of the `spp3e` machine. Their ids never change: projects refer to them. */
export const P3_MODELS: MachineModel[] = [
  // --- The +E models come first: they are the defaults (plan Q4)
  p3Model("nofdd", "ZX Spectrum +2E", 0, "plus3e"),
  p3Model("fdd1", "ZX Spectrum +3E (1 FDD)", 1, "plus3e"),
  p3Model("fdd2", "ZX Spectrum +3E (2 FDDs)", 2, "plus3e"),
  // --- Amstrad's machines with their own ROMs. The +2A shipped only with v4.1.
  p3Model("plus2a", "ZX Spectrum +2A", 0, "amstrad41"),
  p3Model("plus2a-es", "ZX Spectrum +2A (Spanish)", 0, "amstrad41es"),
  p3Model("plus3-fdd1", "ZX Spectrum +3 (1 FDD)", 1, "amstrad41"),
  p3Model("plus3-fdd2", "ZX Spectrum +3 (2 FDDs)", 2, "amstrad41"),
  p3Model("plus3-v40-fdd1", "ZX Spectrum +3 v4.0 (1 FDD)", 1, "amstrad40"),
  p3Model("plus3-v40-fdd2", "ZX Spectrum +3 v4.0 (2 FDDs)", 2, "amstrad40"),
  p3Model("plus3-es-fdd1", "ZX Spectrum +3 (Spanish, 1 FDD)", 1, "amstrad41es"),
  p3Model("plus3-es-fdd2", "ZX Spectrum +3 (Spanish, 2 FDDs)", 2, "amstrad41es")
];

function p3Model(modelId: P3ModelId, displayName: string, drives: number, romSet: P3RomSetId): MachineModel {
  return {
    modelId,
    displayName,
    config: { [MC_DISK_SUPPORT]: drives, [MC_SP3_ROM_SET]: romSet }
  };
}

/** The model of the `spp3e` machine, by id */
export function getP3Model(modelId: string | undefined): MachineModel | undefined {
  return modelId === undefined ? undefined : P3_MODELS.find((m) => m.modelId === modelId);
}

/** The drives a model has (0 for an unknown one) */
export function p3ModelDrives(modelId: string | undefined): number {
  const drives = getP3Model(modelId)?.config?.[MC_DISK_SUPPORT];
  return typeof drives === "number" ? drives : 0;
}

/** The ROM set of a model (the +3E set for an unknown one) */
export function p3ModelRomSet(modelId: string | undefined): P3RomSet {
  return getP3RomSet(getP3Model(modelId)?.config);
}
