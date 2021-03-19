import { RunMode } from "./RunMode";

/**
 * Represents the CPU API
 */
export interface CpuApi {
  memory: any;
  turnOnCpu(): void;
  resetCpu(): void;
  getCpuState(): void;
  updateCpuState(): void;
  setCpuDiagnostics(flags: number): void;
  setClockMultiplier(flags: number): void;
  setPC(pc: number): void;
  setSP(sp: number): void;
  snoozeCpu(): void;
  awakeCpu(): void;
}

/**
 * Represents the API for CPU tests
 */
export interface TestCpuApi extends CpuApi {
  prepareTest(mode: RunMode, codeEnds: number): void;
  setTestInputLength(length: number): void;
  getMemLogLength(): number;
  getIoLogLength(): number;
  getTbBlueLogLength(): number;
  runTestCode(): void;
  resetMachine(): void;
}

/**
 * Represents the Machine API
 */
export interface MachineApi extends CpuApi {
  // --- Virtual machine methods
  setupMachine(): void;
  resetMachine(): void;
  setUlaIssue(ula: number): void;
  getMachineState(): void;
  getExecutionEngineState(): void;
  setExecutionOptions(): void;
  executeMachineLoop(): void;
  setInterruptTact(tact: number): void;
  checkForInterrupt(tact: number): void;
  setKeyStatus(key: number, isDown: boolean): void;
  getKeyStatus(key: number): number;
  setBeeperSampleRate(rate: number): void;
  colorize(): void;
  getCursorMode(): number;
  initTape(blocks: number): void;
  setFastLoad(value: boolean): void;
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
  testReadCz88Memory(addr: number): number;
  testWriteCz88Memory(addr: number, value: number): number;
  setZ88ChipMask(slot: number, value: number): void;
  setZ88Card3Rom(isRom: boolean): void;
  setZ88RndSeed(seed: number): void;
  writePortCz88(addr: number, value: number): void;
  clearMemory(): void;
  setZ88ScreenSize(scw: number, sch: number): void;
  raiseBatteryLow(): void;
}
