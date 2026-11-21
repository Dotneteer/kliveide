import { samDiskFromImage, samDiskToImage, type SamDisk } from "./SamDiskImage";

/*
 * The SAM's two drives, between the media store and the core (`sam-fdc.c`), as the Enterprise's
 * `EpExdosDisks`. A disk arrives as its file's bytes (`MEDIA_DISK_A/B`); the guest's writes go back as the
 * whole new image (`DSK_WHOLE_IMAGE_KEY`), which the main process writes beside the file and renames over
 * it. An `.sbt` disk is read-only. SAD and EDSK images come back in the MGT layout.
 */

export type SamDiskExports = {
  memory: WebAssembly.Memory;
  samDiskDataPtr: (drive: number) => number;
  samDiskGetCapacity: () => number;
  samDiskInsert: (drive: number, cylinders: number, sides: number, writeProtected: number) => void;
  samDiskEject: (drive: number) => void;
  samDiskSetWriteProtected: (drive: number, value: number) => void;
  samDiskGetDirtyRevision: (drive: number) => number;
  samDiskGetSectorCount: () => number;
  samDiskGetSectorDirty: (drive: number, index: number) => number;
  samDiskClearDirty: (drive: number) => void;
};

export class SamDisks {
  private readonly disks: (SamDisk | undefined)[] = [undefined, undefined];
  private readonly contents: (Uint8Array | undefined)[] = [undefined, undefined];
  private readonly revisions = [0, 0];

  constructor(private readonly core: SamDiskExports) {}

  private buffer(drive: number): Uint8Array {
    return new Uint8Array(this.core.memory.buffer, this.core.samDiskDataPtr(drive), this.core.samDiskGetCapacity());
  }

  /**
   * Inserts the file's bytes into a drive, or ejects it when there are none
   * @returns why the image cannot go in, or undefined
   */
  insert(drive: number, contents: unknown, writeProtected: boolean): string | undefined {
    if (!(contents instanceof Uint8Array) || contents.length === 0) {
      this.core.samDiskEject(drive);
      this.disks[drive] = undefined;
      this.contents[drive] = undefined;
      return undefined;
    }
    if (contents === this.contents[drive] && this.disks[drive]) {
      this.setWriteProtected(drive, writeProtected);
      return undefined;
    }
    const disk = samDiskFromImage(contents);
    if (typeof disk === "string") {
      this.core.samDiskEject(drive);
      this.disks[drive] = undefined;
      this.contents[drive] = undefined;
      return disk;
    }
    this.contents[drive] = contents;
    const buffer = this.buffer(drive);
    buffer.fill(0);
    buffer.set(disk.canonical.subarray(0, buffer.length));
    this.core.samDiskInsert(drive, disk.cylinders, 2, writeProtected || disk.readOnly ? 1 : 0);
    this.disks[drive] = disk;
    this.revisions[drive] = this.core.samDiskGetDirtyRevision(drive);
    return undefined;
  }

  setWriteProtected(drive: number, value: boolean): void {
    this.core.samDiskSetWriteProtected(drive, value || this.disks[drive]?.readOnly ? 1 : 0);
  }

  /** The disk in a drive as an MGT image (the guest's writes included), or undefined */
  image(drive: number): Uint8Array | undefined {
    const disk = this.disks[drive];
    return disk ? samDiskToImage(this.buffer(drive), disk.cylinders) : undefined;
  }

  /** The drives the guest wrote since the last publish, each with its whole new image */
  publish(): (Uint8Array | undefined)[] | undefined {
    let any = false;
    const result = [0, 1].map((drive) => {
      const revision = this.core.samDiskGetDirtyRevision(drive);
      if (revision === this.revisions[drive]) return undefined;
      this.revisions[drive] = revision;
      const disk = this.disks[drive];
      if (!disk || disk.readOnly) return undefined;
      this.core.samDiskClearDirty(drive);
      any = true;
      return this.image(drive);
    });
    return any ? result : undefined;
  }
}
