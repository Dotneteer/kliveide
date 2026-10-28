import { tvcCanonicalToDisk, tvcDiskGeometryOf, tvcDiskToCanonical, type TvcDiskGeometry } from "./TvcDiskImage";

/*
 * The HBF card's two drives, between the media store and the core (`tvc-hbf.c`), as the Pentagon's
 * `Beta128Disks` are for its Beta 128. A disk arrives as its file's bytes (`MEDIA_DISK_A/B`); the
 * guest's writes go back as the whole new image, which the main process writes beside the file and
 * renames over it (`DSK_WHOLE_IMAGE_KEY`), so a failed write leaves the old disk intact.
 */

/** What the core exports for the drives */
export type TvcHbfDiskExports = {
  memory: WebAssembly.Memory;
  tvcHbfDiskDataPtr: (drive: number) => number;
  tvcHbfDiskGetCapacity: () => number;
  tvcHbfDiskInsert: (drive: number, cylinders: number, sides: number, writeProtected: number) => void;
  tvcHbfDiskEject: (drive: number) => void;
  tvcHbfDiskSetWriteProtected: (drive: number, value: number) => void;
  tvcHbfGetDirtyRevision: () => number;
  tvcHbfGetSectorCount: () => number;
  tvcHbfGetSectorDirty: (drive: number, index: number) => number;
  tvcHbfClearDirty: (drive: number) => void;
};

export class TvcHbfDisks {
  private readonly geometry: (TvcDiskGeometry | undefined)[] = [undefined, undefined];
  /** The file bytes each drive was last given (the controller re-sends them on every start) */
  private readonly contents: (Uint8Array | undefined)[] = [undefined, undefined];
  private revision = 0;

  constructor(private readonly core: TvcHbfDiskExports) {}

  private buffer(drive: number): Uint8Array {
    return new Uint8Array(this.core.memory.buffer, this.core.tvcHbfDiskDataPtr(drive), this.core.tvcHbfDiskGetCapacity());
  }

  /**
   * Inserts the file's bytes into a drive, or ejects it when there are none
   * @returns why the image cannot go in, or undefined
   */
  insert(drive: number, contents: unknown, writeProtected: boolean): string | undefined {
    if (!(contents instanceof Uint8Array) || contents.length === 0) {
      this.core.tvcHbfDiskEject(drive);
      this.geometry[drive] = undefined;
      this.contents[drive] = undefined;
      return undefined;
    }
    // --- The same file again: the disk in the core, with the guest's writes, stays
    if (contents === this.contents[drive] && this.geometry[drive]) {
      this.setWriteProtected(drive, writeProtected);
      return undefined;
    }
    const geometry = tvcDiskGeometryOf(contents);
    if ("error" in geometry) {
      this.core.tvcHbfDiskEject(drive);
      this.geometry[drive] = undefined;
      this.contents[drive] = undefined;
      return geometry.error;
    }
    this.contents[drive] = contents;
    this.buffer(drive).set(tvcDiskToCanonical(contents, geometry, this.core.tvcHbfDiskGetCapacity()));
    this.core.tvcHbfDiskInsert(drive, geometry.cylinders, geometry.sides, writeProtected ? 1 : 0);
    this.geometry[drive] = geometry;
    this.revision = this.core.tvcHbfGetDirtyRevision();
    return undefined;
  }

  setWriteProtected(drive: number, value: boolean): void {
    this.core.tvcHbfDiskSetWriteProtected(drive, value ? 1 : 0);
  }

  /** The disk in a drive as a raw image (the guest's writes included), or undefined */
  image(drive: number): Uint8Array | undefined {
    const geometry = this.geometry[drive];
    return geometry ? tvcCanonicalToDisk(this.buffer(drive), geometry) : undefined;
  }

  /** The drives the guest wrote since the last publish, each with its whole new image */
  publish(): (Uint8Array | undefined)[] | undefined {
    const revision = this.core.tvcHbfGetDirtyRevision();
    if (revision === this.revision) return undefined;
    this.revision = revision;
    const count = this.core.tvcHbfGetSectorCount();
    return [0, 1].map((drive) => {
      if (!this.geometry[drive]) return undefined;
      let dirty = false;
      for (let i = 0; i < count && !dirty; i++) dirty = this.core.tvcHbfGetSectorDirty(drive, i) !== 0;
      if (!dirty) return undefined;
      this.core.tvcHbfClearDirty(drive);
      return this.image(drive);
    });
  }
}
