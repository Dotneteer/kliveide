import {
  MC_MEM_SIZE,
  MC_ZX80_ROM8K,
  MI_SCORPION,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_ZX80,
  MI_ZX81,
  MI_ZXNEXT
} from "@common/machines/constants";

/*
 * How a machine's memory is named in annotations: the **bank space**.
 *
 * Annotations, sidecar breakpoints and label breakpoints all talk about a place in memory as a 16K
 * bank and an offset in it, because that is what survives paging: `call DrawSprite` names the same
 * bytes whichever slot their bank happens to sit in. What differs between machines is the arithmetic
 * between that site and a Z80 address, and it used to be written out four times, every time as the
 * ZX Spectrum Next's 8K-page arithmetic. On a 128K that arithmetic is not wrong loudly — a bank
 * breakpoint simply never fires (T1 of `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`).
 *
 * So every conversion goes through one object per machine, and `bankSpaceFor` is the only place a
 * machine id is looked at.
 *
 * - `next`: a partition is an 8K page; 16K bank B is pages 2B and 2B+1, in any two slots.
 * - `sp128` / `plus3` / `scorpion`: a partition is the 16K bank itself (`getCurrentPartitions`
 *   reports it twice, once per 8K half of the slot — T3). Negative partitions are ROM.
 * - `sp48`: no partitions at all (T2). Its memory is named as the 128K's banks 5, 2 and 0, which is
 *   what a 48K snapshot's RAM maps to, so a 48K program annotated once keeps its annotations on a
 *   128K in 48K mode (A3).
 * - `timex`: HOME as the 48K. A DOCK or EXROM chunk is not annotatable: no site.
 * - `zx81` / `zx80`: no partitions; a fixed map with mirrors that depend on the model (T11). An
 *   address folds to its *canonical* address — the lowest one a data access reaches the byte at, the
 *   rule the core's profile layout uses — and the canonical RAM is cut into 16K blocks.
 */

/** Which bank space a machine's annotations are numbered in. Not a machine model. */
export type AnnotationMachine =
  | "next"
  | "sp48"
  | "sp128"
  | "plus3"
  | "scorpion"
  | "timex"
  | "zx81"
  | "zx80"
  | "rom";

/** One partition index per 8K slot, as `resolveMem64kPartitions` / `getCurrentPartitions` give it. */
export type SlotPaging = readonly (number | undefined)[] | undefined;

/** A place in a RAM bank. */
export type BankSite = { bank: number; offset: number };

/** Where a Z80 address is: in a RAM bank, or in a ROM page (by the partition it is paged as). */
export type MemorySite =
  | { kind: "bank"; bank: number; offset: number }
  | { kind: "rom"; partition: number; offset: number };

/**
 * A bank breakpoint armed on a machine with no partitions matches whatever is paged at its address:
 * the 48K and the ZX80/ZX81 have nothing else there. Distinct from every real partition index.
 */
export const ANY_PARTITION = Number.MIN_SAFE_INTEGER;

export interface BankSpace {
  readonly id: AnnotationMachine;
  readonly bankSize: 0x4000;
  /** The highest bank number a sidecar for this space may hold. */
  readonly maxBank: number;
  /** The RAM banks this machine has, in listing order. */
  readonly ramBanks: readonly number[];
  /** The Next's extended opcodes. */
  readonly extendedSet: boolean;
  /** Whether `bp-set <bank>:+<offset>` means anything here (not on the ZX80/ZX81: no banks). */
  readonly bankBreakpoints: boolean;
  /** Where an address is now, or `undefined` for memory that cannot be annotated. */
  siteAt(address: number, slots: SlotPaging): MemorySite | undefined;
  /** Every address a bank site is visible at now: none, one, or several (two slots, mirrors). */
  addressesOf(site: BankSite, slots: SlotPaging): number[];
  /**
   * The breakpoint partition a bank site is matched against, or `undefined` when the machine has
   * none and the site's address alone decides.
   */
  partitionOf(site: BankSite): number | undefined;
  /**
   * Every address a bank breakpoint could appear at under *any* paging: the addresses it is armed
   * at, the partition test at fire time picking out the real one.
   */
  candidateAddresses(site: BankSite): number[];
  /** Which 16K slot a bank is listed at when nothing else says (`offsetIndex`). */
  defaultOffsetIndex(bank: number): 0 | 1 | 2 | 3;
}

const BANK_SIZE = 0x4000 as const;

function slotPartition(slots: SlotPaging, address: number): number | undefined {
  return slots?.[(address >> 13) & 0x07];
}

/** The 128K-style default listing slot: bank 5 at `$4000`, bank 2 at `$8000`, the rest at `$C000`. */
function spectrumOffsetIndex(bank: number): 0 | 1 | 2 | 3 {
  return bank === 5 ? 1 : bank === 2 ? 2 : 3;
}

// ------------------------------------------------------------------------------------------------
// The ZX Spectrum Next: 8K pages

export const nextBankSpace: BankSpace = {
  id: "next",
  bankSize: BANK_SIZE,
  maxBank: 111,
  ramBanks: Array.from({ length: 112 }, (_, i) => i),
  extendedSet: true,
  bankBreakpoints: true,
  siteAt(address, slots) {
    const page = slotPartition(slots, address);
    if (page === undefined) return undefined;
    if (page < 0) return { kind: "rom", partition: page, offset: address & 0x1fff };
    return { kind: "bank", bank: page >> 1, offset: (page & 0x01) * 0x2000 + (address & 0x1fff) };
  },
  addressesOf(site, slots) {
    const page = nextPartitionOf(site);
    const result: number[] = [];
    for (let slot = 0; slot < 8; slot++) {
      if (slots?.[slot] === page) result.push(slot * 0x2000 + (site.offset & 0x1fff));
    }
    return result;
  },
  partitionOf: nextPartitionOf,
  candidateAddresses(site) {
    const pageOffset = site.offset & 0x1fff;
    return Array.from({ length: 8 }, (_, slot) => slot * 0x2000 + pageOffset);
  },
  defaultOffsetIndex: spectrumOffsetIndex
};

/** The 8K page a Next bank site is in: `2B` for the low half of bank B, `2B+1` for the high. */
function nextPartitionOf(site: BankSite): number {
  return site.bank * 2 + ((site.offset >> 13) & 0x01);
}

// ------------------------------------------------------------------------------------------------
// The 128K family: 16K partitions

function sixteenKBankSpace(id: AnnotationMachine, banks: number): BankSpace {
  return {
    id,
    bankSize: BANK_SIZE,
    maxBank: banks - 1,
    ramBanks: Array.from({ length: banks }, (_, i) => i),
    extendedSet: false,
    bankBreakpoints: true,
    siteAt(address, slots) {
      const partition = slotPartition(slots, address);
      if (partition === undefined) return undefined;
      const offset = address & 0x3fff;
      return partition < 0
        ? { kind: "rom", partition, offset }
        : { kind: "bank", bank: partition, offset };
    },
    addressesOf(site, slots) {
      const result: number[] = [];
      for (let slot16 = 0; slot16 < 4; slot16++) {
        // --- Each 16K slot is reported twice (T3); its first 8K entry speaks for both.
        if (slots?.[slot16 * 2] === site.bank) result.push(slot16 * 0x4000 + site.offset);
      }
      return result;
    },
    partitionOf: (site) => site.bank,
    candidateAddresses: (site) => [0, 1, 2, 3].map((slot16) => slot16 * 0x4000 + site.offset),
    defaultOffsetIndex: spectrumOffsetIndex
  };
}

export const sp128BankSpace = sixteenKBankSpace("sp128", 8);
export const plus3BankSpace = sixteenKBankSpace("plus3", 8);
export const scorpionBankSpace = sixteenKBankSpace("scorpion", 16);

// ------------------------------------------------------------------------------------------------
// The 48K and the Timex HOME bank: a fixed map, named as the 128K's banks 5, 2 and 0

/** The 48K's RAM, by 16K slot: `$4000` is bank 5, `$8000` bank 2, `$C000` bank 0. */
const FIXED_48K_BANKS = [undefined, 5, 2, 0] as const;

function fixed48kAddress(site: BankSite): number | undefined {
  const slot16 = FIXED_48K_BANKS.indexOf(site.bank as 5 | 2 | 0);
  return slot16 > 0 ? slot16 * 0x4000 + site.offset : undefined;
}

function fixed48kSite(address: number): MemorySite {
  const slot16 = (address >> 14) & 0x03;
  return slot16 === 0
    ? { kind: "rom", partition: -1, offset: address & 0x3fff }
    : { kind: "bank", bank: FIXED_48K_BANKS[slot16]!, offset: address & 0x3fff };
}

export const sp48BankSpace: BankSpace = {
  id: "sp48",
  bankSize: BANK_SIZE,
  maxBank: 7,
  ramBanks: [5, 2, 0],
  extendedSet: false,
  bankBreakpoints: true,
  siteAt: (address) => fixed48kSite(address & 0xffff),
  addressesOf(site) {
    const address = fixed48kAddress(site);
    return address === undefined ? [] : [address];
  },
  // --- No partitions: the address alone decides.
  partitionOf: () => undefined,
  candidateAddresses(site) {
    const address = fixed48kAddress(site);
    return address === undefined ? [] : [address];
  },
  defaultOffsetIndex: spectrumOffsetIndex
};

/** The Timex partition of a HOME chunk: `-1`/`-2` for the ROM chunks, the chunk itself for RAM. */
function timexHomePartition(chunk: number): number {
  return chunk < 2 ? -(chunk + 1) : chunk;
}

export const timexBankSpace: BankSpace = {
  id: "timex",
  bankSize: BANK_SIZE,
  maxBank: 7,
  ramBanks: [5, 2, 0],
  extendedSet: false,
  bankBreakpoints: true,
  siteAt(address, slots) {
    const chunk = (address >> 13) & 0x07;
    // --- Only HOME is annotatable (Q4): a DOCK or EXROM chunk has no site.
    if (slots && slots.length > 0 && slots[chunk] !== timexHomePartition(chunk)) return undefined;
    return fixed48kSite(address & 0xffff);
  },
  addressesOf(site, slots) {
    const address = fixed48kAddress(site);
    if (address === undefined) return [];
    const chunk = address >> 13;
    return slots && slots.length > 0 && slots[chunk] !== timexHomePartition(chunk) ? [] : [address];
  },
  // --- The HOME RAM chunk the site is in: a breakpoint there must not fire while DOCK is paged.
  partitionOf(site) {
    const address = fixed48kAddress(site);
    return address === undefined ? undefined : address >> 13;
  },
  candidateAddresses(site) {
    const address = fixed48kAddress(site);
    return address === undefined ? [] : [address];
  },
  defaultOffsetIndex: spectrumOffsetIndex
};

// ------------------------------------------------------------------------------------------------
// The ZX80 and ZX81: canonical addresses, mirrors by model

/** What the ZX80/ZX81 map depends on: the RAM size and which ROM is fitted. */
export type Zx8081MemoryModel = {
  ramKb: 1 | 16 | 64;
  /** The 8K ZX81 ROM (also the ZX80 upgrade); otherwise the ZX80's 4K. */
  rom8k: boolean;
};

/**
 * The ZX80/ZX81 bank space for one model. The fold follows the core's data read
 * (`zx8081-memory.c`): below the RAM base the ROM, masked to its size; from it the RAM, masked to
 * its size. So the canonical address of a RAM byte is `base + (address & mask)`, and of a ROM byte
 * `address & romMask`.
 */
export function zx8081BankSpace(
  id: "zx81" | "zx80",
  model: Zx8081MemoryModel
): BankSpace & { canonicalAddress(address: number): number } {
  const romMask = model.rom8k ? 0x1fff : 0x0fff;
  const ramBase = model.ramKb === 64 ? 0x2000 : 0x4000;
  const ramMask = model.ramKb === 64 ? 0xffff : model.ramKb === 16 ? 0x3fff : 0x03ff;
  const ramBanks = model.ramKb === 64 ? [0, 1, 2, 3] : [1];

  const canonicalAddress = (address: number): number => {
    const a = address & 0xffff;
    if (a < ramBase) return a & romMask;
    return model.ramKb === 64 ? a : ramBase + (a & ramMask);
  };

  /** Every CPU address a canonical RAM address is seen at, the canonical one first. */
  const ramMirrors = (canonical: number): number[] => {
    if (model.ramKb === 64) return [canonical];
    const result: number[] = [];
    const step = ramMask + 1;
    for (let a = ramBase + (canonical & ramMask); a <= 0xffff; a += step) result.push(a);
    return result;
  };

  const isCanonicalRam = (address: number): boolean =>
    address >= ramBase && canonicalAddress(address) === address;

  return {
    id,
    bankSize: BANK_SIZE,
    maxBank: 3,
    ramBanks,
    extendedSet: false,
    // --- No banks to page: a bank breakpoint is refused, a label one resolves to its address.
    bankBreakpoints: false,
    canonicalAddress,
    siteAt(address) {
      const a = address & 0xffff;
      if (a < ramBase) return { kind: "rom", partition: -1, offset: a & romMask };
      const canonical = canonicalAddress(a);
      return { kind: "bank", bank: canonical >> 14, offset: canonical & 0x3fff };
    },
    addressesOf(site) {
      const canonical = site.bank * BANK_SIZE + site.offset;
      return isCanonicalRam(canonical) ? ramMirrors(canonical) : [];
    },
    partitionOf: () => undefined,
    candidateAddresses(site) {
      const canonical = site.bank * BANK_SIZE + site.offset;
      return isCanonicalRam(canonical) ? ramMirrors(canonical) : [];
    },
    defaultOffsetIndex: (bank) => (bank & 0x03) as 0 | 1 | 2 | 3
  };
}

/** Every address a ROM offset is visible at on a ZX80/ZX81 model: the ROM and its mirrors below the RAM. */
export function zx8081RomAddresses(model: Zx8081MemoryModel, offset: number): number[] {
  const romSize = model.rom8k ? 0x2000 : 0x1000;
  const ramBase = model.ramKb === 64 ? 0x2000 : 0x4000;
  const result: number[] = [];
  for (let a = offset & (romSize - 1); a < ramBase; a += romSize) result.push(a);
  return result;
}

// ------------------------------------------------------------------------------------------------
// Choosing one

/** The ZX80/ZX81 model a machine configuration describes (`resolveZx8081Hardware`'s rule). */
export function zx8081MemoryModelOf(
  machineId: string,
  config: Record<string, any> | undefined
): Zx8081MemoryModel {
  const isZx81 = machineId === MI_ZX81;
  const mem = Number(config?.[MC_MEM_SIZE] ?? 16);
  return {
    ramKb: mem >= 64 && isZx81 ? 64 : mem >= 16 ? 16 : 1,
    rom8k: isZx81 || config?.[MC_ZX80_ROM8K] === true
  };
}

/**
 * The bank space of a machine, or `undefined` for one whose memory cannot be annotated (the Z88,
 * the C64). **The only place a machine id is checked** for annotation arithmetic.
 *
 * @param config the machine's model configuration; only the ZX80/ZX81 need it
 */
export function bankSpaceFor(
  machineId: string | undefined,
  config?: Record<string, any>
): BankSpace | undefined {
  switch (machineId) {
    case MI_ZXNEXT:
      return nextBankSpace;
    case MI_SPECTRUM_48:
      return sp48BankSpace;
    case MI_SPECTRUM_128:
      return sp128BankSpace;
    case MI_SPECTRUM_3E:
      return plus3BankSpace;
    case MI_SCORPION:
      return scorpionBankSpace;
    case MI_TIMEX:
      return timexBankSpace;
    case MI_ZX81:
    case MI_ZX80:
      return zx8081BankSpace(machineId, zx8081MemoryModelOf(machineId, config));
    default:
      return undefined;
  }
}

/** The bank space a sidecar's `machine` names, for the machines whose space needs no configuration. */
export function bankSpaceForAnnotationMachine(machine: AnnotationMachine): BankSpace | undefined {
  switch (machine) {
    case "next":
      return nextBankSpace;
    case "sp48":
      return sp48BankSpace;
    case "sp128":
      return sp128BankSpace;
    case "plus3":
      return plus3BankSpace;
    case "scorpion":
      return scorpionBankSpace;
    case "timex":
      return timexBankSpace;
    case "zx81":
      return zx8081BankSpace("zx81", { ramKb: 16, rom8k: true });
    case "zx80":
      return zx8081BankSpace("zx80", { ramKb: 16, rom8k: false });
    default:
      return undefined;
  }
}

/** The `machine` a new sidecar for this machine id is written with. */
export function annotationMachineFor(machineId: string | undefined): AnnotationMachine | undefined {
  return bankSpaceFor(machineId)?.id;
}

/**
 * Whether a sidecar written for `fileMachine` reads correctly on a machine with `current` bank
 * space, and the warning to show when it might not. A 48K file on a 128K is the normal case (A3):
 * banks 5, 2 and 0 mean the same on both, so that pair warns about nothing.
 */
export function annotationMachineWarning(
  fileMachine: AnnotationMachine,
  current: AnnotationMachine | undefined
): string | undefined {
  if (!current || fileMachine === current) return undefined;
  const spectrum48Like = new Set<AnnotationMachine>(["sp48", "timex"]);
  const spectrumBanked = new Set<AnnotationMachine>(["sp48", "timex", "sp128", "plus3", "scorpion"]);
  if (spectrum48Like.has(fileMachine) && spectrumBanked.has(current)) return undefined;
  return `These annotations were written for the ${fileMachine} bank space; this machine numbers its memory as ${current}. Labels may name the wrong bytes.`;
}
