import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import {
  AccessType,
  COMFlags,
  CardType,
  INTFlags,
  IZ88BlinkDevice,
  STAFlags,
  TMKFlags,
  TSTAFlags
} from "./IZ88BlinkDevice";
import { IZ88BlinkTestDevice } from "./IZ88BlinkTestDevice";

/**
 * Represents the Blink device of Cambridge Z88
 */
export class Z88BlinkDevice implements IZ88BlinkDevice, IZ88BlinkTestDevice {
  /**
   * Chip size masks describing the chip size (5 byte values)
   * 0: Internal ROM size
   * 1: Internal RAM size
   * 2: Card Slot 1 size
   * 3: Card Slot 2 size
   * 4: Card Slot 3 size
   *
   * Chip size masking: determines the size of physical memory of a particular chip.
   * A mask value is 6 bits, and can be used to mask out the lowest 6 bit of
   * a bank index.
   * For example, if Chip 3 has 32K memory, mask value is $01. When you address
   * bank $40 and bank $42, they result in as if you addressed bank $40, to
   * represent that the memory contents seem to be repeated for each  32K of
   * the addressable 1M space. Similarly, $41, $43, $45, ..., $fd, and $ff each
   * repeat the upper 16K of the 32K memory.
   *
   * Mask Values:
   * $00: Chip nop present
   * $01: 32K
   * $03: 64K
   * $07: 128K
   * $0f: 256K
   * $1f: 512K
   * $3f: 1M
   */
  private readonly _chipMasks: number[] = [0, 0, 0, 0, 0];

  /**
   * Slot behavior for slots #1-3 (3 byte values)
   */
  private readonly _slotTypes: CardType[] = [
    CardType.None,
    CardType.None,
    CardType.None
  ];

  /**
   * Information bout banks (RAM, ROM, Unavailable)
   */
  private readonly _bankAccess: AccessType[] = [];

  /**
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {
    // --- Initialize ROM information
    for (let i = 0; i < 256; i++) {
      this._bankAccess.push(AccessType.Ram);
    }
  }

  /**
   * Reset the device to its initial state.
   */
  reset (): void {
    // --- Reset memory
    this.setSR0(0);
    this.setSR1(0);
    this.setSR2(0);
    this.setSR3(0);

    // --- 512K internal ROM
    this.setChipMask(0, 0x1f);

    // --- 512K internal RAM
    this.setChipMask(1, 0x1f);

    // --- No cards in any slot
    this.setChipMask(2, 0x1f);
    this.setChipMask(3, 0x3f);
    this.setChipMask(4, 0x0f);

    // --- Card 1 is RAM
    this.setSlotMask(1, CardType.None);
    this.setSlotMask(2, CardType.None);
    this.setSlotMask(3, CardType.None);

    this.resetRtc();

    this.setACK(0);
    this.COM = 0;
    this.EPR = 0;
    this.setINT(INTFlags.FLAP | INTFlags.TIME | INTFlags.GINT);
    this.STA = 0;
    this.TSTA = 0;
  }

  resetRtc (): void {
    this.TIM0 = 0;
    this.TIM1 = 0;
    this.TIM2 = 0;
    this.TIM3 = 0;
    this.TIM4 = 0;
    this.TSTA = 0;
    this.TMK = TMKFlags.TICK;
  }

  /**
   * Dispose the resources held by the device
   */
  dispose (): void {
    // --- Nothing to dispose
  }

  /**
   * Segment register 0 (8-bit)
   */
  SR0: number;

  /**
   * Segment register 1 (8-bit)
   */
  SR1: number;

  /**
   * Segment register 2 (8-bit)
   */
  SR2: number;

  /**
   * Segment register 3 (8-bit)
   */
  SR3: number;

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
   * Set the value of the SR0 register
   * @param bank Bank value to set
   */
  setSR0 (bank: number): void {
    // --- Store SR0 value
    this.SR0 = bank & 0xff;

    // --- Lower 8K of SR0
    const mem = this.machine.memory;
    if (this.COM & COMFlags.RAMS) {
      // --- Bank $20, RAM
      mem.setPageInfo(0, 0x08_0000, 0x20, false);
    } else {
      // --- Bank $00, ROM
      mem.setPageInfo(0, 0x00_0000, 0x00, true);
    }

    // --- Upper 8K of SR0
    const pageOffset =
      this.calculatePageOffset(bank & 0xfe) + (bank & 0x01) * 0x2000;
    mem.setPageInfo(
      1,
      pageOffset,
      bank,
      this._bankAccess[bank] !== AccessType.Ram
    );
  }

  /**
   * Set the value of the SR1 register
   * @param bank value to set
   */
  setSR1 (bank: number): void {
    this.SR1 = bank;
    const pageOffset = this.calculatePageOffset(bank);
    const romKind = this._bankAccess[bank] === AccessType.Rom;
    const mem = this.machine.memory;

    // --- Offset for 0x4000-0x5fff
    mem.setPageInfo(2, pageOffset, bank, romKind);

    // --- Offset for 0x6000-0x7fff
    mem.setPageInfo(3, pageOffset + 0x2000, bank, romKind);
  }

  /**
   * Set the value of the SR2 register
   * @param bank value to set
   */
  setSR2 (bank: number): void {
    this.SR2 = bank;
    const pageOffset = this.calculatePageOffset(bank);
    const romKind = this._bankAccess[bank] === AccessType.Rom;
    const mem = this.machine.memory;

    // --- Offset for 0x8000-0x9fff
    mem.setPageInfo(4, pageOffset, bank, romKind);

    // --- Offset for 0xa000-0xbfff
    mem.setPageInfo(5, pageOffset + 0x2000, bank, romKind);
  }

  /**
   * Set the value of the SR3 register
   * @param bank value to set
   */
  setSR3 (bank: number): void {
    this.SR3 = bank;
    const pageOffset = this.calculatePageOffset(bank);
    const romKind = this._bankAccess[bank] === AccessType.Rom;
    const mem = this.machine.memory;

    // --- Offset for 0xc000-0xdfff
    mem.setPageInfo(6, pageOffset, bank, romKind);

    // --- Offset for 0xe000-0xffff
    mem.setPageInfo(7, pageOffset + 0x2000, bank, romKind);
  }

  /**
   * Sets the chip mask for the specified chip
   * @param chip Chip index
   * @param mask Chip mask to set
   */
  setChipMask (chip: number, mask: number): void {
    // --- Clamp the slot index
    if (chip > 4) {
      chip = 4;
    }

    // --- Store the mask value
    this._chipMasks[chip] = mask;

    // --- Recalculate all page indexes
    this.setSR0(this.SR0);
    this.setSR1(this.SR1);
    this.setSR2(this.SR2);
    this.setSR3(this.SR3);

    // --- Create ROM information
    this.recalculateBankInfo();
  }

  /**
   * Sets the slot type for the specified slot
   * @param slot Slot index
   * @param cardType Indicates if the slot is ROM
   */
  setSlotMask (slot: number, cardType: CardType): void {
    if (slot < 1) slot = 1;
    if (slot > 3) slot = 3;
    this._slotTypes[slot - 1] = cardType;
    this.recalculateBankInfo();
  }

  /**
   * Sets the TACK register value
   * @param value value to set
   */
  setTACK (value: number): void {
    if (value & TSTAFlags.TICK) {
      // --- Reset BM_TSTATICK
      this.TSTA &= 0xfe;
    }

    if (value & TSTAFlags.SEC) {
      // --- Reset BM_TSTASEC
      this.TSTA &= 0xfd;
    }

    if (value & TSTAFlags.MIN) {
      // --- Reset BM_TSTAMIN
      this.TSTA &= 0xfb;
    }

    if (!this.TSTA) {
      this.setSTA(this.STA & 0xfe);
    }
  }

  /**
   * Sets the ACK register value
   * @param value value to set
   */
  setACK (value: number): void {
    this.setSTA(this.STA & ((value & 0xff) ^ 0xff));
  }

  /**
   * Increments the timer counters
   */
  incrementRtc (): void {
    // --- Sign no TICK event
    let tickEvent = 0;

    if (this.COM & COMFlags.RESTIM) {
      // --- Stop Real Time Clock (RESTIM = 1) and reset counters
      this.resetRtc();
      return;
    }

    // --- Increment TIM0
    this.TIM0 += 1;
    if (this.TIM0 > 199) {
      // --- When this counter reaches 200, wrap back to 0
      this.TIM0 = 0;
    } else {
      if (this.TIM0 & 0x01) {
        // --- A 10ms TSTA.TICK event as occurred (every 2nd 5ms count)
        tickEvent = TSTAFlags.TICK;
      }

      if (this.TIM0 === 0x80) {
        // --- According to blink dump monitoring on Z88, when TIM0 reaches 0x80 (bit 7), a second has passed
        this.TIM1 += 1;
        tickEvent = TMKFlags.SEC;

        if (this.TIM1 > 59) {
          // --- 60 seconds passed
          this.TIM1 = 0;

          // --- Increment TIM2
          this.TIM2 += 1;
          if (this.TIM2 > 255) {
            // --- 256 minutes has passed
            this.TIM2 = 0;

            // --- Increment TIM3
            this.TIM3 += 1;
            if (this.TIM3 > 255) {
              // --- 65535 minutes has passed
              this.TIM3 = 0;

              // --- Increment TIM4
              this.TIM4 += 1;
              if (this.TIM4 > 31) {
                // --- 32 * 65535 minutes has passed
                this.TIM4 = 0;
              }
            }
          }
        }

        if (this.TIM1 === 32) {
          // --- 1 minute has passed
          tickEvent = TSTAFlags.MIN;
        }
      }
    }

    if (!(this.INT & INTFlags.GINT)) {
      // --- No interrupts get out of Blink
      return;
    }

    if (this.STA & STAFlags.FLAPOPEN) {
      // ---Flap is Open
      // --- (on real hardware, there is no interrupt - in OZvm it's a trick to get
      // --- LCD switched off properly by the ROM)
      // --- (guarantee there is no STA.TIME event)
      this.setSTA(this.STA & 0xfe);
      if (this.TIM0 % 3 === 0) {
        this.machine.awakeCpu();
      }
      return;
    }

    if (!(this.INT & INTFlags.TIME)) {
      // --- INT.TIME is not enabled (no RTC interrupts)
      // --- No interrupt is fired
      this.setSTA(this.STA & 0xfe);
      return;
    }

    if (!this.TMK) {
      // --- No time event (a TMK.TICK, TMK.SEC or TMK.MIN) is enabled (not allowed to happen)
      // --- No interrupt is fired
      this.setSTA(this.STA & 0xfe);
      return;
    }

    if (tickEvent) {
      // --- always signal what RTC event happened in Blink
      this.TSTA = tickEvent;
      if (this.TMK & tickEvent) {
        // --- only fire the interrupt that TMK is allowing to come out
        this.setSTA(this.STA | STAFlags.TIME);
        this.machine.awakeCpu();
      }
    }
  }

  /**
   * Sets the TSTA register value
   * @param value value to set
   */
  setSTA (value: number): void {
    this.STA = value;
    this.checkMaskableInterruptRequested();
  }

  /**
   * Signs if interrupt is active
   */
  interruptSignalActive: boolean;

  /**
   * Signals that the battery is low
   */
  raiseBatteryLow (): void {
    this.setSTA(this.STA | STAFlags.BTL);
  }

  /**
   * Sets the INT register value
   * @param value value to set
   */
  setINT (value: number): void {
    this.INT = value;
    this.checkMaskableInterruptRequested();
  }

  /**
   * Sets the TCOM register value
   * @param value value to set
   */
  setCOM (value: number): void {
    // --- Set the register value
    this.COM = value & 0xff;

    // --- Reset the timer when requested
    if (value & COMFlags.RESTIM) {
      this.resetRtc();
    }

    // --- Set the last beeper bit
    if (!(value & COMFlags.SRUN)) {
      this.machine.beeperDevice.setEarBit((value & COMFlags.SBIT) !== 0);
    }

    // --- RAMS flag may change, s0 emulate setting SR0 again
    this.setSR0(this.SR0);
  }

  /**
   * Gets the access type of the specified address
   * @param address Address to obtain the access type for
   */
  getAccessTypeOfAddress (address: number): AccessType {
    if (address <= 0x1fff) {
      return this._bankAccess[this.COM & COMFlags.RAMS ? 0x20 : 0x00]
    }
    let srValue = this.SR0;
    switch (address >> 14) {
      case 1:
        srValue = this.SR1;
        break;
      case 2:
        srValue = this.SR2;
        break;
      case 3:
        srValue = this.SR3;
        break;      
    }
    return this._bankAccess[srValue];
  }

  // ==========================================================================
  // Helpers

  /**
   * Recalculates the ROM information from the current state
   */
  recalculateBankInfo (): void {
    let bank = 0;
    while (bank < 0x100) {
      let accessType = 0;
      if (bank <= 0x1f) {
        // --- Internal ROM
        accessType = AccessType.Rom;
      } else if (bank <= 0x3f) {
        // --- Internal RAM
        accessType = AccessType.Ram;
      } else if (bank <= 0x7f) {
        // --- Card Slot 1 RAM
        accessType = this._chipMasks[2]
          ? this._slotTypes[0] === CardType.EPROM
            ? AccessType.Rom
            : AccessType.Ram
          : AccessType.Unavailable;
      } else if (bank <= 0xbf) {
        // --- Card Slot 2 RAM
        accessType = this._chipMasks[3]
          ? this._slotTypes[1] === CardType.EPROM
            ? AccessType.Rom
            : AccessType.Ram
          : AccessType.Unavailable;
      } else {
        // --- Card Slot 3 RAM/EPROM
        accessType = this._chipMasks[4]
          ? this._slotTypes[2] === CardType.EPROM
            ? AccessType.Rom
            : AccessType.Ram
          : AccessType.Unavailable;
      }
      this._bankAccess[bank] = accessType;
      bank += 1;
    }
  }

  /**
   * Calculates the page offset for the specified bank
   * @param bank Bank index
   * @returns The page offset
   */
  calculatePageOffset (bank: number): number {
    let sizeMask = this._chipMasks[bank <= 0x1f ? 0 : 1 + (bank >> 6)];
    return (
      ((bank < 0x40 ? bank & 0xe0 : bank & 0xc0) | (bank & sizeMask & 0x3f)) <<
      14
    );
  }

  // Tests if the maskable interrupt has been requested
  checkMaskableInterruptRequested (): void {
    // --- Is the BM_INTGINT flag set?
    if (this.INT & INTFlags.GINT) {
      if (this.INT & this.STA) {
        this.interruptSignalActive = true;
        return;
      }
    }

    // --- No interrupt
    this.interruptSignalActive = false;
  }

  // ==========================================================================
  // IZ88BlinkTestDevice implementation

  getChipMask (chip: number): number {
    return this._chipMasks[chip];
  }
}
