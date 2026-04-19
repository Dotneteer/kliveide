import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * CTC channel state machine states (matches FPGA ctc_chan.vhd)
 */
const enum CtcState {
  /** Waiting for control word with D2=1 (time constant follows) */
  CONTROL_WORD = 0,
  /** Waiting for time constant byte */
  TIME_CONSTANT = 1,
  /** Timer mode with trigger-start (D3=1), waiting for trigger edge */
  WAIT = 2,
  /** Counting down; ZC/TO fires on zero-crossing */
  RUNNING = 3
}

/**
 * One channel of the Z80 CTC (Counter/Timer Circuit).
 *
 * Faithfully follows the FPGA ctc_chan.vhd implementation:
 * - 4-state FSM: CONTROL_WORD → TIME_CONSTANT → WAIT → RUNNING
 * - Prescaler: divides system clock by 16 (D5=0) or 256 (D5=1)
 * - Counter mode (D6=1): external trigger directly decrements count
 * - Timer mode (D6=0): prescaler output decrements count
 * - ZC/TO: one-cycle pulse on zero-crossing transition
 *
 * Control word bits (D0=1 marks control word):
 *   D7: Interrupt enable
 *   D6: Counter mode (1) / Timer mode (0)
 *   D5: Prescaler 256 (1) / 16 (0) — timer mode only
 *   D4: Trigger edge: rising (1) / falling (0)
 *   D3: Timer trigger-start (1=wait for trigger) / (0=start immediately)
 *   D2: Time constant follows (1) — required on hard reset to leave reset state
 *   D1: Software reset (1)
 *   D0: Control word marker (always 1)
 */
export class CtcChannel {
  // --- State machine
  private _state: CtcState = CtcState.CONTROL_WORD;

  // --- Control register (stores D7..D2, indexed as controlReg[0]=D2 .. controlReg[5]=D7)
  // We store the 6 bits D7-D2 as a single byte for simplicity
  private _controlReg = 0; // bits 5..0 correspond to D7..D2

  // --- Time constant register
  private _timeConstantReg = 0;

  // --- Prescaler counter (8-bit, free-running)
  private _prescalerCount = 0;

  // --- Down-counter
  private _count = 0;

  // --- Previous count-zero state for edge detection
  private _countZeroD = false;

  // --- Previous iowr state for edge detection (FPGA: iowr_d)
  private _iowrD = false;

  // --- Previous external clock/trigger state for edge detection
  private _clkTrgD = false;

  // --- ZC/TO output (one-cycle pulse)
  private _zcTo = false;

  // --- Getters for external inspection
  get state(): CtcState { return this._state; }
  get controlReg(): number { return this._controlReg; }
  get timeConstantReg(): number { return this._timeConstantReg; }
  get count(): number { return this._count; }
  get zcTo(): boolean { return this._zcTo; }
  get intEnabled(): boolean { return !!(this._controlReg & 0x20); } // D7 = bit5 of controlReg

  /**
   * Whether the channel expects a time constant on the next write.
   * Mirrors FPGA combinational: control_reg(2-2) = '1' and state /= S_CONTROL_WORD
   */
  get expectingTimeConstant(): boolean {
    return !!(this._controlReg & 0x01) && this._state !== CtcState.CONTROL_WORD;
  }

  /**
   * Hard reset: resets to initial state
   */
  hardReset(): void {
    this._state = CtcState.CONTROL_WORD;
    this._controlReg = 0;
    this._timeConstantReg = 0;
    this._prescalerCount = 0;
    this._count = 0;
    this._countZeroD = false;
    this._iowrD = false;
    this._clkTrgD = false;
    this._zcTo = false;
  }

  /**
   * Clock the channel by one system clock tick.
   *
   * Models the FPGA behavior where all combinational logic reads pre-update
   * register values, and all registers update simultaneously on the clock edge.
   *
   * @param iowr - true if a write to this channel is active this cycle
   * @param cpuData - the data byte on the CPU bus (only used when iowr rising edge)
   * @param clkTrg - external clock/trigger signal (already synchronized)
   * @param intEnWr - true if interrupt enable is being written externally (NR $C5)
   * @param intEn - interrupt enable value (only used when intEnWr is true)
   */
  clock(iowr: boolean, cpuData: number, clkTrg: boolean, intEnWr: boolean, intEn: boolean): void {
    // ===== SAMPLE CURRENT (PRE-UPDATE) REGISTER VALUES =====
    const oldControlReg = this._controlReg;
    const oldTimeConstantReg = this._timeConstantReg;
    const oldPrescalerCount = this._prescalerCount;
    const oldCount = this._count;
    const oldState = this._state;
    const oldCountZeroD = this._countZeroD;
    const oldIowrD = this._iowrD;
    const oldClkTrgD = this._clkTrgD;

    // ===== COMBINATIONAL LOGIC (all use pre-update register values) =====

    // Decode old control register bits
    const isCounterMode = !!(oldControlReg & 0x10);    // D6
    const prescaler256 = !!(oldControlReg & 0x08);      // D5
    const triggerEdgeRising = !!(oldControlReg & 0x04);  // D4
    const triggerStart = !!(oldControlReg & 0x02);       // D3
    const timeConstantFollows = !!(oldControlReg & 0x01); // D2

    // Edge-detect iowr (FPGA: iowr <= i_iowr and not iowr_d)
    const iowrEdge = iowr && !oldIowrD;

    // Time constant expected? (FPGA: iowr_tc_exp)
    const iowrTcExp = timeConstantFollows && oldState !== CtcState.CONTROL_WORD;

    // Classify the write
    const iowrTc = iowrEdge && iowrTcExp;
    const iowrCr = iowrEdge && !iowrTcExp && !!(cpuData & 0x01);

    // Soft reset trigger (FPGA: reset_soft_trigger)
    const resetSoftTrigger = iowrCr && !!(cpuData & 0x02);

    // Clock edge change: changing D4 counts as a clock edge
    const clkEdgeChange = iowrCr && (!!(cpuData & 0x10) !== triggerEdgeRising);

    // Trigger edge detection (uses OLD clkTrgD and OLD controlReg D4)
    let clkTrgEdge: boolean;
    if (triggerEdgeRising) {
      clkTrgEdge = (clkTrg && !oldClkTrgD) || clkEdgeChange;
    } else {
      clkTrgEdge = (oldClkTrgD && !clkTrg) || clkEdgeChange;
    }

    // Reset soft (FPGA: reset_soft <= '1' when state /= S_RUNNING)
    const resetSoft = oldState !== CtcState.RUNNING;

    // Prescaler output from OLD prescaler count
    const pCountLo = (oldPrescalerCount & 0x0f) === 0x0f;
    const pCountHi = ((oldPrescalerCount >> 4) & 0x0f) === 0x0f;
    const prescalerClk = prescaler256 ? (pCountLo && pCountHi) : pCountLo;

    // Counter enable
    const tCountEn = isCounterMode ? clkTrgEdge : prescalerClk;

    // Counter zero (combinational, from OLD count)
    const tCountZero = oldCount === 0;

    // ZC/TO: one-cycle pulse on zero-crossing transition (must be in RUNNING state)
    const zcTo = tCountZero && !oldCountZeroD && oldState === CtcState.RUNNING;

    // State next
    let stateNext: CtcState;
    if (resetSoftTrigger) {
      stateNext = (cpuData & 0x04) ? CtcState.TIME_CONSTANT : CtcState.CONTROL_WORD;
    } else {
      switch (oldState) {
        case CtcState.CONTROL_WORD:
          stateNext = (iowrCr && !!(cpuData & 0x04))
            ? CtcState.TIME_CONSTANT
            : CtcState.CONTROL_WORD;
          break;
        case CtcState.TIME_CONSTANT:
          stateNext = iowrTc ? CtcState.WAIT : CtcState.TIME_CONSTANT;
          break;
        case CtcState.WAIT:
          if (!isCounterMode && triggerStart && !clkTrgEdge) {
            stateNext = CtcState.WAIT;
          } else {
            stateNext = CtcState.RUNNING;
          }
          break;
        case CtcState.RUNNING:
          stateNext = CtcState.RUNNING;
          break;
        default:
          stateNext = CtcState.CONTROL_WORD;
          break;
      }
    }

    // ===== SEQUENTIAL UPDATES (all registers update "simultaneously") =====

    this._iowrD = iowr;
    this._clkTrgD = clkTrg;
    this._countZeroD = tCountZero;
    this._zcTo = zcTo;
    this._state = stateNext;

    // Prescaler
    this._prescalerCount = resetSoft ? 0 : ((oldPrescalerCount + 1) & 0xff);

    // Counter (uses OLD time_constant_reg for reload)
    if (resetSoft) {
      this._count = oldTimeConstantReg;
    } else if (zcTo) {
      this._count = oldTimeConstantReg;
    } else if (tCountEn) {
      this._count = (oldCount - 1) & 0xff;
    }

    // Control register
    if (iowrCr) {
      this._controlReg = (cpuData >> 2) & 0x3f;
    } else if (iowrTc) {
      this._controlReg = oldControlReg & ~0x01;
    } else if (intEnWr) {
      this._controlReg = intEn ? (oldControlReg | 0x20) : (oldControlReg & ~0x20);
    }

    // Time constant register
    if (iowrTc) {
      this._timeConstantReg = cpuData;
    }
  }

  /**
   * Whether this channel is in counter mode (external trigger)
   */
  get isCounterMode(): boolean {
    return !!(this._controlReg & 0x10); // D6 = bit4 of controlReg (after >>2)
  }

  /**
   * Advance a timer-mode channel by N system clocks (mathematical batch).
   * Only valid for timer-mode, RUNNING-state channels.
   * Returns the number of ZC/TO events that occurred.
   */
  advanceBySysClocks(n: number): number {
    if (this._state !== CtcState.RUNNING || n <= 0) return 0;

    const prescalerDiv = (this._controlReg & 0x08) ? 256 : 16; // D5
    const fires = this._computePrescalerFires(prescalerDiv, n);
    this._prescalerCount = (this._prescalerCount + n) & 0xff;

    return this._advanceCounterByFires(fires);
  }

  /**
   * Advance a counter-mode channel by the given number of trigger events.
   * Returns the number of ZC/TO events that occurred.
   */
  advanceByTriggers(triggers: number): number {
    if (this._state !== CtcState.RUNNING || triggers <= 0) return 0;
    return this._advanceCounterByFires(triggers);
  }

  /**
   * Compute how many prescaler output pulses occur over n system clocks,
   * starting from the current prescaler position.
   */
  private _computePrescalerFires(div: number, n: number): number {
    if (div === 16) {
      const firstFire = (0x0f - (this._prescalerCount & 0x0f)) & 0x0f;
      if (firstFire >= n) return 0;
      return 1 + ((n - 1 - firstFire) / 16 | 0);
    } else {
      const firstFire = (0xff - this._prescalerCount) & 0xff;
      if (firstFire >= n) return 0;
      return 1 + ((n - 1 - firstFire) / 256 | 0);
    }
  }

  /**
   * Advance the counter by the given number of decrement events (prescaler fires
   * for timer mode, or trigger edges for counter mode). Handles ZC/TO generation,
   * reload from time constant, and TC=0 (effective 256) wrapping.
   * Returns the number of ZC/TO events.
   */
  private _advanceCounterByFires(fires: number): number {
    if (fires <= 0) return 0;

    let zcToCount = 0;
    let count = this._count;
    const tc = this._timeConstantReg;
    const effectiveTc = tc === 0 ? 256 : tc;

    // --- Handle the special case where count is already 0
    if (count === 0) {
      if (!this._countZeroD) {
        // Pending ZC/TO (count just reached 0, edge not yet seen)
        zcToCount++;
        count = tc; // reload
        if (tc === 0) {
          // Reloaded to 0; first fire decrements 0→255
          if (fires > 0) { count = 255; fires--; }
          else { this._count = 0; this._countZeroD = true; return zcToCount; }
        }
      } else {
        // count=0 with countZeroD=true (post-ZC/TO for TC=0): next fire → 255
        count = 255;
        fires--;
      }
    }

    if (fires <= 0) {
      this._count = count;
      this._countZeroD = false;
      return zcToCount;
    }

    // --- Normal countdown: count > 0, fires > 0
    if (fires < count) {
      // Not enough fires to reach zero
      this._count = count - fires;
      this._countZeroD = false;
      return zcToCount;
    }

    // Fires >= count: counter reaches 0
    fires -= count;
    zcToCount++; // ZC/TO for reaching 0

    // Full reload periods
    if (fires > 0) {
      const fullPeriods = (fires / effectiveTc) | 0;
      zcToCount += fullPeriods;
      fires -= fullPeriods * effectiveTc;
    }

    // After the last ZC/TO, counter reloads to tc
    if (fires === 0) {
      this._count = tc;
      // For TC=0, count=0 with countZeroD=true (ZC/TO already fired)
      this._countZeroD = (tc === 0);
      return zcToCount;
    }

    // Remaining fires after last reload
    if (tc === 0) {
      // Reloaded to 0, first fire→255, then count down
      this._count = 256 - fires; // = 255 - (fires-1)
    } else {
      this._count = tc - fires;
    }
    this._countZeroD = false;
    return zcToCount;
  }

  /**
   * Read the current counter value (port read)
   */
  readPort(): number {
    return this._count;
  }

}

/**
 * Z80 CTC device for the ZX Spectrum Next.
 *
 * Implements 4 CTC channels (only 4 are used; channels 4-7 are hardwired to zero
 * in the FPGA). Each channel is independently programmable as a timer or counter.
 *
 * Port addresses: 0x183b (ch0), 0x193b (ch1), 0x1a3b (ch2), 0x1b3b (ch3)
 * Channel selected by address bits A10:A8.
 *
 * ZC/TO chaining (FPGA: ctc_zc_to(2 downto 0) & ctc_zc_to(3)):
 *   - Channel 0 triggered by Channel 3's ZC/TO
 *   - Channel 1 triggered by Channel 0's ZC/TO
 *   - Channel 2 triggered by Channel 1's ZC/TO
 *   - Channel 3 triggered by Channel 2's ZC/TO
 */
export class CtcDevice implements IGenericDevice<IZxNextMachine> {
  readonly channels: CtcChannel[] = [];

  // --- IM2 vector write flag (set for one cycle when vector byte is written)
  im2VectorWrite = false;

  // --- System clock tracking for lazy CTC advancement
  private _lastSyncClock = 0;

  constructor(public readonly machine: IZxNextMachine) {
    for (let i = 0; i < 4; i++) {
      this.channels.push(new CtcChannel());
    }
  }

  /**
   * Reset all channels
   */
  reset(): void {
    for (const ch of this.channels) {
      ch.hardReset();
    }
    this.im2VectorWrite = false;
    this._lastSyncClock = 0;
  }

  /**
   * Advance all CTC channels to the specified system clock using mathematical
   * batch computation. Handles ZC/TO chaining between channels.
   * Called from the machine on every tact increment and before port access.
   */
  advanceToSysClock(currentSysClock: number): void {
    const elapsed = currentSysClock - this._lastSyncClock;
    if (elapsed <= 0) return;
    this._lastSyncClock = currentSysClock;

    // --- Advance channels in chain order: 0 → 1 → 2 → 3
    // Timer-mode channels advance by system clocks; counter-mode channels
    // advance by the upstream ZC/TO count.
    // Chaining: Ch0←Ch3, Ch1←Ch0, Ch2←Ch1, Ch3←Ch2
    const zcToCounts = [0, 0, 0, 0];
    const triggerSrc = [3, 0, 1, 2]; // upstream channel index for each

    // First pass: advance timer-mode channels by system clocks
    for (let i = 0; i < 4; i++) {
      const ch = this.channels[i];
      if (ch.state === 3 /* RUNNING */ && !ch.isCounterMode) {
        zcToCounts[i] = ch.advanceBySysClocks(elapsed);
      }
    }

    // Second pass: advance counter-mode channels by upstream ZC/TO counts
    for (let i = 0; i < 4; i++) {
      const ch = this.channels[i];
      if (ch.state === 3 /* RUNNING */ && ch.isCounterMode) {
        zcToCounts[i] = ch.advanceByTriggers(zcToCounts[triggerSrc[i]]);
      }
    }

    // Set interrupt status for channels that generated ZC/TO events
    const intDev = this.machine.interruptDevice;
    for (let i = 0; i < 4; i++) {
      if (zcToCounts[i] > 0 && this.channels[i].intEnabled) {
        intDev.ctcIntStatus[i] = true;
      }
    }
  }

  /**
   * Clock all channels by one system tick (should be called at 28MHz rate).
   *
   * Handles ZC/TO chaining: ch3→ch0, ch0→ch1, ch1→ch2, ch2→ch3.
   * After clocking, sets interrupt status in InterruptDevice for any channel that fired ZC/TO.
   */
  clockTick(): void {
    // Get previous ZC/TO state for chaining (triggers are from previous cycle)
    const prevZcTo = [
      this.channels[0].zcTo,
      this.channels[1].zcTo,
      this.channels[2].zcTo,
      this.channels[3].zcTo
    ];

    // Clock all channels with chained triggers:
    // Channel 0 ← Channel 3's ZC/TO
    // Channel 1 ← Channel 0's ZC/TO
    // Channel 2 ← Channel 1's ZC/TO
    // Channel 3 ← Channel 2's ZC/TO
    this.channels[0].clock(false, 0, prevZcTo[3], false, false);
    this.channels[1].clock(false, 0, prevZcTo[0], false, false);
    this.channels[2].clock(false, 0, prevZcTo[1], false, false);
    this.channels[3].clock(false, 0, prevZcTo[2], false, false);

    // Set interrupt status for any ZC/TO that fired
    const intDev = this.machine.interruptDevice;
    for (let i = 0; i < 4; i++) {
      if (this.channels[i].zcTo) {
        intDev.ctcIntStatus[i] = true;
      }
    }
  }

  /**
   * Handle a port write to a CTC channel.
   * @param port - the full 16-bit port address
   * @param value - the byte being written
   */
  writePort(port: number, value: number): void {
    if (!this.machine.nextRegDevice.portZ80CtcEnabled) return;

    const ch = (port >> 8) & 0x07;
    if (ch >= 4) return; // channels 4-7 not implemented

    const channel = this.channels[ch];

    // Detect IM2 vector write: D0=0 AND channel is not expecting time constant
    // FPGA: o_im2_vector_wr <= i_port_ctc_wr and (not i_cpu_d(0)) and (not tmp_iowr_tc)
    if (!(value & 0x01) && !channel.expectingTimeConstant) {
      this.im2VectorWrite = true;
      // IM2 vector handling is done externally; we just flag it
      return;
    }

    // Sync CTC to current time before the write
    this._syncFromMachine();

    // Clock the channel with this write asserted for one cycle, then deasserted
    channel.clock(true, value, false, false, false);
    channel.clock(false, value, false, false, false);

    // Account for the 2 extra clock() calls so they aren't double-counted
    this._lastSyncClock += 2;
  }

  /**
   * Handle a port read from a CTC channel.
   * @param port - the full 16-bit port address
   * @returns current counter value, or 0xFF if CTC ports are disabled
   */
  readPort(port: number): number {
    if (!this.machine.nextRegDevice.portZ80CtcEnabled) return 0xff;

    const ch = (port >> 8) & 0x07;
    if (ch >= 4) return 0x00; // channels 4-7 hardwired to zero

    // Sync CTC to current time before reading
    this._syncFromMachine();

    return this.channels[ch].readPort();
  }

  /**
   * Write interrupt enable bits for all channels (called from NR $C5 write).
   * This must not overlap with port writes.
   */
  writeIntEnable(enables: boolean[]): void {
    for (let i = 0; i < 4; i++) {
      this.channels[i].clock(false, 0, false, true, enables[i]);
    }
  }

  /**
   * Sync the CTC to the machine's current system clock.
   * Called internally before port reads/writes.
   */
  private _syncFromMachine(): void {
    this.advanceToSysClock(this.machine.frameTacts);
  }
}
