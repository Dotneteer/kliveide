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
  // TODO: Add properties
}
