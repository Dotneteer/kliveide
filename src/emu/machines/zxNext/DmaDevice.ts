import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/*
 * zxnDMA / Z80 DMA of the ZX Spectrum Next, after `_input/next-fpga/src/device/dma.vhd` (the FPGA's DMA,
 * "loosely based on the Zilog Z80C10 - there are differences") and its wiring in `zxnext.vhd`.
 *
 * - Clock: the CPU clock (`clk_i => i_CLK_CPU`). A byte is a read cycle then a write cycle of 2/3/4
 *   clocks each (the port timing bytes, "01" = 3 after reset): 6 CPU clocks by default at every speed.
 *   At 28 MHz a memory read outside bank 7 takes one wait state (`sram_wait_n`); an SPI data port
 *   ($EB) access waits for the SPI master (`spi_wait_n`, 16 CPU clocks).
 * - Mode: `dma_mode` is the port of the last access - $0B makes it a Z80 DMA, $6B a zxnDMA. It decides
 *   the byte counter's start value at LOAD, CONTINUE and auto restart: 0 (zxnDMA) or $FFFF (Z80 DMA).
 *   The transfer continues while counter < block length after each byte, so a zxnDMA moves `length`
 *   bytes, a Z80 DMA `length` + 1, and length 0 moves one byte in both modes.
 * - Prescaler (WR2's second timing byte): `DMA_timer_s` counts 28 MHz time (+8/4/2/1 per CPU clock) from
 *   each byte's first clock; after the write the DMA waits while prescaler > timer / 32. Burst mode gives
 *   the bus back while it waits; the other modes keep it. Byte mode is not implemented: it behaves as
 *   continuous. Search, interrupts, mask/match and CE/WAIT are not implemented either.
 * - `im2_dma_delay`: while an interrupt enabled for the DMA in `$CC`-`$CE` is pending or in service,
 *   the DMA gives the bus back at its next byte boundary and does not ask for it again.
 * - Status byte "00" & end_of_block_n & "1101" & at_least_one; `at_least_one` is cleared whenever the
 *   DMA is idle. Reads follow the read mask: status, counter lo/hi, port A lo/hi, port B lo/hi.
 *
 * The machine runs the DMA before every instruction (`ZxNextMachine.runDmaUntilCpuCanRun`): `stepDma`
 * asks for the bus, the machine grants it at once, and each step returns the 28 MHz clocks the DMA
 * held the bus for. The WASM core (`wasm/zxnext/zxnext-dma.c`) is a line-by-line port of this file.
 */

/** The port a DMA access came through (`dma_mode`). */
export const enum DmaMode {
  /** Port $6B. */
  ZXNDMA = 0,
  /** Port $0B. */
  LEGACY = 1
}

/** The transfer state machine, one state per stretch of `dma_seq_s` the emulation can stop in. */
export const enum DmaSeq {
  /** IDLE */
  IDLE = 0,
  /** START_DMA / WAITING_ACK: needs the bus. */
  START = 1,
  /** Holds the bus; the next clock is TRANSFERING_READ_1. */
  TRANSFER = 2,
  /** WAITING_CYCLES in burst mode: the bus is free until `readyAt`. */
  BURST_WAIT = 3
}

/** reg_wr_seq_s: which follow byte the next write is. */
const enum WrSeq {
  IDLE = 0,
  R0_BYTE_0,
  R0_BYTE_1,
  R0_BYTE_2,
  R0_BYTE_3,
  R1_BYTE_0,
  R1_BYTE_1,
  R2_BYTE_0,
  R2_BYTE_1,
  R3_BYTE_0,
  R3_BYTE_1,
  R4_BYTE_0,
  R4_BYTE_1,
  /** WR4 announced its interrupt control byte without a port B address: no handler, every write is lost. */
  R4_BYTE_2,
  R6_BYTE_0
}

/** reg_rd_seq_s, numbered as the read mask bits. */
const enum RdSeq {
  STATUS = 0,
  COUNTER_LO = 1,
  COUNTER_HI = 2,
  PORT_A_LO = 3,
  PORT_A_HI = 4,
  PORT_B_LO = 5,
  PORT_B_HI = 6
}

/** Address modes (WR1/WR2 D5-D4). */
const ADDR_DECREMENT = 0;
const ADDR_INCREMENT = 1;

/** Transfer modes (WR4 D6-D5). */
const MODE_BURST = 2;

const SPI_DATA_PORT = 0xeb;
const SPI_WAIT_CLOCKS = 16;

export class DmaDevice implements IGenericDevice<IZxNextMachine> {
  // --- dma_mode (zxnext.vhd)
  private _mode = DmaMode.ZXNDMA;

  // --- WR0 - WR6
  private _dirAtoB = true;
  private _portAStart = 0;
  private _blockLength = 0;
  private _portAIsIo = false;
  private _portAAddrMode = ADDR_INCREMENT;
  private _portATiming = 1;
  private _portBIsIo = false;
  private _portBAddrMode = ADDR_INCREMENT;
  private _portBTiming = 1;
  private _prescaler = 0;
  private _transferMode = 1;
  private _portBStart = 0;
  private _autoRestart = false;
  private _readMask = 0x7f;

  // --- Transfer state
  private _src = 0;
  private _dest = 0;
  private _counter = 0;
  private _endOfBlockN = true;
  private _atLeastOne = false;
  private _seq = DmaSeq.IDLE;
  private _readyAt = 0;

  // --- Bus
  private _busRequested = false;
  private _busAcknowledged = false;

  // --- Register sequencers
  private _wrSeq = WrSeq.IDLE;
  private _regTemp = 0;
  private _rdSeq = RdSeq.STATUS;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  /** `reset_i`: what the VHDL resets; start addresses, length, direction and address modes stay. */
  reset(): void {
    this._mode = DmaMode.ZXNDMA;
    this._seq = DmaSeq.IDLE;
    this._counter = 0;
    this._busRequested = false;
    this._busAcknowledged = false;
    this._wrSeq = WrSeq.IDLE;
    this._portATiming = 1;
    this._portBTiming = 1;
    this._prescaler = 0;
    this._transferMode = 1;
    this._autoRestart = false;
    this._readMask = 0x7f;
    this._atLeastOne = false;
    this._endOfBlockN = true;
    this._rdSeq = RdSeq.STATUS;
    this._readyAt = 0;
  }

  dispose(): void {}

  // ==========================================================================================
  // Machine interface

  /** The port handlers call this before every access ($6B: ZXNDMA, $0B: LEGACY). */
  setDmaMode(mode: DmaMode): void {
    this._mode = mode;
  }

  getDmaMode(): DmaMode {
    return this._mode;
  }

  getDmaSeq(): DmaSeq {
    return this._seq;
  }

  /** The DMA raises no interrupts (dma.vhd has none); kept for the machine's INT check. */
  getIp(): number {
    return 0;
  }

  getBusControl(): Readonly<{ busRequested: boolean; busAcknowledged: boolean }> {
    return { busRequested: this._busRequested, busAcknowledged: this._busAcknowledged };
  }

  acknowledgeBus(): void {
    if (this._busRequested) this._busAcknowledged = true;
  }

  // ==========================================================================================
  // Register writes (dma.vhd reg_wr_seq_s)

  writePort(value: number): void {
    const d = value & 0xff;
    switch (this._wrSeq) {
      case WrSeq.IDLE:
        this.writeBase(d);
        return;
      case WrSeq.R0_BYTE_0:
        this._portAStart = (this._portAStart & 0xff00) | d;
        this._wrSeq = this._regTemp & 0x10 ? WrSeq.R0_BYTE_1 : this._regTemp & 0x20 ? WrSeq.R0_BYTE_2 : this._regTemp & 0x40 ? WrSeq.R0_BYTE_3 : WrSeq.IDLE;
        return;
      case WrSeq.R0_BYTE_1:
        this._portAStart = (this._portAStart & 0x00ff) | (d << 8);
        this._wrSeq = this._regTemp & 0x20 ? WrSeq.R0_BYTE_2 : this._regTemp & 0x40 ? WrSeq.R0_BYTE_3 : WrSeq.IDLE;
        return;
      case WrSeq.R0_BYTE_2:
        this._blockLength = (this._blockLength & 0xff00) | d;
        this._wrSeq = this._regTemp & 0x40 ? WrSeq.R0_BYTE_3 : WrSeq.IDLE;
        return;
      case WrSeq.R0_BYTE_3:
        this._blockLength = (this._blockLength & 0x00ff) | (d << 8);
        this._wrSeq = WrSeq.IDLE;
        return;
      case WrSeq.R1_BYTE_0:
        this._portATiming = d & 0x03;
        this._wrSeq = d & 0x20 ? WrSeq.R1_BYTE_1 : WrSeq.IDLE;
        return;
      case WrSeq.R1_BYTE_1: // --- port A has no prescaler: the byte is swallowed
        this._wrSeq = WrSeq.IDLE;
        return;
      case WrSeq.R2_BYTE_0:
        this._portBTiming = d & 0x03;
        this._wrSeq = d & 0x20 ? WrSeq.R2_BYTE_1 : WrSeq.IDLE;
        return;
      case WrSeq.R2_BYTE_1:
        this._prescaler = d;
        this._wrSeq = WrSeq.IDLE;
        return;
      case WrSeq.R3_BYTE_0: // --- mask: not implemented
        this._wrSeq = this._regTemp & 0x10 ? WrSeq.R3_BYTE_1 : WrSeq.IDLE;
        return;
      case WrSeq.R3_BYTE_1: // --- match: not implemented
        this._wrSeq = WrSeq.IDLE;
        return;
      case WrSeq.R4_BYTE_0:
        this._portBStart = (this._portBStart & 0xff00) | d;
        this._wrSeq = this._regTemp & 0x08 ? WrSeq.R4_BYTE_1 : WrSeq.IDLE;
        return;
      case WrSeq.R4_BYTE_1:
        this._portBStart = (this._portBStart & 0x00ff) | (d << 8);
        this._wrSeq = WrSeq.IDLE;
        return;
      case WrSeq.R6_BYTE_0:
        this._readMask = d;
        this._rdSeq = this.firstReadEntry();
        this._wrSeq = WrSeq.IDLE;
        return;
      default: // --- R4_BYTE_2 (`when others => null`): deaf until reset
        return;
    }
  }

  /** A base byte: WR0 - WR6 decoded as in the IDLE branch of dma.vhd. */
  private writeBase(d: number): void {
    if ((d & 0x80) === 0) {
      if (d & 0x03) {
        // --- WR0
        this._regTemp = d;
        this._dirAtoB = (d & 0x04) !== 0;
        this._wrSeq = d & 0x08 ? WrSeq.R0_BYTE_0 : d & 0x10 ? WrSeq.R0_BYTE_1 : d & 0x20 ? WrSeq.R0_BYTE_2 : d & 0x40 ? WrSeq.R0_BYTE_3 : WrSeq.IDLE;
      } else if ((d & 0x07) === 0x04) {
        // --- WR1
        this._regTemp = d;
        this._portAIsIo = (d & 0x08) !== 0;
        this._portAAddrMode = (d >> 4) & 0x03;
        this._wrSeq = d & 0x40 ? WrSeq.R1_BYTE_0 : WrSeq.IDLE;
      } else if ((d & 0x07) === 0x00) {
        // --- WR2
        this._regTemp = d;
        this._portBIsIo = (d & 0x08) !== 0;
        this._portBAddrMode = (d >> 4) & 0x03;
        this._wrSeq = d & 0x40 ? WrSeq.R2_BYTE_0 : WrSeq.IDLE;
      }
      return;
    }
    switch (d & 0x03) {
      case 0x00: // --- WR3
        this._regTemp = d;
        if (d & 0x40) this._seq = DmaSeq.START;
        this._wrSeq = d & 0x08 ? WrSeq.R3_BYTE_0 : d & 0x10 ? WrSeq.R3_BYTE_1 : WrSeq.IDLE;
        return;
      case 0x01: // --- WR4
        this._regTemp = d;
        this._transferMode = (d >> 5) & 0x03;
        this._wrSeq = d & 0x04 ? WrSeq.R4_BYTE_0 : d & 0x08 ? WrSeq.R4_BYTE_1 : d & 0x10 ? WrSeq.R4_BYTE_2 : WrSeq.IDLE;
        return;
      case 0x02: // --- WR5 (D7-D6 = 10, D2-D0 = 010)
        if ((d & 0xc7) === 0x82) {
          this._regTemp = d;
          this._autoRestart = (d & 0x20) !== 0;
          this._wrSeq = WrSeq.IDLE;
        }
        return;
      default: // --- WR6
        this._regTemp = d;
        this._wrSeq = WrSeq.IDLE;
        this.command(d);
    }
  }

  private command(d: number): void {
    switch (d) {
      case 0xc3: // --- reset
        this.goIdle();
        this._endOfBlockN = true;
        this._portATiming = 1;
        this._portBTiming = 1;
        this._prescaler = 0;
        this._autoRestart = false;
        break;
      case 0xc7:
        this._portATiming = 1;
        break;
      case 0xcb:
        this._portBTiming = 1;
        break;
      case 0xcf: // --- load
        this._endOfBlockN = true;
        this.loadAddresses();
        this._counter = this.counterStart();
        break;
      case 0xd3: // --- continue
        this._endOfBlockN = true;
        this._counter = this.counterStart();
        break;
      case 0xbf:
        this._rdSeq = RdSeq.STATUS;
        break;
      case 0x8b:
        this._endOfBlockN = true;
        this._atLeastOne = false;
        break;
      case 0xa7:
        this._rdSeq = this.firstReadEntry();
        break;
      case 0x87:
        this._seq = DmaSeq.START;
        break;
      case 0x83:
        this.goIdle();
        break;
      case 0xbb:
        this._wrSeq = WrSeq.R6_BYTE_0;
        break;
      default: // --- $AF, $AB, $A3, $B7, $B3 and the rest: nothing
        break;
    }
  }

  private loadAddresses(): void {
    this._src = this._dirAtoB ? this._portAStart : this._portBStart;
    this._dest = this._dirAtoB ? this._portBStart : this._portAStart;
  }

  private counterStart(): number {
    return this._mode === DmaMode.LEGACY ? 0xffff : 0;
  }

  /** IDLE: the bus goes back and `status_atleastone` is cleared. */
  private goIdle(): void {
    this._seq = DmaSeq.IDLE;
    this._atLeastOne = false;
    this._busRequested = false;
    this._busAcknowledged = false;
  }

  // ==========================================================================================
  // Read sequence

  /** Status or the next read-mask entry (dma.vhd reg_rd_seq_s). */
  readStatusByte(): number {
    let value: number;
    switch (this._rdSeq) {
      case RdSeq.STATUS:
        value = 0x1a | (this._endOfBlockN ? 0x20 : 0) | (this._atLeastOne ? 0x01 : 0);
        break;
      case RdSeq.COUNTER_LO:
        value = this._counter & 0xff;
        break;
      case RdSeq.COUNTER_HI:
        value = this._counter >> 8;
        break;
      case RdSeq.PORT_A_LO:
        value = (this._dirAtoB ? this._src : this._dest) & 0xff;
        break;
      case RdSeq.PORT_A_HI:
        value = (this._dirAtoB ? this._src : this._dest) >> 8;
        break;
      case RdSeq.PORT_B_LO:
        value = (this._dirAtoB ? this._dest : this._src) & 0xff;
        break;
      default:
        value = (this._dirAtoB ? this._dest : this._src) >> 8;
        break;
    }
    this._rdSeq = this.nextReadEntry(this._rdSeq);
    return value;
  }

  /** The first entry enabled in the mask, or the status. */
  private firstReadEntry(): RdSeq {
    for (let i = 0; i < 7; i++) if (this._readMask & (1 << i)) return i as RdSeq;
    return RdSeq.STATUS;
  }

  /** The next enabled entry after `from`, cyclically; the status when none is. */
  private nextReadEntry(from: RdSeq): RdSeq {
    for (let k = 1; k <= 7; k++) {
      const i = (from + k) % 7;
      if (this._readMask & (1 << i)) return i as RdSeq;
    }
    return RdSeq.STATUS;
  }

  // ==========================================================================================
  // Transfer

  /**
   * Advances the transfer. Returns the 28 MHz clocks the DMA held the bus for (0 when it is waiting,
   * idle, or needs the bus - `getBusControl().busRequested` says which).
   */
  stepDma(): number {
    switch (this._seq) {
      case DmaSeq.START:
        if (this.delayed()) {
          this._busRequested = false;
          this._busAcknowledged = false;
          return 0;
        }
        if (!this._busAcknowledged) {
          this._busRequested = true;
          return 0;
        }
        // --- START_DMA, WAITING_ACK
        this._seq = DmaSeq.TRANSFER;
        return 2 * this.clockScale();
      case DmaSeq.TRANSFER:
        return this.transferByte();
      case DmaSeq.BURST_WAIT:
        if (this.sysTact() < this._readyAt) return 0;
        if (this._counter < this._blockLength) {
          this._seq = DmaSeq.START;
          this._busRequested = true;
          this._busAcknowledged = false;
        } else {
          this.finish(false);
        }
        return 0;
      default:
        return 0;
    }
  }

  /** One byte from TRANSFERING_READ_1 to the state after TRANSFERING_WRITE_4. */
  private transferByte(): number {
    const srcIsA = this._dirAtoB;
    const srcIo = srcIsA ? this._portAIsIo : this._portBIsIo;
    const destIo = srcIsA ? this._portBIsIo : this._portAIsIo;
    const scale = this.clockScale();

    // --- read cycle
    const value = srcIo ? this.machine.portManager.readPort(this._src) : this.machine.memoryDevice.readMemory(this._src);
    let clocks = cycleClocks(srcIsA ? this._portATiming : this._portBTiming);
    if (srcIo) {
      if ((this._src & 0xff) === SPI_DATA_PORT) clocks += SPI_WAIT_CLOCKS;
    } else if (scale === 1 && this.machine.memoryDevice.bank8kLookup[(this._src >> 13) & 0x07] !== 0x0e) {
      clocks += 1; // --- sram_wait_n at 28 MHz
    }

    // --- write cycle
    if (destIo) this.machine.portManager.writePort(this._dest, value);
    else this.machine.memoryDevice.writeMemory(this._dest, value);
    clocks += cycleClocks(srcIsA ? this._portBTiming : this._portATiming);
    if (destIo && (this._dest & 0xff) === SPI_DATA_PORT) clocks += SPI_WAIT_CLOCKS;

    // --- TRANSFERING_WRITE_1: counter and addresses
    this._counter = (this._counter + 1) & 0xffff;
    this._src = step(this._src, srcIsA ? this._portAAddrMode : this._portBAddrMode);
    this._dest = step(this._dest, srcIsA ? this._portBAddrMode : this._portAAddrMode);
    this._atLeastOne = true;

    // --- TRANSFERING_WRITE_4: the timer has counted `clocks - 1` CPU clocks in 28 MHz units
    const more = this._counter < this._blockLength;
    if (this._prescaler > 0 && this._prescaler > ((clocks - 1) * scale) >> 5) {
      // --- WAITING_CYCLES until timer / 32 >= prescaler
      const exitClock = Math.ceil((32 * this._prescaler) / scale);
      if (this._transferMode === MODE_BURST) {
        // --- the bus is free while it waits
        this._seq = DmaSeq.BURST_WAIT;
        this._busRequested = false;
        this._busAcknowledged = false;
        // --- the machine charges this byte's clocks after the step: the wait ends `exitClock + 1`
        // --- clocks after the byte's first one
        this._readyAt = this.sysTact() + (exitClock + 1) * scale;
        return clocks * scale;
      }
      // --- held: WAITING_CYCLES, then WAITING_ACK (more) or FINISH_DMA
      const held = exitClock + 2;
      if (!more) return held * scale + this.finish(true);
      return held * scale;
    }
    if (more) {
      if (this.delayed()) {
        this._seq = DmaSeq.START;
        this._busRequested = false;
        this._busAcknowledged = false;
      }
      return clocks * scale;
    }
    // --- FINISH_DMA
    return (clocks + 1) * scale + this.finish(true);
  }

  /**
   * FINISH_DMA: end of block; auto restart reloads and goes on - keeping the bus when it has it
   * (WAITING_ACK, one more clock) - otherwise the DMA goes idle. Returns the extra clocks held.
   */
  private finish(busHeld: boolean): number {
    this._endOfBlockN = false;
    if (!this._autoRestart) {
      this.goIdle();
      return 0;
    }
    this.loadAddresses();
    this._counter = this.counterStart();
    if (busHeld) {
      this._seq = DmaSeq.TRANSFER;
      return this.clockScale();
    }
    this._seq = DmaSeq.START;
    this._busRequested = true;
    this._busAcknowledged = false;
    return 0;
  }

  /** `im2_dma_delay`: an interrupt enabled for the DMA is pending or in service. */
  private delayed(): boolean {
    return this.machine.interruptDevice.dmaInterruptRequestActive;
  }

  /** 28 MHz clocks per CPU clock (and the timer's increment): 8 / 4 / 2 / 1. */
  private clockScale(): number {
    return 8 >> (this.machine.cpuSpeedDevice.effectiveSpeed & 0x03);
  }

  private sysTact(): number {
    return this.machine.frames * this.machine.tactsInFrame + this.machine.frameTacts;
  }
}

/** Timing byte D1-D0: 00 and 11 = 4 clocks, 01 = 3, 10 = 2. */
function cycleClocks(timing: number): number {
  return timing === 1 ? 3 : timing === 2 ? 2 : 4;
}

function step(address: number, mode: number): number {
  if (mode === ADDR_INCREMENT) return (address + 1) & 0xffff;
  if (mode === ADDR_DECREMENT) return (address - 1) & 0xffff;
  return address;
}
