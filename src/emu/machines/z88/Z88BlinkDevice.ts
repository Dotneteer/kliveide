import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IZ88BlinkDevice, TMKFlags } from "./IZ88BlinkDevice";

/**
 * Represents the Blink device of Cambridge Z88
 */
export class Z88BlinkDevice implements IZ88BlinkDevice {
  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {}

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    this.TIM0 = 0;
    this.TIM1 = 0;
    this.TIM2 = 0;
    this.TIM3 = 0;
    this.TIM4 = 0;
    this.TSTA = 0;
    this.TMK = TMKFlags.MIN;
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }

  /**
   * 5 millisecond period, counts from 0 to 199 (8-bit)
   */
  TIM0: number;

  /**
   * 1 second period, counts from 0 to 59 (8-bit)
   */
  TIM1: number;

  /**
   * 1 minute period, counts from 0 to 59 (8-bit)
   */
  TIM2: number;

  /**
   * 256 minute period, counts from 0 to 255 (8-bit)
   */
  TIM3: number;

  /**
   * 8K minutes period, counts from 0 to 31 (8-bit)
   */
  TIM4: number;

  /**
   * Timer interrupt status (8-bit)
   */
  TSTA: number;

  /**
   * Main Blink Interrrupts (8-bit)
   */
  INT: number;

  /**
   * Timer interrupt mask (8-bit)
   */
  TMK: number;

  /**
   * Main Blink Interrupt Status (8-bit)
   */
  STA: number;

  /**
   * BLINK Command Register (8-bit)
   */
  COM: number;

  /**
   * EPR, Eprom Programming Register (8-bit)
   */
  EPR: number;

  /**
   * Sets the TACK register value
   * @param value value to set
   */
  setTACK (value: number): void {
    // TODO: Implement this
  }

  /**
   * Sets the ACK register value
   * @param value value to set
   */
  setACK (value: number): void {
    // TODO: Implement this
  }

  /**
   * Increments the timer counters
   */
  incrementRtc (): void {
    // TODO: Implement this
  }

  /**
   * Sets the TSTA register value
   * @param value value to set
   */
  setSTA (value: number): void {
    // TODO: Implement this
  }

  /**
   * Signs if interrupt is active
   */
  interruptSignalActive: boolean;

  /**
   * Signals that the battery is low
   */
  raiseBatteryLow (): void {
    // TODO: Implement this
  }

  /**
   * Sets the INT register value
   * @param value value to set
   */
  setINT (value: number): void {
    // TODO: Implement this
  }

  /**
   * Sets the TCOM register value
   * @param value value to set
   */
  setCOM (value: number): void {
    // TODO: Implement this
  }
}
