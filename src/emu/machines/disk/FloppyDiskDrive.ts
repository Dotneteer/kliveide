import { FloppyDisk } from "./FloppyDisk";

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive {
  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected = false;

  // --- The contents of the loaded floppy disk
  disk: FloppyDisk | undefined;

  // --- Read/write to data byte 0x00nn or 0xffnn
  data = 0;

  // --- Current head index
  headIndex = 0;

  // --- Has two heads?
  twoHeads = true;

  // --- Is at the index hole?
  atIndexWhole = false;

  // --- Track 0 mark
  tr00 = false;

  // --- Does this drive weak read?
  doReadWeak = false;

  // --- Indicates that the drive is ready
  get ready(): boolean {
    return !!this.disk
  }

  // --- Ejects floppy disk
  ejectDisk (): void {
    this.disk = null;
  }

  // --- Writes the data to the disk
  writeData(): void {
    // TODO: Implement this method
  }

  // --- Reads the data from the disk
  readData(): void {
    // TODO: Implement this method
  }

  // --- Step one cylinder into the specified direction
  step(out: boolean): void {
    // TODO: Implement this method
  }

  loadHead(headNo: number): void {
    // TODO: Implement this method void fdd_head_load( fdd_t *d, int load )
  }
}
