// This enum defines the run modes the Z80TestMachine allows
export enum RunMode {
  // Run while the machine is disposed or a break signal arrives.
  Normal = 0,

  // Run a single CPU Execution cycle, even if an operation
  // contains multiple bytes
  OneCycle = 1,

  // Pause when the next single instruction is executed.
  OneInstruction = 2,

  // Run until a HALT instruction is reached.
  UntilHalt = 3,

  // Run until the whole injected code is executed
  UntilEnd = 4
}
