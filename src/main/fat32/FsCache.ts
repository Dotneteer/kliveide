import { BYTES_PER_SECTOR } from "@abstractions/Fat32Types";
import { CimFile } from "./CimFileManager";

// --- Cached sector is dirty
export const CACHE_STATUS_DIRTY = 1;

// -- Cashed sector is FAT entry and must be mirrored in second FAT
export const CACHE_STATUS_MIRROR_FAT = 2;

// --- Cache sector status bits
export const CACHE_STATUS_MASK = CACHE_STATUS_DIRTY | CACHE_STATUS_MIRROR_FAT;

// --- Sync existing sector but do not read new sector
export const CACHE_OPTION_NO_READ = 4;

// --- Cache sector for read
export const CACHE_FOR_READ = 0;

// --- Cache sector for write
export const CACHE_FOR_WRITE = CACHE_STATUS_DIRTY;

// --- Reserve cache sector for write - do not read from sector device
export const CACHE_RESERVE_FOR_WRITE = CACHE_STATUS_DIRTY | CACHE_OPTION_NO_READ;

export class FsCache {
  private _status: number;
  private _sector: number;
  private _mirrorOffset: number;
  private _buffer = new Uint8Array(BYTES_PER_SECTOR);

  constructor(public readonly file: CimFile) {}

  /**
   * @return Cache buffer content
   */
  get cacheBuffer() {
    return this._buffer;
  }

  /**
   * @return Logical sector number for cached sector.
   */
  get sector() {
    return this._sector;
  }

  /**
   * Cache safe read of a sector.
   * @param sector Logical sector to be read.
   * @return Data read if operation is successful else null.
   */
  cacheSafeRead(sector: number, count?: number): Uint8Array | null {
    if (count === undefined) {
      if (this.isCached(sector)) {
        return new Uint8Array(this._buffer);
      }
      return this.file.readSector(sector);
    } else {
      if (this.isCached(sector, count) && !this.sync()) {
        return null;
      }
      const result = new Uint8Array(count * BYTES_PER_SECTOR);
      for (let i = 0; i < count; i++) {
        const data = this.file.readSector(sector + i);
        if (!data) {
          return null;
        }
        result.set(data, i * BYTES_PER_SECTOR);
      }
      return result;
    }
  }

  /**
   * Cache safe write of a sectors.
   * @param sector Logical sector to be written.
   * @param src Data to be written.
   * @param count Number of sectors to be written.
   * \return true for success or false for failure.
   */
  cacheSafeWrite(sector: number, src: Uint8Array, count?: number) {
    if (count === undefined) {
      if (this.isCached(sector)) {
        this.invalidate();
      }
      this.file.writeSector(sector, src);
    } else {
      if (this.isCached(sector, count)) {
        this.invalidate();
      }
      for (let i = 0; i < count; i++) {
        this.file.writeSector(
          sector + i,
          src.slice(i * BYTES_PER_SECTOR, (i + 1) * BYTES_PER_SECTOR)
        );
      }
    }
  }

  /**
   * @return Clear the cache and returns a pointer to the cache
   */
  clear(): Uint8Array {
    if (this.isDirty() && !this.sync()) {
      return null;
    }
    this.invalidate();
    return this._buffer;
  }

  /**
   * Set current sector dirty.
   */
  dirty() {
    this._status |= CACHE_STATUS_DIRTY;
  }

  /**
   * Initialize the cache.
   * @param[in] blockDev Block device for this cache.
   */
  init() {
    this.invalidate();
  }
  /**
   * Invalidate current cache sector.
   */
  invalidate() {
    this._status = 0;
    this._sector = 0xffffffff;
  }

  /**
   * Check if a sector is in the cache or the cache contains a sector from a range.
   * @param sector Sector to checked.
   * @param count Number of sectors in the range.
   * @return true if the sector range is cached.
   */
  isCached(sector: number, count?: number): boolean {
    if (count === undefined) {
      return sector <= this._sector && this._sector < sector + count;
    } else {
      return sector === this._sector;
    }
  }

  /**
   * @return dirty status
   */
  isDirty() {
    return this._status & CACHE_STATUS_DIRTY;
  }

  /**
   * Prepare cache to access sector.
   * @param sector Sector to read.
   * @param option mode for cached sector.
   * @return Cached sector
   */
  prepare(sector: number, option: number): Uint8Array | null {
    if (this._sector !== sector) {
      if (!this.sync()) {
        return null;
      }
      if (!(option & CACHE_OPTION_NO_READ)) {
        if ((this._buffer = this.file.readSector(sector)) === null) {
          return null;
        }
      }
      this._status = 0;
      this._sector = sector;
    }
    this._status |= option & CACHE_STATUS_MASK;
    return this._buffer;
  }

  /**
   * Set the offset to the second FAT for mirroring.
   * @param offset Sector offset to second FAT.
   */
  setMirrorOffset(offset: number) {
    this._mirrorOffset = offset;
  }

  /**
   * Write current sector if dirty.
   * @return true for success or false for failure.
   */
  sync(): boolean {
    if (this.isDirty()) {
      this.file.writeSector(this._sector, this._buffer);
      // -- Mirror second FAT
      if (this._status & CACHE_STATUS_MIRROR_FAT) {
        this.file.writeSector(this._sector + this._mirrorOffset, this._buffer);
      }
      this._status &= ~CACHE_STATUS_DIRTY;
    }
    return true;
  }
}
