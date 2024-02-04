import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import {
  COMFlags,
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
   * Initialize the keyboard device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor (public readonly machine: IZ88Machine) {
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

    // --- Reset other Blink registers
    this.resetRtc();
    this.setACK(0);
    this.COM = 0;
    this.EPR = 0;
    this.setINT(INTFlags.FLAP | INTFlags.TIME | INTFlags.GINT);
    this.STA = 0;
    this.TSTA = 0;
  }

  /**
   * Resets the RTC counters
   */
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
    if (this.COM & COMFlags.RAMS) {
      // --- Bank $20, RAM
      this.machine.memory.setMemoryPageInfo(0, 0x20, false);
    } else {
      // --- Bank $00, ROM
      this.machine.memory.setMemoryPageInfo(0, 0x00, false);
    }

    // --- Upper 8K of SR0
    this.machine.memory.setMemoryPageInfo(0, bank, true);
  }

  /**
   * Set the value of the SR1 register
   * @param bank value to set
   */
  setSR1 (bank: number): void {
    this.SR1 = bank;

    // --- Set up the memory page info for this slot
    this.machine.memory.setMemoryPageInfo(1, bank);
  }

  /**
   * Set the value of the SR2 register
   * @param bank value to set
   */
  setSR2 (bank: number): void {
    this.SR2 = bank;

    // --- Set up the memory page info for this slot
    this.machine.memory.setMemoryPageInfo(2, bank);
  }

  /**
   * Set the value of the SR3 register
   * @param bank value to set
   */
  setSR3 (bank: number): void {
    this.SR3 = bank;

    // --- Set up the memory page info for this slot
    this.machine.memory.setMemoryPageInfo(3, bank);
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
   * Sets the COM register value
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

  // --- Tests if the maskable interrupt has been requested
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
}
