import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export enum CopperStartMode {
  FullyStopped = 0,
  StartFromZeroAndLoop = 1,
  StartFromLastPointAndLoop = 2,
  StartFromZeroRestartOnPositionReached = 3
}

export class CopperDevice implements IGenericDevice<IZxNextMachine> {
  private readonly _memory: Uint8Array = new Uint8Array(0x800);
  private _startMode: CopperStartMode;
  private _instructionAddress: number;
  private _storedByte: number;

  // --- Execution state (Step 1) ---
  /** Current instruction pointer into the 1024-entry (10-bit) list */
  _copperListAddr: number;
  /** Last fetched 16-bit instruction word */
  _copperListData: number;
  /** True when a MOVE result is pending output on the next tick */
  _copperDout: boolean;

  verticalLineOffset: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._startMode = CopperStartMode.FullyStopped;
    this._instructionAddress = 0;
    this._storedByte = 0;
    this.verticalLineOffset = 0;
    this._copperListAddr = 0;
    this._copperListData = 0;
    this._copperDout = false;
  }

  readMemory(address: number): number {
    return this._memory[address];
  }

  get startMode(): CopperStartMode {
    return this._startMode;
  }

  get instructionAddress(): number {
    return this._instructionAddress;
  }

  setInstructionAddress(address: number): void {
    this._instructionAddress = address;
  }

  set nextReg60Value(value: number) {
    this._memory[this._instructionAddress] = value & 0xff;
    this._instructionAddress = (this._instructionAddress + 1) & 0x7ff;
  }

  get nextReg61Value(): number {
    return this._instructionAddress & 0xff;
  }

  set nextReg61Value(value: number) {
    this._instructionAddress = (this._instructionAddress & 0x700) | (value & 0xff);
  }

  get nextReg62Value(): number {
    return (this._startMode << 6) | ((this._instructionAddress & 0x700) >> 8);
  }

  set nextReg62Value(value: number) {
    const newMode: CopperStartMode = (value & 0xc0) >> 6;
    // Always update the instruction address MSB (independent of start control)
    this._instructionAddress = ((value & 0x07) << 8) | (this._instructionAddress & 0xff);
    // "Writing the same start control value does not reset the copper" (per nextreg spec)
    if (newMode !== this._startMode) {
      this._startMode = newMode;
      if (
        newMode === CopperStartMode.StartFromZeroAndLoop ||
        newMode === CopperStartMode.StartFromZeroRestartOnPositionReached
      ) {
        this._copperListAddr = 0;
      }
      this._copperDout = false;
    }
  }

  set nextReg63Value(value: number) {
    if (this._instructionAddress & 0x0001) {
      this._memory[this._instructionAddress & 0x7fe] = this._storedByte;
      this._memory[this._instructionAddress] = value;
    }
    this._storedByte = value;
    this._instructionAddress = (this._instructionAddress + 1) & 0x7ff;
  }

  /**
   * Execute one copper tick at the given beam position.
   * Called once per machine tact from ZxNextMachine.onTactIncremented().
   * Implements the FPGA per-clock model:
   *   - If dout is pending: emit the MOVE to NextReg, clear dout (one action per tick).
   *   - Else fetch the current instruction and process:
   *       MOVE (bit 15 == 0): set dout if non-NOP, advance list pointer.
   *       WAIT (bit 15 == 1): advance list pointer when beam position matches.
   *
   * @param vc Current vertical counter (screen line)
   * @param hc Current horizontal counter
   */
  executeTick(vc: number, hc: number): void {
    if (this._startMode === CopperStartMode.FullyStopped) return;

    // Frame-restart (mode 0b11): at position (vc=0, hc=0) reset the list and
    // skip execution for that tick — matches the FPGA elsif branch.
    if (
      this._startMode === CopperStartMode.StartFromZeroRestartOnPositionReached &&
      vc === 0 &&
      hc === 0
    ) {
      this._copperListAddr = 0;
      this._copperDout = false;
      return;
    }

    if (this._copperDout) {
      // Output the pending MOVE (registers above 0x7F are inaccessible to the copper)
      const reg = (this._copperListData >> 8) & 0x7f;
      const val = this._copperListData & 0xff;
      this.machine.nextRegDevice.directSetRegValue(reg, val);
      this._copperDout = false;
      return;
    }

    // Fetch the current instruction word (big-endian: even byte = high, odd byte = low)
    this._copperListData =
      (this._memory[this._copperListAddr * 2] << 8) |
      this._memory[this._copperListAddr * 2 + 1];

    if (this._copperListData & 0x8000) {
      // WAIT instruction: bit 15 == 1
      // Encoding: 1 HHHHHH LLLLLLLLL
      //   bits 14:9 = hc6  → target HC = hc6 * 8 + 12  (FPGA: hc6&"000" + 12)
      //   bits  8:0 = waitLine (9-bit vertical counter)
      const waitLine = this._copperListData & 0x1ff;
      const waitHC = ((this._copperListData >> 9) & 0x3f) * 8 + 12;
      if (vc === waitLine && hc >= waitHC) {
        this._copperListAddr = (this._copperListAddr + 1) % 0x400;
      }
      // If condition not met: stall — stay on this instruction.
      return;
    }

    // MOVE instruction: bit 15 == 0
    // Register is bits 14:8; value is bits 7:0.
    // NOP when register field == 0 (MOVE 0, 0) — advance pointer but don't write.
    const reg = (this._copperListData >> 8) & 0x7f;
    this._copperListAddr = (this._copperListAddr + 1) % 0x400;
    if (reg !== 0) {
      this._copperDout = true;
    }
  }
}
