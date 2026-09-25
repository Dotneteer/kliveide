/*
 * The Blink register bits the Z88 core suites set and test, as the Blink documentation names them.
 * They lived beside the TypeScript Blink device (`IZ88BlinkDevice.ts`) until it was removed
 * (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`); the WASM core names the same bits in C
 * (`Z88_COM_SRUN`, ...).
 */

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
