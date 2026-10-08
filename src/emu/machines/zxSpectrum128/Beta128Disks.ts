import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import {
  canonicalSectorToTrdSector,
  canonicalToTrd,
  trdosImageToCanonical,
  TRD_SECTOR_SIZE,
  TRD_TRACK_SIZE,
  type TrdGeometry
} from "../disk/trd/trdImage";

/*
 * The Beta 128's two drives, between the media store and the `sp128` core
 * (`.plans/BETA128_TRDOS_PLAN.md` B3, B4, Q4).
 *
 * A disk arrives as the bytes of its file (the `MEDIA_DISK_A/B` machine properties, as on the +3),
 * a `.trd` or an `.scl` told apart by content. It is converted to the core's canonical layout and
 * written into the core's drive buffer. Sectors the guest writes come back as `SectorChanges`
 * keyed by the `.trd` file's sector number, which the main process writes at `key * 256`. An `.scl`
 * is never written back: its drive is reported unsaved instead.
 */

/** What the core exports for the drives */
export type Beta128DiskExports = {
  memory: WebAssembly.Memory;
  sp128BetaDiskDataPtr: (drive: number) => number;
  sp128BetaDiskGetCapacity: () => number;
  sp128BetaDiskInsert: (drive: number, cylinders: number, sides: number, writeProtected: number) => number;
  sp128BetaDiskEject: (drive: number) => number;
  sp128BetaDiskSetWriteProtected: (drive: number, value: number) => number;
  sp128BetaDiskGetCylinders: (drive: number) => number;
  sp128BetaDiskGetSides: (drive: number) => number;
  sp128BetaDiskGetPresent: (drive: number) => number;
  sp128BetaGetDirtyRevision: () => number;
  sp128BetaGetSectorCount: () => number;
  sp128BetaGetSectorDirty: (drive: number, index: number) => number;
  sp128BetaClearDirty: (drive: number) => number;
};

/** What a drive holds, as the host knows it */
type DriveState = {
  /** The file's geometry: where its sectors are */
  geometry: TrdGeometry;
  /** The disk came from an `.scl`: never written back */
  scl: boolean;
  /**
   * The disk came back with a Klive state: its file is detached, so the guest's writes are not
   * written back until a disk is inserted again (state-files plan D11)
   */
  detached?: boolean;
  warnings: string[];
};

/** The changes of one publish */
export type Beta128DiskPublish = {
  changes: (SectorChanges | undefined)[];
  /** Drives whose guest writes cannot go back to their file */
  unsaved: boolean[];
};

export class Beta128Disks {
  private readonly drives: (DriveState | undefined)[] = [undefined, undefined];
  /** The file bytes each drive was last given (the controller re-sends them on every start) */
  private readonly contents: (Uint8Array | undefined)[] = [undefined, undefined];
  private revision = 0;

  constructor(private readonly core: Beta128DiskExports) {}

  /** The core's buffer of a drive */
  private buffer(drive: number): Uint8Array {
    return new Uint8Array(
      this.core.memory.buffer,
      this.core.sp128BetaDiskDataPtr(drive),
      this.core.sp128BetaDiskGetCapacity()
    );
  }

  /**
   * Inserts the file's bytes into a drive, or ejects it when there are none
   * @returns The conversion's warnings (an `.scl` checksum, for example)
   */
  insert(drive: number, contents: unknown, writeProtected: boolean): string[] {
    if (!(contents instanceof Uint8Array) || contents.length === 0) {
      this.core.sp128BetaDiskEject(drive);
      this.drives[drive] = undefined;
      this.contents[drive] = undefined;
      return [];
    }
    // --- The same file again (`attachStoredMedia` on every start): the disk in the core, with the
    // --- guest's writes, stays; only a newly read file replaces it
    if (contents === this.contents[drive] && this.drives[drive]) {
      this.setWriteProtected(drive, writeProtected);
      return this.drives[drive]!.warnings;
    }
    this.contents[drive] = contents;
    const disk = trdosImageToCanonical(contents);
    const buffer = this.buffer(drive);
    buffer.fill(0);
    buffer.set(disk.data.subarray(0, buffer.length));
    this.core.sp128BetaDiskInsert(drive, disk.cylinders, disk.sides, writeProtected ? 1 : 0);
    this.drives[drive] = { geometry: { cylinders: disk.cylinders, sides: disk.sides }, scl: disk.scl, warnings: disk.warnings };
    this.revision = this.core.sp128BetaGetDirtyRevision();
    return disk.warnings;
  }

  setWriteProtected(drive: number, value: boolean): void {
    this.core.sp128BetaDiskSetWriteProtected(drive, value ? 1 : 0);
  }

  /** Is the disk in the drive an `.scl` (never written back)? */
  isScl(drive: number): boolean {
    return !!this.drives[drive]?.scl;
  }

  /** The guest's writes since the last publish, per drive */
  publish(): Beta128DiskPublish | undefined {
    const revision = this.core.sp128BetaGetDirtyRevision();
    if (revision === this.revision) return undefined;
    this.revision = revision;
    const result: Beta128DiskPublish = { changes: [undefined, undefined], unsaved: [false, false] };
    const count = this.core.sp128BetaGetSectorCount();
    for (let drive = 0; drive < 2; drive++) {
      const state = this.drives[drive];
      if (!state) continue;
      const buffer = this.buffer(drive);
      const changes: SectorChanges = new Map();
      for (let index = 0; index < count; index++) {
        if (!this.core.sp128BetaGetSectorDirty(drive, index)) continue;
        if (state.scl || state.detached) {
          result.unsaved[drive] = true;
          continue;
        }
        // --- A track the guest formatted beyond the file's geometry (side 1 of a single-sided
        // --- file) has no place in the file
        const fileSector = canonicalSectorToTrdSector(index, state.geometry);
        if (fileSector === undefined) {
          result.unsaved[drive] = true;
          continue;
        }
        changes.set(fileSector, new Uint8Array(buffer.subarray(index * TRD_SECTOR_SIZE, (index + 1) * TRD_SECTOR_SIZE)));
      }
      this.core.sp128BetaClearDirty(drive);
      if (changes.size) result.changes[drive] = changes;
    }
    return result;
  }

  /**
   * Every sector of every written-back disk, as a publish (REVERSE_DEBUGGING_PLAN D13): after a fork
   * the in-core disks are the restored past's, and the files must follow them. `.scl` and detached
   * disks are never written back, so they are left out.
   */
  republishAll(): Beta128DiskPublish | undefined {
    const result: Beta128DiskPublish = { changes: [undefined, undefined], unsaved: [false, false] };
    const count = this.core.sp128BetaGetSectorCount();
    let any = false;
    for (let drive = 0; drive < 2; drive++) {
      const state = this.drives[drive];
      if (!state || state.scl || state.detached) continue;
      const buffer = this.buffer(drive);
      const changes: SectorChanges = new Map();
      // --- The file's own sectors: the core's buffer has room for more cylinders than the file
      const fileSectors = (state.geometry.cylinders * state.geometry.sides * TRD_TRACK_SIZE) / TRD_SECTOR_SIZE;
      for (let index = 0; index < count; index++) {
        const fileSector = canonicalSectorToTrdSector(index, state.geometry);
        if (fileSector === undefined || fileSector >= fileSectors) continue;
        changes.set(fileSector, new Uint8Array(buffer.subarray(index * TRD_SECTOR_SIZE, (index + 1) * TRD_SECTOR_SIZE)));
      }
      if (changes.size) {
        result.changes[drive] = changes;
        any = true;
      }
    }
    return any ? result : undefined;
  }

  /**
   * A Klive state replaced the core's memory, disks included: the host follows the restored drives,
   * and their files are detached (D11); the restored writes are not published as new ones
   */
  afterStateLoad(): void {
    for (let drive = 0; drive < 2; drive++) {
      if (!this.core.sp128BetaDiskGetPresent(drive)) {
        this.drives[drive] = undefined;
        continue;
      }
      const geometry = { cylinders: this.core.sp128BetaDiskGetCylinders(drive), sides: this.core.sp128BetaDiskGetSides(drive) };
      this.drives[drive] = { geometry, scl: false, detached: true, warnings: [] };
    }
    this.revision = this.core.sp128BetaGetDirtyRevision();
  }

  /** The disk in a drive as a `.trd` file of the core's current geometry (to save an `.scl` disk) */
  exportTrd(drive: number): Uint8Array | undefined {
    if (!this.drives[drive]) return undefined;
    const cylinders = this.core.sp128BetaDiskGetCylinders(drive);
    const sides = this.core.sp128BetaDiskGetSides(drive);
    const data = this.buffer(drive).subarray(0, cylinders * 2 * 16 * TRD_SECTOR_SIZE);
    return canonicalToTrd({ cylinders, sides, data });
  }
}
