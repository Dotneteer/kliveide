import { IM6510Cpu } from "./IM6510Cpu";

/**
 * Represents a MOS 6510 VIC-aware CPU
 */
export interface IM6510VaCpu extends IM6510Cpu {
  /**
   * Sets the IRQ signal state.
   * @param value The new state of the IRQ signal.
   */
  setIrqSignal(value: boolean): void;

  /**
   * Sets the NMI signal state.
   * @param value The new state of the NMI signal.
   */
  setNmiSignal(value: boolean): void;

  /**
   * Sets the VIC-II Phi1 processor function.
   * @param processor The function to process the Phi1 clock cycle.
   */
  setVicPhi1Processor(processor?: () => void): void;

  /**
   * Sets the VIC-II Phi2 processor function.
   * @param processor The function to process the Phi2 clock cycle.
   */
  setVicPhi2Processor(processor?: () => void): void;
}
