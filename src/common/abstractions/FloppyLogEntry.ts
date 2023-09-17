// --- A log entry about floppy events
export type FloppyLogEntry = {
  addr: number;
  opType: PortOperationType;
  data: number;
  phase?: string;
  comment?: string;
};

// --- Operation type
export enum PortOperationType {
  ReadData = 0,
  ReadMsr = 1,
  WriteData = 2,
  MotorEvent = 3
}
