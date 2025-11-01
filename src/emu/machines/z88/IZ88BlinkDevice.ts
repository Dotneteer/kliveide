import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";

/**
 * This interface defines the properties and operations of the Cambridge Z88 Blink device.
 */
export interface IZ88BlinkDevice extends IGenericDevice<IZ88Machine> {
  /**
   * Segment register 0 (8-bit)
   */
  readonly SR0: number;

  /**
   * Segment register 1 (8-bit)
   */
  readonly SR1: number;

  /**
   * Segment register 2 (8-bit)
   */
  readonly SR2: number;

  /**
   * Segment register 3 (8-bit)
   */
  readonly SR3: number;

  /**
   * 5 millisecond period, counts from 0 to 199 (8-bit)
   */
  readonly TIM0: number;

  /**
   * 1 second period, counts from 0 to 59 (8-bit)
   */
  readonly TIM1: number;

  /**
   * 1 minute period, counts from 0 to 59 (8-bit)
   */
  readonly TIM2: number;

  /**
   * 256 minute period, counts from 0 to 255 (8-bit)
   */
  readonly TIM3: number;

  /**
   * 8K minutes period, counts from 0 to 31 (8-bit)
   */
  readonly TIM4: number;

  /**
   * Timer interrupt status (8-bit)
   */
  readonly TSTA: number;

  /**
   * Timer interrupt mask (8-bit)
   */
  TMK: number;

  /**
   * Main Blink Interrrupts (8-bit)
   */
  readonly INT: number;

  /**
   * Main Blink Interrupt Status (8-bit)
   */
  readonly STA: number;

  /**
   * BLINK Command Register (8-bit)
   */
  readonly COM: number;

  /**
   * EPR, Eprom Programming Register (8-bit)
   */
  EPR: number;

  /**
   * Set the value of the SR0 register
   * @param bank Bank value to set
   */
  setSR0(bank: number): void;

  /**
   * Set the value of the SR1 register
   * @param bank Bank value to set
   */
  setSR1(bank: number): void;

  /**
   * Set the value of the SR2 register
   * @param bank Bank value to set
   */
  setSR2(bank: number): void;

  /**
   * Set the value of the SR3 register
   * @param bank Bank value to set
   */
  setSR3(bank: number): void;

  /**
   * Sets the TACK register value
   * @param value value to set
   */
  setTACK(value: number): void;

  /**
   * Sets the ACK register value
   * @param value value to set
   */
  setACK(value: number): void;

  /**
   * Increments the timer counters
   */
  incrementRtc(): void;

  /**
   * Sets the TSTA register value
   * @param value value to set
   */
  setSTA(value: number): void;

  /**
   * Signs if interrupt is active
   */
  readonly interruptSignalActive: boolean;

  /**
   * Signals that the battery is low
   */
  raiseBatteryLow(): void;

  /**
   * Sets the INT register value
   * @param value value to set
   */
  setINT(value: number): void;

  /**
   * Sets the TCOM register value
   * @param value value to set
   */
  setCOM(value: number): void;
}

/**
 * TSTA flag masks
 */
export enum TSTAFlags {
  MIN = 0x04, // TSTA: Set if minute interrupt has occurred
  SEC = 0x02, // TSTA: Set if second interrupt has occurred
  TICK = 0x01 // TSTA: Set if tick interrupt has occurred
}

/**
 * TMK flag masks
 */
export enum TMKFlags {
  MIN = 0x04, // TMK: Set to enable minute interrupt
  SEC = 0x02, // TMK: Set to enable second interrupt
  TICK = 0x01 // TMK: Set to enable tick interrupt
}

/**
 * COM flag masks
 */
export enum COMFlags {
  SRUN = 0x80, // Bit 7, SRUN
  SBIT = 0x40, // Bit 6, SBIT
  OVERP = 0x20, // Bit 5, OVERP
  RESTIM = 0x10, // Bit 4, RESTIM
  PROGRAM = 0x08, // Bit 3, PROGRAM
  RAMS = 0x04, // Bit 2, RAMS
  VPPON = 0x02, // Bit 1, VPPON
  LCDON = 0x01 // Bit 0, LCDON
}

/**
 * INT flag masks
 */
export enum INTFlags {
  KWAIT = 0x80, // Bit 7, If set, reading the keyboard will Snooze
  A19 = 0x40, // Bit 6, If set, an active high on A19 will exit Coma
  FLAP = 0x20, // Bit 5, If set, flap interrupts are enabled
  UART = 0x10, // Bit 4, If set, UART interrupts are enabled
  BTL = 0x08, // Bit 3, If set, battery low interrupts are enabled
  KEY = 0x04, // Bit 2, If set, keyboard interrupts (Snooze or Coma) are enabl.
  TIME = 0x02, // Bit 1, If set, RTC interrupts are enabled
  GINT = 0x01 // Bit 0, If clear, no interrupts get out of blink
}

/**
 * STA flag masks
 */
export enum STAFlags {
  FLAPOPEN = 0x80, // Bit 7, If set, flap open, else flap closed
  A19 = 0x40, // Bit 6, If set, high level on A19 occurred during coma
  FLAP = 0x20, // Bit 5, If set, positive edge has occurred on FLAPOPEN
  UART = 0x10, // Bit 4, If set, an enabled UART interrupt is active
  BTL = 0x08, // Bit 3, If set, battery low pin is active
  KEY = 0x04, // Bit 2, If set, a column has gone low in snooze (or coma)
  TIME = 0x01, // Bit 0, If set, an enabled TSTA interrupt is active
  TIME_MASK = 0xfe // Bit 0 reset mask
}

/**
 * Memory bank access types
 */
export enum AccessType {
  Ram = 0x00,
  Rom = 0x01,
  Unavailable = 0xff
}
