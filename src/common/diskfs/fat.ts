import {
  SECTOR_SIZE,
  MemoryBlockDevice,
  readPartitions,
  partitionDevice,
  readU16,
  readU32,
  writeU16,
  writeU32,
  FAT_PARTITION_TYPES,
  type BlockDevice,
  type DiskPartition
} from "./blockDevice";
import {
  DiskFsError,
  type DiskFileAttributes,
  type DiskFileEntry,
  type DiskFileSystem,
  type DiskFsInfo,
  type DiskSectorRole,
  type NewDiskFile
} from "./types";

/*
 * FAT16 and FAT32 (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C1): the file system of DivMMC SD
 * cards and of most hard-disk images, on a block device. Written from Microsoft's FAT specification
 * (D8), as a file system of the shared layer rather than as a change to the Next's `.cim` driver
 * (`src/main/fat32/`), which stays as `ncp` uses it:
 *
 * - The boot sector's BPB gives the layout: reserved sectors, the FATs, then (FAT16) the fixed root
 *   directory of `RootEntCnt` entries, then the data clusters from cluster 2. The FAT type follows
 *   from the cluster count: fewer than 4085 is FAT12 (not supported), fewer than 65525 FAT16.
 * - A FAT16 entry is 2 bytes, a FAT32 entry the low 28 bits of 4; every FAT copy is written. End of
 *   chain: $FFF8+ / $0FFFFFF8+. FAT32 keeps a free count in its FSInfo sector, updated here.
 * - A directory entry is 32 bytes (8.3 name, attributes, first cluster high and low, size); a long
 *   name is a run of entries with attribute $0F before it, 13 UCS-2 characters each, in reverse
 *   order, checksummed against the 8.3 name.
 *
 * Paths use `/`; names match without regard to case, as FAT does.
 */

export type FatType = 16 | 32;

const ATTR_READ_ONLY = 0x01;
const ATTR_HIDDEN = 0x02;
const ATTR_SYSTEM = 0x04;
const ATTR_VOLUME = 0x08;
const ATTR_DIRECTORY = 0x10;
const ATTR_ARCHIVE = 0x20;
const ATTR_LFN = 0x0f;
const ENTRY_SIZE = 32;
const DELETED = 0xe5;
const SHORT_NAME_CHARS = /^[A-Z0-9!#$%&'()\-@^_`{}~]+$/;

type EntryLocation = { lba: number; offset: number };

/** A directory entry as read, with where its slots are */
type DirEntry = {
  name: string;
  shortName: string;
  attr: number;
  cluster: number;
  size: number;
  slots: EntryLocation[];
  deleted: boolean;
};

type FatLayout = {
  type: FatType;
  sectorsPerCluster: number;
  reservedSectors: number;
  fatCount: number;
  fatSectors: number;
  rootEntries: number;
  rootSectors: number;
  totalSectors: number;
  fatStart: number;
  rootStart: number;
  dataStart: number;
  clusterCount: number;
  rootCluster: number;
  fsInfoSector: number;
  label: string;
};

export type FatRegions = {
  reserved: [number, number];
  fats: [number, number];
  root: [number, number];
  data: [number, number];
};

export class FatFileSystem implements DiskFileSystem {
  readonly system = "fat";
  readonly layoutInfo: FatLayout;
  private readonly fatCache = new Map<number, Uint8Array>();
  private freeClusters: number | undefined;
  private allocHint = 2;

  constructor (readonly volume: BlockDevice) {
    this.layoutInfo = readLayout(volume.readSector(0));
  }

  /** Opens the FAT file system of a disk: the partition asked for, or the first FAT one */
  static open (disk: BlockDevice, partitionIndex?: number): FatFileSystem {
    const partitions = readPartitions(disk);
    const partition =
      partitionIndex !== undefined
        ? partitions.find((p) => p.index === partitionIndex)
        : partitions.find((p) => p.whole || FAT_PARTITION_TYPES.has(p.type));
    if (!partition) throw new DiskFsError("unformatted", "The disk has no FAT partition.");
    return new FatFileSystem(partitionDevice(disk, partition));
  }

  info (): DiskFsInfo {
    const l = this.layoutInfo;
    const clusterBytes = l.sectorsPerCluster * SECTOR_SIZE;
    return {
      system: `FAT${l.type}`,
      format: `FAT${l.type}`,
      // --- "NO NAME" is the boot sector's word for no label
      label: l.label && l.label !== "NO NAME" ? l.label : undefined,
      totalBytes: l.clusterCount * clusterBytes,
      freeBytes: this.countFree() * clusterBytes,
      blockSize: clusterBytes,
      directoryEntries: l.type === 16 ? l.rootEntries : 0,
      usedEntries: this.readDir(this.rootRef()).filter((e) => !e.deleted).length
    };
  }

  list (options: { deleted?: boolean; dir?: string } = {}): DiskFileEntry[] {
    const { cluster: dir, path: prefix } = this.resolveDirPath(options.dir ?? "");
    return this.readDir(dir)
      .filter((e) => (options.deleted || !e.deleted) && e.name !== "." && e.name !== "..")
      .map((e) => this.entryOf(e, prefix));
  }

  read (path: string): Uint8Array {
    const entry = this.find(path);
    if (entry.attr & ATTR_DIRECTORY) throw new DiskFsError("notFound", `${path} is a folder.`, { name: path });
    const out = new Uint8Array(entry.size);
    let at = 0;
    for (const cluster of this.chain(entry.cluster)) {
      for (let s = 0; s < this.layoutInfo.sectorsPerCluster && at < entry.size; s++) {
        const sector = this.volume.readSector(this.clusterLba(cluster) + s);
        out.set(sector.subarray(0, Math.min(SECTOR_SIZE, entry.size - at)), at);
        at += SECTOR_SIZE;
      }
    }
    return out;
  }

  write (file: NewDiskFile): DiskFileEntry {
    const { parent, name } = splitPath(file.name);
    const dir = this.resolveDir(parent);
    if (this.findIn(dir, name)) throw new DiskFsError("exists", `A file named ${file.name} is already on the disk.`, { name: file.name });
    const clusters = this.allocate(Math.ceil(file.data.length / (this.layoutInfo.sectorsPerCluster * SECTOR_SIZE)), file.name);
    this.writeChainData(clusters, file.data);
    this.addEntry(dir, name, ATTR_ARCHIVE, clusters[0] ?? 0, file.data.length);
    return this.entryOf(this.findIn(dir, name)!, this.resolveDirPath(parent).path);
  }

  /** Makes a folder (and the folders above it when they are missing) */
  mkdir (path: string): void {
    const parts = normalizePath(path).split("/").filter(Boolean);
    let dir = this.rootRef();
    for (const part of parts) {
      const existing = this.findIn(dir, part);
      if (existing) {
        if (!(existing.attr & ATTR_DIRECTORY)) throw new DiskFsError("exists", `${part} is a file.`, { name: part });
        dir = existing.cluster;
        continue;
      }
      const [cluster] = this.allocate(1, path);
      this.zeroCluster(cluster);
      // --- "." and ".." (the root is cluster 0 in "..", whatever its real cluster)
      const first = new Uint8Array(SECTOR_SIZE);
      writeShortEntry(first, 0, ".          ", ATTR_DIRECTORY, cluster, 0);
      writeShortEntry(first, ENTRY_SIZE, "..         ", ATTR_DIRECTORY, dir === this.rootRef() ? 0 : dir, 0);
      this.volume.writeSector(this.clusterLba(cluster), first);
      this.addEntry(dir, part, ATTR_DIRECTORY, cluster, 0);
      dir = cluster;
    }
  }

  delete (path: string): void {
    const entry = this.find(path);
    if (entry.attr & ATTR_READ_ONLY) throw new DiskFsError("readOnly", `${path} is read-only.`, { name: path });
    if (entry.attr & ATTR_DIRECTORY) {
      const children = this.readDir(entry.cluster).filter((e) => !e.deleted && e.name !== "." && e.name !== "..");
      if (children.length > 0) throw new DiskFsError("unsupported", `${path} is not empty.`, { name: path });
    }
    this.freeChain(entry.cluster);
    for (const slot of entry.slots) this.patchEntry(slot, (e) => (e[0] = DELETED));
  }

  rename (path: string, newName: string): void {
    const entry = this.find(path);
    const { parent } = splitPath(path);
    const target = newName.includes("/") ? splitPath(newName).name : newName;
    const dir = this.resolveDir(parent);
    const clash = this.findIn(dir, target);
    if (clash && clash.slots[0].lba !== entry.slots[0].lba || (clash && clash.slots[0].offset !== entry.slots[0].offset)) {
      throw new DiskFsError("exists", `A file named ${target} is already on the disk.`, { name: target });
    }
    for (const slot of entry.slots) this.patchEntry(slot, (e) => (e[0] = DELETED));
    this.addEntry(dir, target, entry.attr, entry.cluster, entry.size);
  }

  setAttributes (path: string, attributes: Partial<DiskFileAttributes>): void {
    const entry = this.find(path);
    const sfn = entry.slots[entry.slots.length - 1];
    this.patchEntry(sfn, (e) => {
      let attr = e[11];
      const set = (flag: number, on: boolean | undefined) => {
        if (on === undefined) return;
        attr = on ? attr | flag : attr & ~flag;
      };
      set(ATTR_READ_ONLY, attributes.readOnly);
      set(ATTR_SYSTEM, attributes.system);
      set(ATTR_ARCHIVE, attributes.archive);
      e[11] = attr;
    });
  }

  /** The volume's areas, in sectors: [first, count] */
  regions (): FatRegions {
    const l = this.layoutInfo;
    return {
      reserved: [0, l.reservedSectors],
      fats: [l.fatStart, l.fatCount * l.fatSectors],
      root: [l.rootStart, l.rootSectors],
      data: [l.dataStart, l.clusterCount * l.sectorsPerCluster]
    };
  }

  /** Which clusters are in use, `buckets` at a time: each bucket's used fraction (0..1) */
  clusterUse (buckets: number): number[] {
    const count = this.layoutInfo.clusterCount;
    const per = Math.max(1, Math.ceil(count / buckets));
    const out: number[] = [];
    for (let b = 0; b * per < count; b++) {
      let used = 0;
      const end = Math.min(count, (b + 1) * per);
      for (let c = b * per; c < end; c++) if (this.getFat(c + 2) !== 0) used++;
      out.push(used / (end - b * per));
    }
    return out;
  }

  /** A file's clusters */
  fileClusters (path: string): number[] {
    return [...this.chain(this.find(path).cluster)];
  }

  layout (): Map<number, DiskSectorRole> {
    // --- A hard disk has too many sectors to map one by one: the explorer uses `regions` and
    // --- `clusterUse` instead
    return new Map();
  }

  image (): Uint8Array {
    if (this.volume instanceof MemoryBlockDevice) return this.volume.bytes;
    throw new DiskFsError("unsupported", "The volume is on a device, not in memory.");
  }

  // ---------------------------------------------------------------------------------------------
  // The FAT

  private getFat (cluster: number): number {
    const l = this.layoutInfo;
    const bytes = l.type === 16 ? 2 : 4;
    const at = cluster * bytes;
    const sector = this.fatSector(l.fatStart + Math.floor(at / SECTOR_SIZE));
    const offset = at % SECTOR_SIZE;
    return l.type === 16 ? readU16(sector, offset) : readU32(sector, offset) & 0x0fffffff;
  }

  private setFat (cluster: number, value: number): void {
    const l = this.layoutInfo;
    const bytes = l.type === 16 ? 2 : 4;
    const at = cluster * bytes;
    const relative = Math.floor(at / SECTOR_SIZE);
    const offset = at % SECTOR_SIZE;
    for (let copy = 0; copy < l.fatCount; copy++) {
      const lba = l.fatStart + copy * l.fatSectors + relative;
      const sector = this.fatSector(lba);
      if (l.type === 16) writeU16(sector, offset, value);
      else writeU32(sector, offset, (readU32(sector, offset) & 0xf0000000) | (value & 0x0fffffff));
      this.volume.writeSector(lba, sector);
    }
  }

  private fatSector (lba: number): Uint8Array {
    let sector = this.fatCache.get(lba);
    if (!sector) {
      sector = this.volume.readSector(lba);
      this.fatCache.set(lba, sector);
    }
    return sector;
  }

  private isEnd (value: number): boolean {
    return this.layoutInfo.type === 16 ? value >= 0xfff8 : value >= 0x0ffffff8;
  }

  private endMark (): number {
    return this.layoutInfo.type === 16 ? 0xffff : 0x0fffffff;
  }

  private *chain (first: number): Generator<number> {
    let cluster = first;
    let guard = 0;
    while (cluster >= 2 && cluster < this.layoutInfo.clusterCount + 2 && guard++ < this.layoutInfo.clusterCount) {
      yield cluster;
      const next = this.getFat(cluster);
      if (this.isEnd(next) || next < 2) return;
      cluster = next;
    }
  }

  private countFree (): number {
    if (this.freeClusters === undefined) {
      let free = 0;
      for (let c = 2; c < this.layoutInfo.clusterCount + 2; c++) if (this.getFat(c) === 0) free++;
      this.freeClusters = free;
    }
    return this.freeClusters;
  }

  /** `count` free clusters, chained */
  private allocate (count: number, forName: string): number[] {
    if (count === 0) return [];
    if (this.countFree() < count) throw new DiskFsError("diskFull", `The disk has no room for ${forName}.`, { name: forName });
    const total = this.layoutInfo.clusterCount + 2;
    const found: number[] = [];
    for (let i = 0, c = this.allocHint; i < total && found.length < count; i++, c = c + 1 >= total ? 2 : c + 1) {
      if (c >= 2 && this.getFat(c) === 0) found.push(c);
    }
    found.forEach((c, i) => this.setFat(c, i + 1 < found.length ? found[i + 1] : this.endMark()));
    this.allocHint = found[found.length - 1] + 1;
    this.adjustFree(-count);
    return found;
  }

  private freeChain (first: number): void {
    const clusters = [...this.chain(first)];
    clusters.forEach((c) => this.setFat(c, 0));
    if (clusters.length) this.adjustFree(clusters.length);
  }

  private adjustFree (delta: number): void {
    this.freeClusters = this.countFree() + delta;
    const l = this.layoutInfo;
    if (l.type === 32 && l.fsInfoSector > 0) {
      const info = this.volume.readSector(l.fsInfoSector);
      if (readU32(info, 0) === 0x41615252 && readU32(info, 484) === 0x61417272) {
        writeU32(info, 488, this.freeClusters);
        writeU32(info, 492, this.allocHint);
        this.volume.writeSector(l.fsInfoSector, info);
      }
    }
  }

  private clusterLba (cluster: number): number {
    return this.layoutInfo.dataStart + (cluster - 2) * this.layoutInfo.sectorsPerCluster;
  }

  private zeroCluster (cluster: number): void {
    const zero = new Uint8Array(SECTOR_SIZE);
    for (let s = 0; s < this.layoutInfo.sectorsPerCluster; s++) this.volume.writeSector(this.clusterLba(cluster) + s, zero);
  }

  private writeChainData (clusters: number[], data: Uint8Array): void {
    let at = 0;
    for (const cluster of clusters) {
      for (let s = 0; s < this.layoutInfo.sectorsPerCluster; s++) {
        const sector = new Uint8Array(SECTOR_SIZE);
        sector.set(data.subarray(at, at + SECTOR_SIZE));
        this.volume.writeSector(this.clusterLba(cluster) + s, sector);
        at += SECTOR_SIZE;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Directories (a directory is its first cluster; the FAT16 root is 0)

  private rootRef (): number {
    return this.layoutInfo.type === 16 ? 0 : this.layoutInfo.rootCluster;
  }

  /** The sectors of a directory, in order */
  private dirSectors (dir: number): number[] {
    const l = this.layoutInfo;
    if (dir === 0) return Array.from({ length: l.rootSectors }, (_, i) => l.rootStart + i);
    const out: number[] = [];
    for (const cluster of this.chain(dir)) {
      for (let s = 0; s < l.sectorsPerCluster; s++) out.push(this.clusterLba(cluster) + s);
    }
    return out;
  }

  private readDir (dir: number): DirEntry[] {
    const entries: DirEntry[] = [];
    let lfn: { parts: string[]; checksum: number; slots: EntryLocation[] } | undefined;
    for (const lba of this.dirSectors(dir)) {
      const sector = this.volume.readSector(lba);
      for (let offset = 0; offset < SECTOR_SIZE; offset += ENTRY_SIZE) {
        const first = sector[offset];
        if (first === 0x00) return entries;
        const attr = sector[offset + 11];
        const slot = { lba, offset };
        if (attr === ATTR_LFN) {
          if (first === DELETED) {
            lfn = undefined;
            continue;
          }
          const order = first & 0x3f;
          if (first & 0x40) lfn = { parts: [], checksum: sector[offset + 13], slots: [] };
          if (lfn) {
            lfn.parts[order - 1] = lfnChars(sector, offset);
            lfn.slots.push(slot);
          }
          continue;
        }
        if (attr & ATTR_VOLUME) {
          lfn = undefined;
          continue;
        }
        const raw = sector.subarray(offset, offset + 11);
        const shortName = displayShortName(raw, first === DELETED);
        const longName = lfn && lfn.checksum === shortChecksum(raw) && first !== DELETED ? lfn.parts.join("") : undefined;
        entries.push({
          name: longName ?? shortName,
          shortName,
          attr,
          cluster: readU16(sector, offset + 26) | (this.layoutInfo.type === 32 ? readU16(sector, offset + 20) << 16 : 0),
          size: readU32(sector, offset + 28),
          slots: [...(longName ? lfn!.slots : []), slot],
          deleted: first === DELETED
        });
        lfn = undefined;
      }
    }
    return entries;
  }

  private findIn (dir: number, name: string): DirEntry | undefined {
    const upper = name.toUpperCase();
    return this.readDir(dir).find((e) => !e.deleted && (e.name.toUpperCase() === upper || e.shortName.toUpperCase() === upper));
  }

  private resolveDir (path: string): number {
    return this.resolveDirPath(path).cluster;
  }

  /** A folder's first cluster, and its path with the names as the disk spells them */
  private resolveDirPath (path: string): { cluster: number; path: string } {
    let dir = this.rootRef();
    const names: string[] = [];
    for (const part of normalizePath(path).split("/").filter(Boolean)) {
      const entry = this.findIn(dir, part);
      if (!entry || !(entry.attr & ATTR_DIRECTORY)) throw new DiskFsError("notFound", `${path} is not on the disk.`, { name: path });
      dir = entry.cluster === 0 ? this.rootRef() : entry.cluster;
      names.push(entry.name);
    }
    return { cluster: dir, path: names.join("/") };
  }

  private find (path: string): DirEntry {
    const { parent, name } = splitPath(path);
    const entry = this.findIn(this.resolveDir(parent), name);
    if (!entry) throw new DiskFsError("notFound", `${path} is not on the disk.`, { name: path });
    return entry;
  }

  private patchEntry (slot: EntryLocation, change: (entry: Uint8Array) => void): void {
    const sector = this.volume.readSector(slot.lba);
    change(sector.subarray(slot.offset, slot.offset + ENTRY_SIZE));
    this.volume.writeSector(slot.lba, sector);
  }

  /** Writes a directory entry (with its long-name entries when the name needs them) */
  private addEntry (dir: number, name: string, attr: number, cluster: number, size: number): void {
    const existing = this.readDir(dir).map((e) => e.shortName.replace(".", "").padEnd(11).slice(0, 11));
    const short = shortNameFor(name, (candidate) => existing.some((e) => e === candidate));
    const needsLong = !isExactShortName(name);
    const longParts = needsLong ? Math.ceil(name.length / 13) : 0;
    const slots = this.freeSlots(dir, longParts + 1, name);
    const checksum = shortChecksum(Uint8Array.from(short, (c) => c.charCodeAt(0)));
    for (let i = 0; i < longParts; i++) {
      const order = longParts - i;
      this.patchEntry(slots[i], (e) => writeLfnEntry(e, name, order, order === longParts, checksum));
    }
    this.patchEntry(slots[longParts], (e) => writeShortEntry(e, 0, short, attr, cluster, size, this.layoutInfo.type));
  }

  /** `count` consecutive free slots in a directory, growing a cluster directory when needed */
  private freeSlots (dir: number, count: number, forName: string): EntryLocation[] {
    for (;;) {
      let run: EntryLocation[] = [];
      for (const lba of this.dirSectors(dir)) {
        const sector = this.volume.readSector(lba);
        for (let offset = 0; offset < SECTOR_SIZE; offset += ENTRY_SIZE) {
          const first = sector[offset];
          if (first === DELETED || first === 0x00) {
            run.push({ lba, offset });
            if (run.length === count) return run;
          } else {
            run = [];
          }
        }
      }
      if (dir === 0) throw new DiskFsError("directoryFull", `The root folder has no room for ${forName}.`, { name: forName });
      // --- Grow the directory by a cleared cluster
      const chain = [...this.chain(dir)];
      const [added] = this.allocate(1, forName);
      this.zeroCluster(added);
      this.setFat(chain[chain.length - 1], added);
    }
  }

  private entryOf (e: DirEntry, prefix: string): DiskFileEntry {
    const dot = e.name.lastIndexOf(".");
    const isDir = (e.attr & ATTR_DIRECTORY) !== 0;
    return {
      name: prefix ? `${prefix}/${e.name}` : e.name,
      baseName: isDir || dot <= 0 ? e.name : e.name.slice(0, dot),
      extension: isDir || dot <= 0 ? "" : e.name.slice(dot + 1),
      kind: "raw",
      size: isDir ? 0 : e.size,
      allocated: isDir ? 0 : Math.ceil(e.size / (this.layoutInfo.sectorsPerCluster * SECTOR_SIZE)) * this.layoutInfo.sectorsPerCluster * SECTOR_SIZE,
      attributes: {
        readOnly: (e.attr & ATTR_READ_ONLY) !== 0,
        system: (e.attr & ATTR_SYSTEM) !== 0,
        archive: (e.attr & ATTR_ARCHIVE) !== 0
      },
      deleted: e.deleted,
      sectors: [],
      isDirectory: isDir,
      hidden: (e.attr & ATTR_HIDDEN) !== 0
    };
  }
}

// -------------------------------------------------------------------------------------------------
// The layout

function readLayout (boot: Uint8Array): FatLayout {
  const bytesPerSector = readU16(boot, 11);
  if (bytesPerSector !== SECTOR_SIZE || (boot[510] !== 0x55 && boot[511] !== 0xaa)) {
    throw new DiskFsError("unformatted", "The volume has no FAT boot sector.");
  }
  const sectorsPerCluster = boot[13];
  const reservedSectors = readU16(boot, 14);
  const fatCount = boot[16];
  const rootEntries = readU16(boot, 17);
  const totalSectors = readU16(boot, 19) || readU32(boot, 32);
  const fatSectors = readU16(boot, 22) || readU32(boot, 36);
  const rootSectors = Math.ceil((rootEntries * ENTRY_SIZE) / SECTOR_SIZE);
  const fatStart = reservedSectors;
  const rootStart = fatStart + fatCount * fatSectors;
  const dataStart = rootStart + rootSectors;
  if (!sectorsPerCluster || !fatCount || !fatSectors || dataStart >= totalSectors) {
    throw new DiskFsError("unformatted", "The volume's boot sector does not describe a FAT file system.");
  }
  const clusterCount = Math.floor((totalSectors - dataStart) / sectorsPerCluster);
  if (clusterCount < 4085) throw new DiskFsError("unsupported", "FAT12 volumes are not supported.");
  const type: FatType = clusterCount < 65525 ? 16 : 32;
  const labelAt = type === 16 ? 43 : 71;
  return {
    type,
    sectorsPerCluster,
    reservedSectors,
    fatCount,
    fatSectors,
    rootEntries,
    rootSectors,
    totalSectors,
    fatStart,
    rootStart,
    dataStart,
    clusterCount,
    rootCluster: type === 32 ? readU32(boot, 44) : 0,
    fsInfoSector: type === 32 ? readU16(boot, 48) : 0,
    label: String.fromCharCode(...boot.subarray(labelAt, labelAt + 11)).trimEnd()
  };
}

export type FormatOptions = {
  type: FatType;
  label?: string;
  /** Write an MBR with one partition from LBA 2048 (default); otherwise the whole disk */
  partitioned?: boolean;
};

/**
 * Formats a disk: an MBR with one FAT partition (from LBA 2048, 1 MB aligned) or a whole-disk
 * volume, then the boot sector, the FATs, the root directory and - on FAT32 - the FSInfo sector
 * @returns The new file system
 */
export function formatFat (disk: BlockDevice, options: FormatOptions): FatFileSystem {
  const partitioned = options.partitioned ?? true;
  const first = partitioned ? 2048 : 0;
  const total = disk.sectorCount - first;
  const type = options.type;
  const reserved = type === 16 ? 4 : 32;
  const rootEntries = type === 16 ? 512 : 0;
  const rootSectors = (rootEntries * ENTRY_SIZE) / SECTOR_SIZE;

  // --- The smallest power-of-two cluster that keeps the count in the type's range
  let spc = 1;
  let fatSectors = 0;
  let clusters = 0;
  for (; spc <= 128; spc *= 2) {
    fatSectors = 1;
    for (let i = 0; i < 8; i++) {
      clusters = Math.floor((total - reserved - 2 * fatSectors - rootSectors) / spc);
      fatSectors = Math.ceil(((clusters + 2) * (type === 16 ? 2 : 4)) / SECTOR_SIZE);
    }
    if (type === 16 ? clusters < 65525 : clusters < 0x0ffffff5) break;
  }
  if (type === 16 && clusters < 4085) throw new DiskFsError("unsupported", "The disk is too small for FAT16.");
  if (type === 32 && clusters < 65525) throw new DiskFsError("unsupported", "The disk is too small for FAT32 (at least 33 MB).");

  const zero = new Uint8Array(SECTOR_SIZE);
  const volume = partitioned ? partitionDevice(disk, { index: 0, type: 0, firstLba: first, sectorCount: total, whole: false }) : disk;
  if (partitioned) {
    const mbr = new Uint8Array(SECTOR_SIZE);
    const at = 446;
    mbr[at + 4] = type === 16 ? 0x0e : 0x0c;
    mbr[at + 1] = 0xfe;
    mbr[at + 2] = 0xff;
    mbr[at + 3] = 0xff;
    mbr[at + 5] = 0xfe;
    mbr[at + 6] = 0xff;
    mbr[at + 7] = 0xff;
    writeU32(mbr, at + 8, first);
    writeU32(mbr, at + 12, total);
    mbr[510] = 0x55;
    mbr[511] = 0xaa;
    disk.writeSector(0, mbr);
  }

  const boot = new Uint8Array(SECTOR_SIZE);
  boot.set([0xeb, 0x58, 0x90], 0);
  boot.set(Array.from("KLIVEIDE", (c) => c.charCodeAt(0)), 3);
  writeU16(boot, 11, SECTOR_SIZE);
  boot[13] = spc;
  writeU16(boot, 14, reserved);
  boot[16] = 2;
  writeU16(boot, 17, rootEntries);
  if (type === 16 && total < 0x10000) writeU16(boot, 19, total);
  else writeU32(boot, 32, total);
  boot[21] = 0xf8;
  writeU16(boot, 24, 63);
  writeU16(boot, 26, 255);
  writeU32(boot, 28, first);
  const label = (options.label ?? "NO NAME").toUpperCase().padEnd(11).slice(0, 11);
  if (type === 16) {
    writeU16(boot, 22, fatSectors);
    boot[36] = 0x80;
    boot[38] = 0x29;
    writeU32(boot, 39, 0x4b4c5645);
    boot.set(Array.from(label, (c) => c.charCodeAt(0)), 43);
    boot.set(Array.from("FAT16   ", (c) => c.charCodeAt(0)), 54);
  } else {
    writeU32(boot, 36, fatSectors);
    writeU32(boot, 44, 2);
    writeU16(boot, 48, 1);
    writeU16(boot, 50, 6);
    boot[64] = 0x80;
    boot[66] = 0x29;
    writeU32(boot, 67, 0x4b4c5645);
    boot.set(Array.from(label, (c) => c.charCodeAt(0)), 71);
    boot.set(Array.from("FAT32   ", (c) => c.charCodeAt(0)), 82);
  }
  boot[510] = 0x55;
  boot[511] = 0xaa;
  for (let s = 0; s < reserved; s++) volume.writeSector(s, zero);
  volume.writeSector(0, boot);
  if (type === 32) {
    volume.writeSector(6, boot);
    const info = new Uint8Array(SECTOR_SIZE);
    writeU32(info, 0, 0x41615252);
    writeU32(info, 484, 0x61417272);
    writeU32(info, 488, clusters - 1);
    writeU32(info, 492, 3);
    writeU32(info, 508, 0xaa550000);
    volume.writeSector(1, info);
    volume.writeSector(7, info);
  }
  // --- The FATs: entries 0 and 1 reserved (media byte, end mark); FAT32's root at cluster 2
  for (let copy = 0; copy < 2; copy++) {
    const base = reserved + copy * fatSectors;
    for (let s = 0; s < fatSectors; s++) volume.writeSector(base + s, zero);
    const head = new Uint8Array(SECTOR_SIZE);
    if (type === 16) {
      writeU16(head, 0, 0xfff8);
      writeU16(head, 2, 0xffff);
    } else {
      writeU32(head, 0, 0x0ffffff8);
      writeU32(head, 4, 0x0fffffff);
      writeU32(head, 8, 0x0fffffff);
    }
    volume.writeSector(base, head);
  }
  // --- The root directory, with the volume label as its first entry (none for an unnamed volume:
  // --- "NO NAME" lives only in the boot sector, as other systems format it)
  const dataStart = reserved + 2 * fatSectors + rootSectors;
  const rootFirst = type === 16 ? reserved + 2 * fatSectors : dataStart;
  const rootCount = type === 16 ? rootSectors : spc;
  for (let s = 0; s < rootCount; s++) volume.writeSector(rootFirst + s, zero);
  if (options.label) {
    const labelSector = new Uint8Array(SECTOR_SIZE);
    writeShortEntry(labelSector, 0, label, ATTR_VOLUME, 0, 0, type);
    volume.writeSector(rootFirst, labelSector);
  }
  return new FatFileSystem(volume);
}

/** A disk image in memory, formatted */
export function createFatImage (sizeBytes: number, options: FormatOptions): Uint8Array {
  const bytes = new Uint8Array(sizeBytes);
  formatFat(new MemoryBlockDevice(bytes), options);
  return bytes;
}

export { readPartitions };
export type { DiskPartition };

// -------------------------------------------------------------------------------------------------
// Names and entries

function normalizePath (path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function splitPath (path: string): { parent: string; name: string } {
  const normal = normalizePath(path);
  const at = normal.lastIndexOf("/");
  const name = at >= 0 ? normal.slice(at + 1) : normal;
  if (!name || name === "." || name === ".." || /[\\/:*?"<>|\x00-\x1f]/.test(name)) {
    throw new DiskFsError("badName", `"${path}" is not a valid file name.`, { name: path });
  }
  return { parent: at >= 0 ? normal.slice(0, at) : "", name };
}

function isExactShortName (name: string): boolean {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  return base.length >= 1 && base.length <= 8 && ext.length <= 3 && SHORT_NAME_CHARS.test(base) && (!ext || SHORT_NAME_CHARS.test(ext)) && name === name.toUpperCase();
}

/** The 11-byte 8.3 name for a long name: `BASE~N.EXT` when it is not one already */
function shortNameFor (name: string, taken: (candidate: string) => boolean): string {
  const dot = name.lastIndexOf(".");
  const clean = (text: string) => text.toUpperCase().replace(/[^A-Z0-9!#$%&'()\-@^_`{}~]/g, "");
  const base = clean(dot > 0 ? name.slice(0, dot) : name) || "FILE";
  const ext = clean(dot > 0 ? name.slice(dot + 1) : "").slice(0, 3);
  if (isExactShortName(name)) return base.padEnd(8) + ext.padEnd(3);
  for (let n = 1; n < 1000000; n++) {
    const tail = `~${n}`;
    const candidate = base.slice(0, 8 - tail.length) + tail;
    const full = candidate.padEnd(8) + ext.padEnd(3);
    if (!taken(full)) return full;
  }
  throw new DiskFsError("directoryFull", `No short name is left for ${name}.`, { name });
}

function shortChecksum (name: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum = (((sum & 1) << 7) + (sum >> 1) + name[i]) & 0xff;
  return sum;
}

function displayShortName (raw: Uint8Array, deleted: boolean): string {
  const chars = Array.from(raw, (c, i) => (i === 0 && deleted ? "?" : String.fromCharCode(c)));
  const base = chars.slice(0, 8).join("").trimEnd();
  const ext = chars.slice(8).join("").trimEnd();
  return ext ? `${base}.${ext}` : base;
}

function lfnChars (sector: Uint8Array, offset: number): string {
  let out = "";
  for (const [start, count] of [[1, 5], [14, 6], [28, 2]]) {
    for (let i = 0; i < count; i++) {
      const code = readU16(sector, offset + start + i * 2);
      if (code === 0x0000 || code === 0xffff) return out;
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function writeLfnEntry (entry: Uint8Array, name: string, order: number, last: boolean, checksum: number): void {
  entry.fill(0);
  entry[0] = order | (last ? 0x40 : 0);
  entry[11] = ATTR_LFN;
  entry[13] = checksum;
  const part = name.slice((order - 1) * 13, order * 13);
  let i = 0;
  for (const [start, count] of [[1, 5], [14, 6], [28, 2]]) {
    for (let k = 0; k < count; k++, i++) {
      const code = i < part.length ? part.charCodeAt(i) : i === part.length ? 0x0000 : 0xffff;
      writeU16(entry, start + k * 2, code);
    }
  }
}

function writeShortEntry (
  target: Uint8Array,
  offset: number,
  name11: string,
  attr: number,
  cluster: number,
  size: number,
  type: FatType = 32
): void {
  const entry = target.subarray(offset, offset + ENTRY_SIZE);
  entry.fill(0);
  for (let i = 0; i < 11; i++) entry[i] = name11.charCodeAt(i) & 0xff;
  entry[11] = attr;
  // --- 2026-01-01 00:00: a fixed date, so the same files make the same image
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  writeU16(entry, 16, date);
  writeU16(entry, 18, date);
  writeU16(entry, 24, date);
  if (type === 32) writeU16(entry, 20, cluster >>> 16);
  writeU16(entry, 26, cluster & 0xffff);
  writeU32(entry, 28, size);
}
