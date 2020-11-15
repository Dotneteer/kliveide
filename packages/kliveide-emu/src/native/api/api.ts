import { RunMode } from "./RunMode";
import { SpectrumKeyCode } from "./SpectrumKeyCode";

/**
 * Represents the CPU API
 */
export interface CpuApi {
  // --- Test Z80 machine methods
  memory: any;
  turnOnCpu(): void;
  resetCpu(): void;
  getCpuState(): void;
  updateCpuState(): void;
  enableExtendedInstructions(f: boolean): void;
  prepareTest(mode: RunMode, codeEnds: number): void;
  setTestInputLength(length: number): void;
  getMemLogLength(): number;
  getIoLogLength(): number;
  getTbBlueLogLength(): number;
  runTestCode(): void;
  restMachineType(): void;
  setPC(pc: number): void;
  setSP(sp: number): void;
  setInterruptTact(tact: number): void;
  checkForInterrupt(tact: number): void;
}

/**
 * Represents the Machine API
 */
export interface MachineApi extends CpuApi {
  // --- ZX Spectrum machine methods
  initMachine(type: number): void;
  turnOnMachine(): void;
  setUlaIssue(ula: number): void;
  getMachineState(): void;
  setExecutionOptions(): void;
  executeMachineCycle(): void;
  setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void;
  getKeyStatus(key: SpectrumKeyCode): number;
  setBeeperSampleRate(rate: number): void;
  colorize(): void;
  getCursorMode(): number;
  initTape(blocks: number): void;
  setFastLoad(value: boolean): void;
  eraseBreakpoints(): void;
  setBreakpoint(brpoint: number): void;
  removeBreakpoint(brpoint: number): void;
  testBreakpoint(brpoint: number): boolean;
  resetStepOverStack(): void;
  markStepOverStack(): void;
  eraseMemoryWriteMap(): void;
  setMemoryWritePoint(point: number): void;

  // --- Z88 machine methods
  testIncZ88Rtc(inc: number): void;
  testSetRtcRegs(
    tim0: number,
    tim1: number,
    tim2: number,
    tim3: number,
    tim4: number
  ): void;
  testSetZ88INT(value: number): void;
  testSetZ88STA(value: number): void;
  testSetZ88COM(value: number): void;
  testSetZ88TMK(value: number): void;
  setSlotMask(slote: number, value: number): void;
  writePortCz88(addr: number, value: number): void;
}
