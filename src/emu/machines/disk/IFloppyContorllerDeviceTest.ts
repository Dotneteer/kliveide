import type { FloppyLogEntry } from "../../../emu/abstractions/FloppyLogEntry";
import type { IFloppyDiskDrive } from "../../../emu/abstractions/IFloppyDiskDrive";
import type {
  CommandDescriptor,
  IntRequest,
  OperationPhase,
  ScanType,
  SeekStatus
} from "./FloppyControllerDevice";

export interface IFloppyControllerDeviceTest {
  // --- Disables randomization when seeking for a track or a sector
  disableRandomSeek: boolean;

  // --- Number of frame completions
  frames: number;

  // --- Drive A
  driveA?: IFloppyDiskDrive;

  // --- Drive B
  driveB?: IFloppyDiskDrive;

  // --- The drive currently selected
  currentDrive?: IFloppyDiskDrive;

  // --- Floppy operation log
  opLog: FloppyLogEntry[];

  // --- Main status register
  msr: number;

  // --- Status register 0
  sr0: number;

  // --- Status register 1
  sr1: number;

  // --- Status register 2
  sr2: number;

  // --- Status register 3
  sr3: number;

  // --- The current operation phase
  operationPhase: OperationPhase;

  // --- Current command
  command: CommandDescriptor;

  // --- #of command bytes received
  commandBytesReceived: number;

  // --- The current command register value
  commandRegister: number;

  // --- Selected unit (0-3)
  us: number;

  // --- Head address (0-1)
  hd: number;

  // --- Read/wrire deleted data
  deletedData: boolean;

  // --- Multitrack operations
  mt: boolean;

  // --- MFM mode
  mf: boolean;

  // --- Skip deleted/not deleted data
  sk: boolean;

  // --- Last INTRQ status
  intReq: IntRequest;

  // --- Is the controller in non-DMA mode?
  nonDmaMode: boolean;

  // --- Stepping rate in milliseconds
  stepRate: number;

  // --- Head unload time in milliseconds
  headUnloadTime: number;

  // --- Head load time in milliseconds
  headLoadTime: number;

  // --- The mumber of bytes to send back
  resultBytesLeft: number;

  // --- The index of the result byte to send back
  resultIndex: number;

  // --- Indicates if the head is loaded
  headLoaded: boolean;

  // --- Result bytes for SENSE INTERRUPT
  senseIntRes: number[];

  // --- Present cylinder values
  presentCylinderNumbers: number[];

  // --- New cylinder values
  newCylinderNumbers: number[];

  // --- Saved cylinder values
  savedCylinderNumbers: number[];

  // --- FDC data registers
  dataRegister: number[];

  // --- Seek status for drives
  seekStatus: SeekStatus[];

  // --- Order of overlapped seeks for 4 drive
  seekAge: number[];

  // --- Indicates that a Read ID operation is in progress
  readIdInProgress: boolean;

  // --- Count of revolutions
  revCounter: number;

  // --- AM ID mark found
  idMarkFound: boolean;

  // --- Current track of read/write operation
  idTrack: number;

  // --- Current head of read/write operation
  idHead: number;

  // --- Current sector of read/write operation
  idSector: number;

  // --- Sector length code 0, 1, 2, 3 (128 << length code)
  idLength: number;

  // --- The actual sector length
  sectorLength: number;

  // --- Expected record length
  expRecordLength: number;

  // --- First sector always read/write even when EOT < R
  firstRw: boolean;

  // --- Read a deleted data mark
  ddam: boolean;

  // --- Offset of data byte during read and write operations
  dataOffset: number;

  // --- Type of scan to use
  scan: ScanType;
}
