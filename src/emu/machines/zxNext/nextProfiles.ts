import { NEXT_ROM_SETS, type NextRomSet, type NextRomSetId } from "@common/zxnext/romSets";

/*
 * The ZX Spectrum Next models (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D1, D2).
 *
 * A model is a *Next profile*: a board and a core version, each with its own WASM artifact, VHDL
 * reference, NextReg set, ROM set and SD card. Everything that depends on "which Next" reads it
 * from the active profile, never from a literal. Model ids never change once shipped.
 *
 * Neutral: no emulation. The emulator, the main process (the SD card), the IDE (the NEX check, the
 * menus) and the tests read it.
 */

export type NextProfileId = "ks2-30201" | "ks2-30204";

export type NextBoard = "ks1" | "ks2" | "ks3";

export type NextProfile = {
  /** The model id */
  id: NextProfileId;
  /** The board, which decides NextReg $0F, the $11 video timing rules and the audio bias */
  board: NextBoard;
  /** The board issue the FPGA's `g_board_issue` generic carries, as NextReg $0F reads it */
  boardIssue: number;
  /** The core version NextReg $01/$0E report, and what a NEX file's minimum core is checked against */
  coreVersion: [major: number, minor: number, subMinor: number];
  /** The WASM artifact's file name, in `src/emu/machines/zxNext/wasm/dist/` (D3) */
  wasmArtifact: string;
  /** The NextZXOS release the model boots (D9): its ROMs, SD base image and ROM facts */
  romSet: NextRomSetId;
  /** The default SD card working copy in the Klive home folder (D7) */
  sdWorkingCopy: string;
  /** Which NextReg description set the IDE shows (D5) */
  nextRegSet: string;
  /** The version key of the VHDL reference in `vendor/next-fpga/sources.json` (D4) */
  vhdlRef: string;
};

export const NEXT_PROFILES: Readonly<Record<NextProfileId, NextProfile>> = {
  "ks2-30201": {
    id: "ks2-30201",
    board: "ks2",
    boardIssue: 2,
    coreVersion: [3, 2, 1],
    wasmArtifact: "zx-spectrum-next.wasm",
    romSet: "nextzxos-2.08",
    // --- The working copy every Klive before Next models wrote: no rename (D7)
    sdWorkingCopy: "ks2.cim",
    nextRegSet: "30201",
    vhdlRef: "3.02.01"
  },
  "ks2-30204": {
    id: "ks2-30204",
    board: "ks2",
    boardIssue: 2,
    coreVersion: [3, 2, 4],
    wasmArtifact: "zx-spectrum-next-ks2-30204.wasm",
    // --- The distribution's `KS3` release, which ships core 3.02.04 for KS2 boards too (D9)
    romSet: "nextzxos-2.10",
    sdWorkingCopy: "ks2-30204.cim",
    nextRegSet: "30204",
    vhdlRef: "3.02.04"
  }
};

/** The profiles in the order the machine's models list them */
export const NEXT_PROFILE_IDS = Object.keys(NEXT_PROFILES) as NextProfileId[];

/** The model a Next reference without a model id means (D1) */
export const IMPLICIT_NEXT_PROFILE_ID: NextProfileId = "ks2-30201";

/**
 * The model a *new* project starts on (D7): the newest supported core. Unlike the implicit model,
 * which says what an old reference without a model meant, this is a choice for new work.
 */
export const NEW_PROJECT_NEXT_PROFILE_ID: NextProfileId = "ks2-30204";

/**
 * Model ids that are gone, and the profile each now means (D1): `standard` was the one Next model
 * before models were profiles, `compatibility` the TypeScript emulator's.
 */
export const NEXT_PROFILE_ALIASES: Readonly<Record<string, NextProfileId>> = {
  standard: "ks2-30201",
  compatibility: "ks2-30201"
};

/** Whether a model id names a profile (aliases resolved) */
export function isNextProfileId(modelId: string | undefined): boolean {
  return modelId !== undefined && (modelId in NEXT_PROFILES || modelId in NEXT_PROFILE_ALIASES);
}

/**
 * The profile a model id means: the profile itself, an alias's target, or (no id, or one Klive does
 * not know) the implicit one
 * @param modelId The model id, as saved
 */
export function nextProfileOf(modelId?: string): NextProfile {
  if (modelId !== undefined) {
    const direct = NEXT_PROFILES[modelId as NextProfileId];
    if (direct) return direct;
    const alias = NEXT_PROFILE_ALIASES[modelId];
    if (alias) return NEXT_PROFILES[alias];
  }
  return NEXT_PROFILES[IMPLICIT_NEXT_PROFILE_ID];
}

/** The ROM set a profile boots */
export function romSetOf(profile: NextProfile): NextRomSet {
  return NEXT_ROM_SETS[profile.romSet];
}

/** The core version a profile reports, as the tuple `validateNexHeader` compares against */
export function coreVersionOf(profile: NextProfile): [number, number, number] {
  return [...profile.coreVersion] as [number, number, number];
}

/** The core version as Klive writes it ("3.02.01") */
export function coreVersionText(profile: NextProfile): string {
  const [major, minor, sub] = profile.coreVersion;
  return `${major}.${String(minor).padStart(2, "0")}.${String(sub).padStart(2, "0")}`;
}

/**
 * A Next model's display name: the board and the core version. Machine and model names are not
 * translated (`.ai/i18n-guide.md`, D9).
 */
export function nextModelDisplayName(modelId: string): string {
  const profile = nextProfileOf(modelId);
  return `ZX Spectrum Next (${profile.board.toUpperCase()}, core ${coreVersionText(profile)})`;
}

/**
 * The core id a profile's state files and checkpoints carry (`wasmStateImage.ts`). The layout
 * fingerprint does not see code, so two artifacts with the same statics would take each other's
 * states: the id tells them apart. KS2 / 3.02.01 keeps `zxnext`, so its earlier state files open.
 */
export function stateCoreIdOf(profile: NextProfile): string {
  return profile.id === IMPLICIT_NEXT_PROFILE_ID ? "zxnext" : `zxnext/${profile.id}`;
}

/** The profile a Next state core id belongs to, or undefined for another machine's */
export function profileOfStateCoreId(coreId: string): NextProfile | undefined {
  if (coreId === "zxnext") return NEXT_PROFILES[IMPLICIT_NEXT_PROFILE_ID];
  const match = /^zxnext\/(.+)$/.exec(coreId);
  return match ? NEXT_PROFILES[match[1] as NextProfileId] : undefined;
}
