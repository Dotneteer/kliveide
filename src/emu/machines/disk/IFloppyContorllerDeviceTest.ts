import { FloppyLogEntry } from "@abstractions/FloppyLogEntry";
import { IFloppyDiskDrive } from "@emu/abstractions/IFloppyDiskDrive";
import {
  CommandDescriptor,
  IntRequest,
  OperationPhase,
  SeekStatus
} from "./FloppyControllerDeviceNew";

export interface IFloppyControllerDeviceTest {
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

  // --- Command parameter received
  commandParameters: number[];

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

  // --- The result to send back
  resultData: number[];

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
}
