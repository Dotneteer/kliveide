import { epCanonicalToDisk, epDiskGeometryOf, epDiskToCanonical, type EpDiskGeometry } from "./EpDiskImage";

/*
 * The EXDOS card's two drives, between the media store and the core (`ep-exdos.c`), as the TVC's
 * `TvcHbfDisks` are for its HBF card. A disk arrives as its file's bytes (`MEDIA_DISK_A/B`); the
 * guest's writes go back as the whole new image, which the main process writes beside the file and
 * renames over it (`DSK_WHOLE_IMAGE_KEY`), so a failed write leaves the old disk intact.
 */

/** What the core exports for the drives */
export type EpExdosDiskExports = {
  memory: WebAssembly.Memory;
  epExdosDiskDataPtr: (drive: number) => number;
  epExdosDiskGetCapacity: () => number;
  epExdosDiskInsert: (drive: number, cylinders: number, sides: number, writeProtected: number) => void;
  epExdosDiskEject: (drive: number) => void;
  epExdosDiskSetWriteProtected: (drive: number, value: number) => void;
  epExdosGetDirtyRevision: () => number;
  epExdosGetSectorCount: () => number;
  epExdosGetSectorDirty: (drive: number, index: number) => number;
  epExdosClearDirty: (drive: number) => void;
};

export class EpExdosDisks {
  private readonly geometry: (EpDiskGeometry | undefined)[] = [undefined, undefined];
  /** The file bytes each drive was last given (the machine re-sends them on every start) */
  private readonly contents: (Uint8Array | undefined)[] = [undefined, undefined];
  private revision = 0;

  constructor(private readonly core: EpExdosDiskExports) {}

  private buffer(drive: number): Uint8Array {
    return new Uint8Array(this.core.memory.buffer, this.core.epExdosDiskDataPtr(drive), this.core.epExdosDiskGetCapacity());
  }

  /**
   * Inserts the file's bytes into a drive, or ejects it when there are none
   * @returns why the image cannot go in, or undefined
   */
  insert(drive: number, contents: unknown, writeProtected: boolean): string | undefined {
    if (!(contents instanceof Uint8Array) || contents.length === 0) {
      this.core.epExdosDiskEject(drive);
      this.geometry[drive] = undefined;
      this.contents[drive] = undefined;
      return undefined;
    }
    // --- The same file again: the disk in the core, with the guest's writes, stays
    if (contents === this.contents[drive] && this.geometry[drive]) {
      this.setWriteProtected(drive, writeProtected);
      return undefined;
    }
    const geometry = epDiskGeometryOf(contents);
    if ("error" in geometry) {
      this.core.epExdosDiskEject(drive);
      this.geometry[drive] = undefined;
      this.contents[drive] = undefined;
      return geometry.error;
    }
    this.contents[drive] = contents;
    this.buffer(drive).set(epDiskToCanonical(contents, geometry, this.core.epExdosDiskGetCapacity()));
    this.core.epExdosDiskInsert(drive, geometry.cylinders, geometry.sides, writeProtected ? 1 : 0);
    this.geometry[drive] = geometry;
    this.revision = this.core.epExdosGetDirtyRevision();
    return undefined;
  }

  setWriteProtected(drive: number, value: boolean): void {
    this.core.epExdosDiskSetWriteProtected(drive, value ? 1 : 0);
  }

  /** The disk in a drive as a raw image (the guest's writes included), or undefined */
  image(drive: number): Uint8Array | undefined {
    const geometry = this.geometry[drive];
    return geometry ? epCanonicalToDisk(this.buffer(drive), geometry) : undefined;
  }

  /** The drives the guest wrote since the last publish, each with its whole new image */
  publish(): (Uint8Array | undefined)[] | undefined {
    const revision = this.core.epExdosGetDirtyRevision();
    if (revision === this.revision) return undefined;
    this.revision = revision;
    const count = this.core.epExdosGetSectorCount();
    return [0, 1].map((drive) => {
      if (!this.geometry[drive]) return undefined;
      let dirty = false;
      for (let i = 0; i < count && !dirty; i++) dirty = this.core.epExdosGetSectorDirty(drive, i) !== 0;
      if (!dirty) return undefined;
      this.core.epExdosClearDirty(drive);
      return this.image(drive);
    });
  }
}
