import {
  MdrImageError,
  eraseMdrFile,
  mdrShape,
  readMdrCatalog,
  readMdrFile,
  readMdrSector,
  renameMdrFile,
  setMdrLabel,
  writeMdrFile,
  MDR_DATA_SIZE,
  MDR_FILE_HEADER_SIZE,
  type MdrFile,
  type MdrFileHeader
} from "@emu/machines/microdrive/mdrImage";
import {
  DiskFsError,
  type DiskFileAttributes,
  type DiskFileEntry,
  type DiskFileKind,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRole,
  type NewDiskFile
} from "./types";

/*
 * A Microdrive cartridge (`.plans/MICRODRIVE_PLAN.md` Phase 3.2), over `mdrImage.ts`.
 *
 * - There is no directory: a file is the records that share a name. Names are 1-10 characters,
 *   kept as typed (the ROM compares them exactly).
 * - A BASIC, array or CODE file is written as SAVE * writes it: the 9-byte header (HD_00..HD_11)
 *   in its first record. A `raw` file is written as a PRINT # stream, with no header.
 * - Deleting frees the sectors, as ERASE does; there is nothing to compact.
 * - The layout is one "track": the slots in tape order.
 */

const NO_ATTRIBUTES: DiskFileAttributes = { readOnly: false, system: false, archive: false };

/** Where a program says it was saved: PROG with the Interface 1's system variables (plan §9) */
const IF1_PROG = 23813;
const KIND_BY_TYPE: DiskFileKind[] = ["basic", "numberArray", "charArray", "code"];

export class MicrodriveFileSystem implements DiskFileSystem {
  readonly system = "microdrive";
  private readonly bytes: Uint8Array;

  constructor (image: Uint8Array) {
    try {
      mdrShape(image);
    } catch (err) {
      if (err instanceof MdrImageError) throw new DiskFsError("unsupported", err.message, err.args);
      throw err;
    }
    this.bytes = new Uint8Array(image);
    if (readMdrCatalog(this.bytes).formatted === 0) {
      throw new DiskFsError("unformatted", "The cartridge is not formatted.");
    }
  }

  info (): DiskFsInfo {
    const catalog = readMdrCatalog(this.bytes);
    return {
      system: "Microdrive",
      format: `${catalog.slots} sectors`,
      label: catalog.label,
      totalBytes: (catalog.formatted - catalog.bad) * MDR_DATA_SIZE,
      freeBytes: catalog.free * MDR_DATA_SIZE,
      blockSize: MDR_DATA_SIZE,
      directoryEntries: catalog.formatted - catalog.bad,
      usedEntries: catalog.files.length
    };
  }

  list (): DiskFileEntry[] {
    return readMdrCatalog(this.bytes).files.map((f) => this.entryOf(f));
  }

  read (name: string): Uint8Array {
    return readMdrFile(this.bytes, this.find(name));
  }

  write (file: NewDiskFile): DiskFileEntry {
    checkName(file.name);
    if (readMdrCatalog(this.bytes).files.some((f) => f.name === file.name)) {
      throw new DiskFsError("exists", `A file named ${file.name} is already on the cartridge.`, { name: file.name });
    }
    const header = headerOf(file);
    try {
      writeMdrFile(this.bytes, { name: file.name, data: file.data, header });
    } catch (err) {
      if (err instanceof MdrImageError) throw new DiskFsError("diskFull", `The cartridge has no room for ${file.name}.`, { name: file.name });
      throw err;
    }
    return this.list().find((f) => f.name === file.name)!;
  }

  delete (name: string): void {
    eraseMdrFile(this.bytes, this.find(name));
  }

  rename (name: string, newName: string): void {
    const file = this.find(name);
    checkName(newName);
    if (newName !== name && readMdrCatalog(this.bytes).files.some((f) => f.name === newName)) {
      throw new DiskFsError("exists", `A file named ${newName} is already on the cartridge.`, { name: newName });
    }
    renameMdrFile(this.bytes, file, newName);
  }

  setAttributes (_name: string, _attributes: Partial<DiskFileAttributes>): void {
    throw new DiskFsError("unsupported", "Microdrive files have no attributes.");
  }

  /** Renames the cartridge (up to 10 characters) */
  setLabel (label: string): void {
    setMdrLabel(this.bytes, label.slice(0, 10));
  }

  layout (): Map<number, DiskSectorRole> {
    const roles = new Map<number, DiskSectorRole>();
    const { slots } = mdrShape(this.bytes);
    for (let slot = 0; slot < slots; slot++) {
      const sector = readMdrSector(this.bytes, slot);
      let role: DiskSectorRole;
      if (sector.state === "free") role = { role: "free" };
      else if (sector.state === "used") {
        // --- A name starting with CHR$ 0 is hidden from CAT: a system record
        role = sector.record!.name.charCodeAt(0) === 0 ? { role: "system" } : { role: "file", file: sector.record!.name };
      } else role = { role: "unused" };
      roles.set(slot, role);
    }
    return roles;
  }

  image (): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  private find (name: string): MdrFile {
    const file = readMdrCatalog(this.bytes).files.find((f) => f.name === name);
    if (!file) throw new DiskFsError("notFound", `${name} is not on the cartridge.`, { name });
    return file;
  }

  private entryOf (f: MdrFile): DiskFileEntry {
    const kind: DiskFileKind = f.header ? KIND_BY_TYPE[f.header.type] ?? "code" : "raw";
    const entry: DiskFileEntry = {
      name: f.name,
      baseName: f.name,
      extension: "",
      kind,
      size: f.size,
      allocated: f.slots.length * MDR_DATA_SIZE,
      attributes: NO_ATTRIBUTES,
      deleted: false,
      sectors: f.slots.map((slot) => ({ trackIndex: 0, sectorIndex: slot }))
    };
    if (f.header) {
      if (kind === "basic") {
        entry.variablesOffset = f.header.programLength;
        if (f.header.autorun < 0x8000) entry.start = f.header.autorun;
      } else if (kind === "code") {
        entry.start = f.header.start;
      } else {
        entry.variableName = String.fromCharCode(0x60 + (f.header.programLength & 0x1f));
      }
    }
    return entry;
  }
}

/** The 9-byte header SAVE * would write for the file (none for a `raw` stream) */
function headerOf (file: NewDiskFile): Omit<MdrFileHeader, "length"> | undefined {
  switch (file.kind) {
    case "basic":
      return { type: 0, start: IF1_PROG, programLength: file.variablesOffset ?? file.data.length, autorun: file.start ?? 0xffff };
    case "code":
      return { type: 3, start: file.start ?? 32768, programLength: 0xffff, autorun: 0xffff };
    case "numberArray":
    case "charArray": {
      // --- The array's name byte, as in VARS: $80 + letter (number), $C0 + letter (character)
      const letter = (file.variableName ?? "a").toLowerCase().charCodeAt(0) & 0x1f;
      const nameByte = (file.kind === "numberArray" ? 0x80 : 0xc0) | letter;
      return { type: file.kind === "numberArray" ? 1 : 2, start: 0, programLength: 0xff00 | nameByte, autorun: 0xffff };
    }
    default:
      return undefined;
  }
}

function checkName (name: string): void {
  // eslint-disable-next-line no-control-regex
  if (!name || name.length > 10 || /[^\x20-\xff]/.test(name) || name.charCodeAt(0) === 0x20) {
    throw new DiskFsError("badName", `"${name}" is not a Microdrive file name (1-10 characters).`, { name });
  }
}

/** The 9 header bytes the first record of a SAVEd file starts with */
export const MICRODRIVE_FILE_HEADER_SIZE = MDR_FILE_HEADER_SIZE;
