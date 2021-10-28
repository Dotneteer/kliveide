/**
 * Represents an abstract CPU
 */
export interface ICpu {
  /**
   * Gets the state of the CPU
   */
  getCpuState(): ICpuState;
}

/**
 * Represents the state of an abstract CPU
 */
export interface ICpuState {
  // --- Override in derived interfaces and implemented classes
}

/**
 * Represents the WebAssembly CPU API
 */
export interface WasmCpuApi {
  memory: any;
  resetCpu(hard: boolean): void;
  getCpuState(): void;
  updateCpuState(): void;
  setCpuDiagnostics(flags: number): void;
  setClockMultiplier(flags: number): void;
  setPC(pc: number): void;
  setSP(sp: number): void;
}
