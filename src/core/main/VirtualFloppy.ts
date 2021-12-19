/**
 * Virtual floppy file header
 */
const HEADER = new Uint8Array([
  "V".charCodeAt(0),
  "F".charCodeAt(0),
  "D".charCodeAt(0),
]);

/**
 * Floppy size constants
 */
const SECTOR_SIZE = 512;
const HEADER_SIZE = 8;

/**
 * This class implements a virtual floppy file
 */
export class VirtualFloppy {
  readonly filename: string;
  readonly diskFormat: number;
  readonly isWriteProtected: boolean;
  readonly isDoubleSided: boolean;
  readonly tracks: number;
  readonly sectorsPerTrack: number;
  readonly firstSectorIndex: number;
  readonly formatSpec: Uint8Array;

  /**
   * Creates a new floppy file
   * @param filename Name of the file to create
   * @param isWriteProtected Is the file write protected?
   * @param formatSpec File format specifier
   * @param firstSectorIndex The first sector index
   */
  constructor(
    filename: string,
    isWriteProtected: boolean,
    formatSpec: Uint8Array,
    firstSectorIndex: number
  ) {
    this.filename = filename;
    this.diskFormat = formatSpec[0];
    this.formatSpec = formatSpec;
    this.isWriteProtected = isWriteProtected;
    this.isDoubleSided = formatSpec[1] !== 0;
    this.tracks = formatSpec[2];
    this.sectorsPerTrack = formatSpec[3];
    this.firstSectorIndex = firstSectorIndex;
  }

  /**
   * Writes out the file to the disk
   */
  writeOutFile(): void {
    throw new Error("Not implemented");
  }
}

/**
 * Creates a new ZX Spectrum floppy file
 * @param filename Floppy file name
 * @param diskFormat Disk format to use
 */
export function createSpectrumFloppyFile(
  filename: string,
  diskFormat: number
): VirtualFloppy {
  throw new Error("Not implemented");
}

/**
 * Opens the specified ZX Spectrum floppy file
 * @param filename Floppy file name
 */
export function openSpectrumFloppyFile(filename: string): VirtualFloppy {
  throw new Error("Not implemented");
}

/**
 * Sets up the write protection on the specified ZX Spectrum floppy file
 * @param filename Floppy file name
 * @param isWriteProtected Write protection flag
 */
export function setSpectrumFloppyWriteProtection(
  filename: string,
  isWriteProtected: boolean
): void {
  throw new Error("Not implemented");
}

/**
 * Tests the write protection flag on the specified ZX Spectrum floppy file
 * @param filename Floppy file name
 */
export function checkSpectrumFloppyWriteProtection(filename: string): boolean {
  throw new Error("Not implemented");
}
