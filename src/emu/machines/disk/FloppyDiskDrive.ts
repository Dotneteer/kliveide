import { FloppyDisk } from "./FloppyDisk";

const FDD_LOAD_FACT = 0x02;
const FDD_HEAD_FACT = 0x10;
const FDD_STEP_FACT = 0x22;

/**
 * This class represents a single floppy disk device
 */
export class FloppyDiskDrive {
  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected = false;

  // --- The contents of the loaded floppy disk
  disk: FloppyDisk | undefined;

  // --- Indicates if this drive is selected
  selected: boolean;

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
  c_cylinder: number;

  // --- Maximum number of cylinders managed by the drive
  fdd_cylinders: number;

  // --- Indicates that the drive is ready
  get ready(): boolean {
    return !!this.disk
  }

  insertDisk (disk: FloppyDisk): void {
    // TODO: Other task to manage an inserted disk
    this.disk = disk;
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
    console.log("readData called");
    // TODO: Implement this method
  }

  // --- Step one cylinder into the specified direction
  step(out: boolean): void {
    console.log("step called");
    if(out) {
      // --- Direction out
      if(this.c_cylinder > 0 ) {
        this.c_cylinder--;
      }
    } else {
      // --- Direction in
      if(this.c_cylinder < this.fdd_cylinders - 1 )
        this.c_cylinder++;
    }
    this.tr00 = this.c_cylinder === 0;
    this.setData(FDD_STEP_FACT);
  }

  loadHead(headNo: number): void {
    console.log("loadeHead called");
    // TODO: Implement this method void fdd_head_load( fdd_t *d, int load )
  }

  private setData(fact: number): void {
    if(!this.disk) return;

    const head = this.headIndex;
    if(this.unreadable || ( this.disk.sides === 1 && head === 1 ) ||
        this.c_cylinder >= this.disk.tracksPerSide) {
      // --- No data available for the disk    
      this.disk.trackData = null;
      this.disk.clockData = null;
      this.disk.fmData = null;
      this.disk.weakData = null;
      return;
    }

    // --- Set the index to the specified track
    this.disk.setTrackIndex(this.disk.sides * this.c_cylinder + head )
    if( fact > 0 ) {
      /* this generate a bpt/fact +-10% triangular distribution skip in bytes 
         i know, we should use the higher bits of rand(), but we not
         keen on _real_ (pseudo)random numbers... ;)
      */
      const tlen = this.disk.trackLength;

      // --- Random number between -9 and 9
      const rand = (Math.floor(Math.random() * 10) % 10 + Math.floor(Math.random() * 10) % 10 - 9 )
      this.disk.indexPos += Math.floor(tlen / fact) + tlen * Math.floor(rand/fact/100);
      while(this.disk.indexPos >= tlen)
        this.disk.indexPos -= tlen;
    }
    this.atIndexWhole = !this.disk.indexPos;
  }
}
