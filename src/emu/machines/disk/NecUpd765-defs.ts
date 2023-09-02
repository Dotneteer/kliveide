// --- Available command codes
export enum CommandCode {
  Invalid = 0x00,
  // TODO: Remane to ReadTrack
  ReadDiagnostic = 0x02,

  Specify = 0x03,
  SenseDriveStatus = 0x04,
  WriteData = 0x05,
  ReadData = 0x06,
  Recalibrate = 0x07,
  SenseInterruptStatus = 0x08,
  WriteDeletedData = 0x09,
  ReadId = 0x0a,
  ReadDeletedData = 0x0c,

  // TODO: Rename to FormatTrack
  WriteId = 0x0d,
  Seek = 0x0f,

  // ???
  Version = 0x10,
  ScanEqual = 0x11,
  ScanLowOrEqual = 0x19,
  ScanHighOrEqual = 0x1d
}

// --- Represents the execution phases of the controller
export enum ControllerCommandPhase {
  // --- FDC is in an idle state, awaiting the next initial command byte.
  Idle,
  // --- The FDC receives all information required to perform a particular operation from the processor.
  Command,
  // --- The FDC performs the operation it was instructed to do.
  Execution,
  // --- After completion of the operation, status and other housekeeping information are made
  // --- available to the processor.
  Result
}

// --- Command direction
export enum CommandFlow {
  // -- Data flows from UPD765A to the bus
  Out,
  // --- Data flows from the bus to UPD765A
  In
}

// --- Operation type
export enum CommandOperation {
  // --- Read data
  Read,
  // --- Write data
  Write
}

// --- Command parameters
export enum CommandParameter {
  HEAD = 0,
  // --- Track
  C = 1,
  // --- Side
  H = 2,
  // --- Sector ID
  R = 3,
  // --- Sector size
  N = 4,
  // --- End of track
  EOT = 5,
  // --- Gap length
  GPL = 6,
  // --- Data length
  DTL = 7,
  // --- Step
  STP = 7
}

// --- Command result parameters
export enum CommandResultParameter {
  // --- Status register 0
  ST0 = 0,
  // --- Status register 1
  ST1 = 1,
  // --- Status register 2
  ST2 = 2,
  // --- Track
  C = 3,
  // --- Side
  H = 4,
  // --- Sector ID
  R = 5,
  // --- Sector size
  N = 6
}

// --- Main status registers (accessed via reads to port 0x2ffd)
export enum MainStatusRegister {
  // --- Default
  None = 0x00,

  // --- FDD0 Busy
  // --- FDD number 0 is in the seek mode. II any of the DnB bits IS set FDC will not accept read or write command.
  D0B = 0x01,

  // --- FDD1 Busy
  // --- FDD number 1 is in the seek mode. II any of the DnB bits IS set FDC will not accept read or write command.
  D1B = 0x02,

  // --- FDD2 Busy
  // --- FDD number 2 is in the seek mode. II any of the DnB bits IS set FDC will not accept read or write command.
  D2B = 0x04,

  // --- FDD3 Busy
  // --- FDD number 3 is in the seek mode. II any of the DnB bits IS set FDC will not accept read or write command.
  D3B = 0x08,

  // --- FDC Busy
  // --- A Read or Write command is in process. FDC will not accept any other command.
  CB = 0x10,

  // --- Execution Mode
  // --- This bit is set only during execution phase in non-DMA mode When DB5 goes low, execution phase has ended and result
  // --- phase has started. It operates only during non-DMA mode of operation
  EXM = 0x20,

  // --- Data Input/Output
  // --- Indicates direction of data transfer between FDC and data register If DIO = 1, then transfer is from data register to
  // --- the processor. If DIO = 0, then transfer is from the processor to data register
  DIO = 0x40,

  // --- Request For Master
  // --- Indicates data register IS ready to send or receive data to or from the processor.
  // --- Both bits DIO and RQM should be used to perform the hand-shaking functions of "ready" and "directron" to the processor
  RQM = 0x01 << 7
}

// --- Status Register 0
export enum StatusRegister0 {
  // --- Default
  None = 0x00,

  // --- Unit Select 0
  // --- This flag is used to Indicate a drive unit number at interrupt
  US0 = 0x01,

  // --- Unit Select 1
  // --- This flag is used to Indicate a drive unit number at interrupt
  US1 = 0x02,

  // --- Head Address
  // --- This flag is used to indicate the state of the head at interrupt.
  HD = 0x04,

  // --- Not Ready
  // --- When the FDD IS in the not-ready state and a Read or Write command IS Issued, this flag is set If a Read or Write
  // --- command is issued to side 1 of a single-sided drive, then this flag is set.
  NR = 0x08,

  // --- Equipment Check
  // --- If a fault srgnal IS received from the FDD, or if the track 0 signal fails to occur after 77 step pulses (Recalibrate Command)
  // --- then this flag is set.
  EC = 0x10,

  // --- Seek End
  // --- When the FDC completes the Seek command, this flag IS set lo 1 (high).
  SE = 0x20,

  // --- Interrupt Code (D6)
  // --- D7=0 and D6=0 => Normal termination of command, (NT) Command was completed and properly executed.
  // --- D7=0 and D6=1 => Abnormal termination of command, (AT) Execution of command was started but was not successfully completed.
  // --- D7=1 and D6=0 => Invalid command issue, (IC) Command which was issued was never started.
  // --- D7=1 and D6=1 => Abnormal termination because during command execution the ready srgnal from FDD changed state.
  IC_D6 = 0x40,

  // --- Interrupt Code (D7)
  // --- D7=0 and D6=0 => Normal termination of command, (NT) Command was completed and properly executed.
  // --- D7=0 and D6=1 => Abnormal termination of command, (AT) Execution of command was started but was not successfully completed.
  // --- D7=1 and D6=0 => Invalid command issue, (IC) Command which was issued was never started.
  // --- D7=1 and D6=1 => Abnormal termination because during command execution the ready srgnal from FDD changed state.
  IC_D7 = 0x01 << 7
}

// --- Status Register 1
export enum StatusRegister1 {
  // --- Default
  None = 0x00,

  // --- Missing Address Mark
  // --- This bit is set if the FDC does not detect the IDAM before 2 index pulses It is also set if
  // --- the FDC cannot find the DAM or DDAM after the IDAM is found. MD bit of ST2 is also ser at this time.
  MA = 0x01,

  // --- Not Writeable
  // --- During execution of Write Data, Write Deleted Data or Write ID command. if the FDC.
  // ---  detect: a write protect srgnal from the FDD. then this flag is Set.
  NW = 0x02,

  // --- No Data
  // --- During execution of Read Data. Read Deleted Data Write Data. Write Deleted Data or Scan command,
  // --- if the FDC cannot find the sector specified in the IDR(2) Register, this flag is set.
  ND = 0x04,

  // --- Over Run
  // --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
  OR = 0x10,

  // --- Data Error
  // --- If the FDC i s not serviced by the host system during data transfers within a certain time interval. this flaa i s set.
  DE = 0x20,

  // --- End of Track
  // --- When the FDC tries to access a sector beyond the final sector of a cylinder, this flag is set.
  EN = 0x80
}

// --- Status Register 2
export enum StatusRegister2 {
  // --- Default
  None = 0x00,

  // --- Missing Address Mark in Data Field
  // --- When data IS read from the medium, if the FDC cannot find a data address mark or
  // --- deleted data address mark, then this flag is set.
  MD = 0x01,

  // --- Bad Cylinder
  // --- This bit is related to the ND bit. and when the contents of C on the medium is different from
  // --- that stored in the IDR and the contents of C is FFH. then this flag is set.
  BC = 0x02,

  // --- Scan Not Satisfied
  // --- During execution of the Scan command, if the FD cannot find a sector on the cylinder which meets the condition.
  // --- then this flag is set.
  /// </summary>
  SN = 0x04,

  // --- Scan Equal Hit
  // --- During execution of the Scan command. if the condition of "equal" is satisfied, this flag is set.
  SH = 0x08,

  // --- Wrong Cylinder
  // --- This bit is related to the ND bit, and when the contents of C(3) on the medium is different from that stored i n the IDR.
  // --- this flag is set.
  WC = 0x10,

  // --- Data Error in Data Field
  // --- If the FDC detects a CRC error in the data field then this flag is set.
  DD = 0x20,

  // --- Control Mark
  // --- During execution of the Read Data or Scan command, if the FDC encounters a sector
  // --- which contains a deleted data address mark, this flag is set Also set if DAM is found during Read Deleted Data.
  CM = 0x40
}

// --- Status Register 3
export enum StatusRegister3 {
  // --- Default
  None = 0x00,

  // --- Unit select 0
  // --- This bit is used to indicate the status of the unit select 0 signal to the FDD.
  US0 = 0x01,

  // --- Unit select 1
  // --- This bit is used to Indicate the status of the unit select 1 signal to the FDD.
  US1 = 0x02,

  // --- Head address
  // --- This bit is used to indicate the status of the ide select signal to the FDD.
  HD = 0x04,

  // --- Two Side (0 = yes, 1 = no)
  // --- This bit is used to indicate the status of the two-side signal from the FDD.
  TS = 0x08,

  // --- Track 0
  // --- This bit is used to indicate the status of the track 0 signal from the FDD.
  T0 = 0x10,

  // --- Ready
  // --- This bit is used to Indicate the status of the ready signal from the FDD.
  RY = 0x20,

  // --- Write Protected
  // --- This bit is used to indicate the status of the write protected signal from the FDD.
  WP = 0x40,

  // --- Fault
  // --- This bit is used to indicate the status of the fault signal from the FDD.
  FT = 0x80
}

// --- Drive seek states
export enum DriveSeekState {
  Idle = 0,
  Seek = 1,
  Recalibrate = 2
}

// --- Type that holds configuration about a specific command
export type CommandConfiguration = {
  // --- The command code after bitmask has been applied
  commandCode: CommandCode;

  // --- Action to handle the command
  commandHandler: () => void;

  // --- The number of bytes that make up the full command
  parameterBytesCount: number;

  // --- The number of result bytes that will be generated from the command
  resultBytesCount: number;

  // --- Command flow
  commandFlow: CommandFlow;

  // --- Command operation Read/Write
  commandOperation: CommandOperation;

  // --- Command flags
  commandFlags: CommandFlags;
};

// --- Command common flags
export type CommandFlags = {
  // --- Multitrack
  mt: boolean;

  // --- Multi Format Single/double density
  mf: boolean;

  // --- Skip
  sk: boolean;
};

// --- Floppy disk drive controller command.
export type Command = {
  // --- Track
  readonly c: number;

  // --- Side
  readonly h: number;

  // --- Sector ID
  readonly r: number;

  // --- Sector Size
  readonly n: number;

  // --- Status register 0
  //
  // b0,1    US Unit Select(driveno during interrupt)
  // b2      HD  Head Address(head during interrupt)
  // b3      NR  Not Ready(drive not ready or non-existing 2nd head selected)
  // b4      EC  Equipment Check(drive failure or recalibrate failed (retry))
  // b5      SE  Seek End(Set if seek-command completed)
  // b6,7    IC Interrupt Code(0=OK, 1=aborted:readfail/OK if EN, 2=unknown cmd
  //         or senseint with no int occured, 3=aborted:disc removed etc.)
  readonly st0: number;

  // --- Status register 1
  //
  // b0      MA  Missing Address Mark(Sector_ID or DAM not found)
  // b1      NW  Not Writeable(tried to write/format disc with wprot_tab = on)
  // b2      ND  No Data(Sector_ID not found, CRC fail in ID_field)
  // b3,6    0   Not used
  // b4      OR  Over Run(CPU too slow in execution-phase (ca. 26us/Byte))
  // b5      DE  Data Error(CRC-fail in ID- or Data-Field)
  // b7      EN  End of Track(set past most read/write commands) (see IC)
  readonly st1: number;

  // --- Status register 2
  //
  // b0      MD  Missing Address Mark in Data Field(DAM not found)
  // b1      BC  Bad Cylinder(read/programmed track-ID different and read-ID = FF)
  // b2      SN  Scan Not Satisfied(no fitting sector found)
  // b3      SH  Scan Equal Hit(equal)
  // b4      WC  Wrong Cylinder(read/programmed track-ID different) (see b1)
  // b5      DD Data Error in Data Field(CRC-fail in data-field)
  // b6      CM  Control Mark(read/scan command found sector with deleted DAM)
  // b7      0   Not Used
  readonly st2: number;

  // --- Status register 3
  //
  // b0,1    US Unit Select (pin 28,29 of FDC)
  // b2      HD  Head Address (pin 27 of FDC)
  // b3      TS  Two Side (0=yes, 1=no (!))
  // b4      T0  Track 0 (on track 0 we are)
  // b5      RY  Ready (drive ready signal)
  // b6      WP  Write Protected(write protected)
  // b7      FT  Fault (if supported: 1=Drive failure)
  readonly st3: number;

  // --- Last transmitted/received data bytes
  readonly dataBytes?: Uint8Array;

  // --- Read/write data command ID
  readonly dataId?: number;
};

// --- Floppy disk drive controller command data
export type CommandData = {
  // --- The requested drive
  unitSelect: number;

  // --- The requested physical side
  side: number;

  // --- The requested track (C)
  cylinder: number;

  // --- The requested head (H)
  head: number;

  // --- The requested sector (R)
  sector: number;

  // --- The specified sector size (N)
  sectorSize: number;

  // --- The end of track or last sector value (EOT)
  eot: number;

  // --- Gap3 length (GPL)
  gap3Length: number;

  // --- Data length (DTL) - When N is defined as 00, DTL stands for the data length
  // --- which users are going to read out or write into the sector
  dtl: number;
};
