import { FloppyControllerDevice } from "./FloppyControllerDevice";
import { FloppyDisk } from "./FloppyDisk";

const FDD_LOAD_FACT = 0x02;
const FDD_HEAD_FACT = 0x10;
const FDD_STEP_FACT = 0x22;

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive {
  constructor (private readonly controller: FloppyControllerDevice) {}

  // --- Indicates if this drive is enabled
  enabled = false;

  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected = false;

  // --- The contents of the loaded floppy disk
  disk: FloppyDisk | undefined;

  // --- Indicates if this drive is selected
  selected = false;

  // --- Read/write to data byte 0x00nn or 0xffnn
  data = 0;

  // --- Indicates the disk is unreadable
  unreadable = false;

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

  // --- Current cylinder
  c_cylinder = 0;

  // --- Maximum number of cylinders managed by the drive
  fdd_cylinders = 0;

  // --- Is the head loaded?
  loadhead = false;

  // --- Marks
  marks: number;

  // --- Indicates that the drive is ready
  get ready (): boolean {
    return this.controller.getMotorSpeed() === 100 && !!this.disk;
  }

  reset (reinit: boolean): void {
    const loaded = !!this.disk;
    const selected = this.selected;
    const doReadWeak = this.doReadWeak;
    const currentDisk = this.disk;

    this.twoHeads = false;
    this.fdd_cylinders = 0;
    this.c_cylinder = 0;
    this.headIndex = 0;
    this.unreadable = false;
    this.doReadWeak = false;
    if (this.enabled) {
      this.twoHeads = true;
      this.fdd_cylinders = 42;
      this.atIndexWhole = true;
      this.tr00 = true;
      this.isWriteProtected = true;
    } else {
      this.atIndexWhole = false;
      this.tr00 = false;
      this.isWriteProtected = false;
    }

    if (reinit) {
      this.selected = selected;
      this.doReadWeak = doReadWeak;
    } else {
      this.ejectDisk();
    }
    if (reinit && loaded) {
      this.ejectDisk();
      this.insertDisk(currentDisk);
    } else {
      this.disk = null;
    }
  }

  insertDisk (disk: FloppyDisk): void {
    // TODO: Other task to manage an inserted disk
    this.disk = disk;
    if (!this.enabled) {
      return;
    }

    this.isWriteProtected = this.disk.isWriteProtected;
    if (this.selected) {
      this.loadHead(true);
    }

    this.doReadWeak = this.disk.hasWeakSectors;
    this.setData(FDD_LOAD_FACT);
  }

  // --- Ejects floppy disk
  ejectDisk (): void {
    this.disk = null;
    this.atIndexWhole = true;
    this.isWriteProtected = true;
    if (this.enabled && this.selected) {
      this.loadHead(false);
    }
  }

  // --- Writes the data to the disk
  writeData (): void {
    this.readOrWriteData(true);
  }

  // --- Reads the data from the disk
  readData (): void {
    this.readOrWriteData(false);
  }

  // --- Step one cylinder into the specified direction
  step (out: boolean): void {
    if (out) {
      // --- Direction out
      if (this.c_cylinder > 0) {
        this.c_cylinder--;
      }
    } else {
      // --- Direction in
      if (this.c_cylinder < this.fdd_cylinders - 1) {
        this.c_cylinder++;
      }
    }
    this.tr00 = this.c_cylinder === 0;
    this.setData(FDD_STEP_FACT);
  }

  // --- Loads or unloads the drive's head
  loadHead (load: boolean): void {
    if (!this.disk) {
      return;
    }
    if (this.loadhead == load) {
      return;
    }
    this.loadhead = load;
    this.setData(FDD_HEAD_FACT);
  }

  private setData (fact: number): void {
    if (!this.disk) return;

    const head = this.headIndex;
    if (
      this.unreadable ||
      (this.disk.sides === 1 && head === 1) ||
      this.c_cylinder >= this.disk.tracksPerSide
    ) {
      // --- No data available for the disk
      this.disk.trackData = null;
      this.disk.clockData = null;
      this.disk.fmData = null;
      this.disk.weakData = null;
      return;
    }

    // --- Set the index to the specified track
    this.disk.setTrackIndex(this.disk.sides * this.c_cylinder + head);
    if (fact > 0) {
      /* this generate a bpt/fact +-10% triangular distribution skip in bytes 
         i know, we should use the higher bits of rand(), but we not
         keen on _real_ (pseudo)random numbers... ;)
      */
      const tlen = this.disk.trackLength;

      // --- Random number between -9 and 9
      const rand =
        (Math.floor(Math.random() * 10) % 10) +
        (Math.floor(Math.random() * 10) % 10) -
        9;
      this.disk.indexPos +=
        Math.floor(tlen / fact) + tlen * Math.floor(rand / fact / 100);
      while (this.disk.indexPos >= tlen) this.disk.indexPos -= tlen;
    }
    this.atIndexWhole = !this.disk.indexPos;
  }

  private readOrWriteData (write: boolean): void {
    // --- Is there anything to read or write?
    if (!this.selected || !this.ready || !this.loadhead || !this.disk) {
      // --- Nothing to read or write
      if (this.disk && this.controller.getMotorSpeed() > 0) {
        // --- Spin the disk
        if (this.disk.indexPos >= this.disk.trackLength) {
          // --- Next data byte
          this.disk.indexPos = 0;
        }
        if (!write) {
          // --- No data
          this.data = 0x100;
        }
        this.disk.indexPos++;
        this.atIndexWhole = this.disk.indexPos >= this.disk.trackLength;
      }
      return;
    }

    // --- There is data that can be read
    if (this.disk.indexPos >= this.disk.trackLength) {
      // --- Next data byte
      this.disk.indexPos = 0;
    }
    if (write) {
      // --- This is a write operation
      if (this.disk.isWriteProtected) {
        this.disk.indexPos++;
        this.atIndexWhole = this.disk.indexPos >= this.disk.trackLength;
        return;
      }
      this.disk.trackData.set(this.disk.indexPos, this.data & 0x00ff);
      if (this.data & 0xff00) {
        this.disk.bitmapSet(this.disk.clockData, this.disk.indexPos);
      } else {
        this.disk.bitmapReset(this.disk.clockData, this.disk.indexPos);
      }
      if (this.marks & 0x01) {
        this.disk.bitmapSet(this.disk.fmData, this.disk.indexPos);
      } else {
        this.disk.bitmapReset(this.disk.fmData, this.disk.indexPos);
      }
      this.disk.bitmapReset(this.disk.weakData, this.disk.indexPos);
      this.disk.dirty = true;
    } else {
      // --- This is a read operation
      this.data = this.disk.trackData.get(this.disk.indexPos);
      if (this.disk.bitmapTest(this.disk.clockData, this.disk.indexPos)) {
        this.data |= 0xff00;
      }
      this.marks = 0;
      if (this.disk.bitmapTest(this.disk.fmData, this.disk.indexPos)) {
        this.marks |= 0x01;
      }
      if (this.disk.bitmapTest(this.disk.weakData, this.disk.indexPos)) {
        this.marks |= 0x02;
        // --- mess up data byte
        this.data &= Math.floor(Math.random() * 256) % 0xff;
        this.data |= Math.floor(Math.random() * 256) % 0xff;
      }
    }
    this.disk.indexPos++;
    this.atIndexWhole = this.disk.indexPos >= this.disk.trackLength;
  }
}
