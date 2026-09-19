import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export enum CopperStartMode {
  FullyStopped = 0,
  StartFromZeroAndLoop = 1,
  StartFromLastPointAndLoop = 2,
  StartFromZeroRestartOnPositionReached = 3
}

export class CopperDevice implements IGenericDevice<IZxNextMachine> {
  /**
   * Returns a snapshot of the copper's internal state for IDE diagnostics.
   */
  getState(): CopperDeviceState {
    return {
      startMode: this._startMode,
      instructionAddress: this._copperListAddr,
      listData: this._copperListData,
      dout: this._copperDout,
      verticalLineOffset: this.verticalLineOffset,
      memory: new Uint8Array(this._memory)
    };
  }
  private readonly _memory: Uint8Array = new Uint8Array(0x800);
  private _startMode: CopperStartMode;
  private _instructionAddress: number;
  private _storedByte: number;

  // --- Execution state (Step 1) ---
  /** Current instruction pointer into the 1024-entry (10-bit) list */
  _copperListAddr: number;
  /** Last fetched 16-bit instruction word */
  _copperListData: number;
  /** copper.vhd `copper_dout_s`: set for the tick after a MOVE fetch */
  _copperDout: boolean;
  /** copper.vhd `copper_data_o`: the register and value of the last MOVE fetched */
  private _copperData: number;
  /** copper.vhd `last_state_s`: the mode the copper last acted on */
  private _lastMode: CopperStartMode;
  /** zxnext.vhd `copper_requester_d`, `copper_req` and its latched register / value */
  private _doutDelayed: boolean;
  private _req: boolean;
  private _reqData: number;

  /** NextReg $64 as written. */
  private _verticalLineOffset = 0;
  /**
   * zxula_timing.vhd ~457-468: `cvc` is a counter loaded with $64 only at the first active line
   * (`ula_min_vactive`, at `hc_ula` 0) and counted on from there, so a $64 write takes effect at the
   * next such reload. `offsetBeforeReload` is the offset `cvc` carries from the frame start up to this
   * frame's reload, `offsetAfterReload` the one it is loaded with there.
   */
  offsetBeforeReload = 0;
  offsetAfterReload = 0;

  get verticalLineOffset(): number {
    return this._verticalLineOffset;
  }

  set verticalLineOffset(value: number) {
    this._verticalLineOffset = value & 0xff;
    // --- A write before this frame's reload is what the reload loads
    if (this.machine.currentFrameTact < this.machine.composedScreenDevice.cvcReloadTact) {
      this.offsetAfterReload = this._verticalLineOffset;
    }
  }

  /** A new frame: `cvc` carries the last loaded offset until this frame's reload loads $64 again. */
  onNewFrame(): void {
    this.offsetBeforeReload = this.offsetAfterReload;
    this.offsetAfterReload = this._verticalLineOffset;
  }

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._startMode = CopperStartMode.FullyStopped;
    this._instructionAddress = 0;
    this._storedByte = 0;
    this._verticalLineOffset = 0;
    this.offsetBeforeReload = 0;
    this.offsetAfterReload = 0;
    this._copperListAddr = 0;
    this._copperListData = 0;
    this._copperDout = false;
    this._copperData = 0;
    this._lastMode = CopperStartMode.FullyStopped;
    this._doutDelayed = false;
    this._req = false;
    this._reqData = 0;
  }

  /**
   * False when a tick would change nothing: stopped, the stop already seen, and no NextReg write left
   * in the pipeline. The machine skips the copper then.
   */
  get isActive(): boolean {
    return (
      this._startMode !== CopperStartMode.FullyStopped ||
      this._lastMode !== this._startMode ||
      this._copperDout ||
      this._doutDelayed ||
      this._req
    );
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
    // --- zxnext.vhd: a $60 write at an even address also stores the byte a $63 write commits as MSB
    if ((this._instructionAddress & 0x0001) === 0) this._storedByte = value & 0xff;
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

  /**
   * zxnext.vhd ~5406: the register only stores the mode and address bits 10-8. The copper acts on a
   * mode change at its next tick (copper.vhd `last_state_s`, see executeTick) - so rewriting the same
   * mode restarts nothing, and a MOVE to $62 from the copper itself lets the MOVE after it out.
   */
  set nextReg62Value(value: number) {
    this._instructionAddress = ((value & 0x07) << 8) | (this._instructionAddress & 0xff);
    this._startMode = (value & 0xc0) >> 6;
  }

  set nextReg63Value(value: number) {
    if (this._instructionAddress & 0x0001) {
      this._memory[this._instructionAddress & 0x7fe] = this._storedByte;
      this._memory[this._instructionAddress] = value;
    } else {
      // --- zxnext.vhd: the byte is stored only at an even address
      this._storedByte = value;
    }
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
   * The vertical position this device compares against is **not** the raw ULA vertical
   * counter. `zxnext.vhd` wires the copper's `vcount_i` to `cvc`, the copper-offset
   * vertical counter produced by `zxula_timing.vhd`, and `copper.vhd` itself has no
   * offset input at all. This method mirrors that split: it consumes an already-rebased
   * copper line and performs no offset arithmetic of its own. Use
   * `NextComposedScreenDevice.vcToCopperLine()` to produce the value.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.5.
   *
   * @param cvc Current copper vertical line (hardware `cvc`, already rebased)
   * @param hc Current horizontal counter
   */
  executeTick(cvc: number, hc: number): void {
    // --- zxnext.vhd ~4689-4714, on this edge, from the values before it: copper_req (latched on the
    // --- previous edge) makes the NextReg write; a rising copper_dout latches the next request.
    const write = this._req;
    const writeData = this._reqData;
    this._req = this._copperDout && !this._doutDelayed;
    if (this._req) this._reqData = this._copperData;
    this._doutDelayed = this._copperDout;

    // --- copper.vhd, on the same edge, with the mode before the write above
    const mode = this._startMode;
    if (this._lastMode !== mode) {
      this._lastMode = mode;
      if (
        mode === CopperStartMode.StartFromZeroAndLoop ||
        mode === CopperStartMode.StartFromZeroRestartOnPositionReached
      ) {
        this._copperListAddr = 0;
      }
      this._copperDout = false;
    } else if (mode === CopperStartMode.StartFromZeroRestartOnPositionReached && cvc === 0 && hc === 0) {
      // --- restart at frame start
      this._copperListAddr = 0;
      this._copperDout = false;
    } else if (mode !== CopperStartMode.FullyStopped) {
      if (this._copperDout) {
        // --- the tick after a MOVE only clears the output
        this._copperDout = false;
      } else {
        // --- the list RAM is read on the falling edge: the word at the current address is here
        this._copperListData =
          (this._memory[this._copperListAddr * 2] << 8) | this._memory[this._copperListAddr * 2 + 1];
        if (this._copperListData & 0x8000) {
          // --- WAIT 1 HHHHHH LLLLLLLLL: cvc = line and hc_ula >= H * 8 + 12
          const waitLine = this._copperListData & 0x1ff;
          const waitHC = ((this._copperListData >> 9) & 0x3f) * 8 + 12;
          if (cvc === waitLine && hc >= waitHC) {
            this._copperListAddr = (this._copperListAddr + 1) & 0x3ff;
          }
        } else {
          // --- MOVE 0 RRRRRRR VVVVVVVV; register 0 is a NOP: no output pulse
          this._copperData = this._copperListData & 0x7fff;
          if (this._copperData & 0x7f00) this._copperDout = true;
          this._copperListAddr = (this._copperListAddr + 1) & 0x3ff;
        }
      }
    } else {
      this._copperDout = false;
    }

    // --- the NextReg process writes on this edge: the copper saw the old register values
    if (write) this.machine.nextRegDevice.directSetRegValue((writeData >> 8) & 0x7f, writeData & 0xff);
  }
}

// ---------------------------------------------------------------------------
// State snapshot (Step 11)
// ---------------------------------------------------------------------------

export type CopperDeviceState = {
  /** Current start/mode control value (0–3) */
  startMode: CopperStartMode;
  /** Instruction pointer into the 1024-entry list (0–0x3FF) */
  instructionAddress: number;
  /** Last fetched 16-bit instruction word */
  listData: number;
  /** True when a MOVE output is pending for the next tick */
  dout: boolean;
  /** Vertical line offset applied to beam-position comparisons */
  verticalLineOffset: number;
  /** Full 2 KB instruction-memory snapshot */
  memory: Uint8Array;
};
