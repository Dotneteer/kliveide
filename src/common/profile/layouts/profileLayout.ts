/*
 * A core's profile layout (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2, D11): how its linear
 * profile offsets lie over its partitions. The core's `Z80_PROFILE_PHYS_READ`/`_WRITE` macros produce
 * offsets; a layout names them in the IDE's own terms - the partition numbers `getPartitionLabels`
 * labels - so a banked source line is checked against its own bank's byte, not whatever was mapped at
 * its address.
 */

/** A stretch of profile offsets that one partition owns */
export type ProfileRegion = {
  /** The partition (as `getPartitionLabels` numbers it) */
  partition: number;
  /** Its first profile offset */
  start: number;
  /** Its size, when it differs from the layout's `partitionSize` (the Next's 16K ROMs among 8K pages) */
  size?: number;
  /** Whether it is ROM (the views' "Exclude ROM", T11) */
  rom?: boolean;
};

export type ProfileLayout = {
  /** The layout's name (one per core, models may share it) */
  id: string;
  /** The core's physical span: `Z80_PROFILE_FLAG_BYTES` */
  flagBytes: number;
  /** Bytes per partition: an address's offset inside its partition is the address modulo this */
  partitionSize: number;
  /**
   * The partitions. Several may share a start (the Timex EXROM answers in every chunk of its bank);
   * the first listed is the one an offset is named after.
   */
  regions: readonly ProfileRegion[];
  /**
   * The profile offset of a CPU address that names no partition, on a machine whose map is fixed
   * (the 48K, the ZX80/81); undefined when the address is not backed by memory
   */
  fixedAddress?(address: number): number | undefined;
  /** Whether an offset of a fixed-map machine is ROM */
  fixedRom?(offset: number): boolean;
};

/** Where a profile offset lives */
export type ProfileLocation = {
  /** The partition, or undefined on a fixed-map machine */
  partition?: number;
  /** The byte's offset inside its partition (on a fixed map: its CPU address) */
  address: number;
  rom: boolean;
};

/**
 * The profile offset of a byte: the partition it lives in (undefined on a fixed-map machine, or when
 * the source names none) and its CPU address
 * @returns undefined when neither the partition nor the fixed map knows the byte
 */
export function profileOffsetOf(layout: ProfileLayout, partition: number | undefined, address: number): number | undefined {
  if (partition === undefined) return layout.fixedAddress?.(address & 0xffff);
  const region = layout.regions.find((r) => r.partition === partition);
  if (!region) return undefined;
  return region.start + ((address & 0xffff) % (region.size ?? layout.partitionSize));
}

/** Names a profile offset (D11): its partition and the address it answers at */
export function profileLocationOf(layout: ProfileLayout, offset: number): ProfileLocation | undefined {
  if (offset < 0 || offset >= layout.flagBytes) return undefined;
  for (const region of layout.regions) {
    if (offset >= region.start && offset < region.start + (region.size ?? layout.partitionSize)) {
      return { partition: region.partition, address: offset - region.start, rom: !!region.rom };
    }
  }
  if (layout.fixedAddress) {
    return { address: offset, rom: layout.fixedRom?.(offset) ?? false };
  }
  return undefined;
}

/** Whether a profile offset is ROM */
export function isProfileRom(layout: ProfileLayout, offset: number): boolean {
  return profileLocationOf(layout, offset)?.rom ?? false;
}
