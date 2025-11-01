import { IZ80Cpu } from "./IZ80Cpu";

/**
 * This interface represents the behavior and state of the Z80N CPU (Next instruction set), which is available from outside by other components.
 */
export interface IZ80NCpu extends IZ80Cpu {
  /**
   * Sets a TBBlue register value
   * @param address Register address
   * @param value Register value;
   */
  tbblueOut(address: number, value: number): void;
}