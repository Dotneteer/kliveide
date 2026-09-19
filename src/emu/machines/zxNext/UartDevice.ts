import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { Clock28 } from "./Clock28";
import {
  DAISY_PRIORITY_UART0_RX,
  DAISY_PRIORITY_UART0_TX,
  DAISY_PRIORITY_UART1_RX,
  DAISY_PRIORITY_UART1_TX
} from "./InterruptDevice";

/*
 * The two UARTs of the ZX Spectrum Next (serial/uart.vhd, uart_tx.vhd, uart_rx.vhd, fifop.vhd), with the
 * serial lines modelled a byte (a frame) at a time on the 28 MHz clock. UART 0 is wired to the ESP
 * Wi-Fi module, UART 1 to the Pi GPIO; the emulator has neither, so the RX line is driven by a *peer*
 * (`peerSend`, `peerBreak`, `peerSetCts`, `peerSetLoopback`) and what the Next transmits is collected in
 * `peerOutput`. The WASM core (zxnext-uart.c) implements the same model.
 *
 * Ports (zxnext.vhd ~2595, uart register = A9-A8): $143B RX byte / prescaler LSB write, $153B select,
 * $163B frame, $133B status / TX byte write.
 */

const RX_FIFO_SIZE = 512; // fifop DEPTH_BITS 9
const TX_FIFO_SIZE = 64; // fifop DEPTH_BITS 6
const RX_NEAR_FULL = 384; // fifop o_full_near: stored(9) or (stored(8) and stored(7))
const RX_ALMOST_FULL = 510; // fifop o_full_almost: full - 2
const DEFAULT_PRESCALER_LSB = 243; // "00000011110011": 115200 baud at 28 MHz
const DEFAULT_FRAME = 0x18; // 8N1
const PEER_OUTPUT_KEPT = 4096; // the peer keeps the last this many transmitted bytes

const FRAME_RESET = 0x80;
const FRAME_BREAK = 0x40;
const FRAME_FLOW_CONTROL = 0x20;

/** What the peer puts on the Next's RX line: a byte, a byte with a bad parity or stop bit, or a break. */
export type UartPeerFrameKind = "byte" | "parity" | "framing";

type PeerSegment = {
  kind: UartPeerFrameKind | "break";
  value: number;
  // --- Set when the segment starts on the line
  start: number;
  /** When the receiver finishes the frame (mid stop bit): the byte or the error is known. */
  availAt: number;
  availDone: boolean;
  /** When the line is free for the next segment. A break ends when released (Infinity until then). */
  endAt: number;
  /** A break shows in the status once the receiver has shifted 8 zero bits in its error state. */
  breakAt: number;
  /** Garbled by a receiver reset (frame bit 7, machine reset): delivers nothing. */
  void: boolean;
};

/** The bits of a frame: start, 5-8 data (frame bits 4-3), parity (bit 2), 1 or 2 stop (bit 0). */
function frameBits(frame: number): number {
  return 1 + 5 + ((frame >> 3) & 0x03) + ((frame >> 2) & 0x01) + 1 + (frame & 0x01);
}

function dataMask(frame: number): number {
  return (1 << (5 + ((frame >> 3) & 0x03))) - 1;
}

export class UartChannel {
  // --- Configuration: the 17-bit prescaler (msb 2-0 & lsb 13-0) and the frame register
  prescalerLsb = DEFAULT_PRESCALER_LSB;
  prescalerMsb = 0;
  frame = DEFAULT_FRAME;

  // --- RX FIFO: 9-bit entries, bit 8 = the error flag latched with the byte
  readonly rxFifo = new Uint16Array(RX_FIFO_SIZE);
  rxHead = 0;
  rxCount = 0;
  /** uart0_rx_avail_d: a received byte waiting for room in a full FIFO (-1: none). */
  rxHeld = -1;
  errOverflow = false;
  errFraming = false;

  // --- TX FIFO and the transmitter
  readonly txFifo = new Uint8Array(TX_FIFO_SIZE);
  txHead = 0;
  txCount = 0;
  /** 0: S_IDLE, 1: S_RTR (waiting for CTS with the byte taken), 2: sending */
  txState = 0;
  txByte = 0;
  txEnd = 0;

  // --- The peer on the other end of the lines
  readonly peerQueue: Array<{ kind: UartPeerFrameKind | "break"; value: number }> = [];
  peerCurrent: PeerSegment | null = null;
  peerLineFreeAt = 0;
  peerCtsClear = true;
  peerLoopback = false;
  readonly peerOutput: number[] = [];

  // --- im2_peripheral int_req_d: the request levels last seen, for edge detection
  prevRxReq = false;
  prevTxReq = false;

  get prescaler(): number {
    return ((this.prescalerMsb & 0x07) << 14) | (this.prescalerLsb & 0x3fff);
  }

  /** One bit on the line in 28 MHz clocks (the timers reload with the prescaler; 0 and 1 act as 1). */
  get bitTicks(): number {
    return Math.max(this.prescaler, 1);
  }

  get txBusy(): boolean {
    return this.txState !== 0 || (this.frame & (FRAME_RESET | FRAME_BREAK)) !== 0;
  }

  /** o_Rx_rtr_n = 0: flow control off, or the FIFO has room for more than two bytes (and is not in reset). */
  get readyToReceive(): boolean {
    if (!(this.frame & FRAME_FLOW_CONTROL)) return true;
    return !(this.frame & FRAME_RESET) && this.rxCount < RX_ALMOST_FULL;
  }

  rxPush(value: number): void {
    this.rxFifo[(this.rxHead + this.rxCount) % RX_FIFO_SIZE] = value;
    this.rxCount++;
  }

  rxPop(): number {
    const value = this.rxFifo[this.rxHead];
    this.rxHead = (this.rxHead + 1) % RX_FIFO_SIZE;
    this.rxCount--;
    return value;
  }

  txPush(value: number): void {
    this.txFifo[(this.txHead + this.txCount) % TX_FIFO_SIZE] = value;
    this.txCount++;
  }

  txPop(): number {
    const value = this.txFifo[this.txHead];
    this.txHead = (this.txHead + 1) % TX_FIFO_SIZE;
    this.txCount--;
    return value;
  }

  /** uart0_fifo_reset: FIFOs empty, the error flags clear, the transmitter back to idle. */
  resetFifos(): void {
    this.rxHead = this.rxCount = 0;
    this.rxHeld = -1;
    this.errOverflow = this.errFraming = false;
    this.txHead = this.txCount = 0;
    this.txState = 0;
    if (this.peerCurrent) this.peerCurrent.void = true;
  }
}

/**
 * Dual UART device for the ZX Spectrum Next. The four ports address the UART selected by `$153B`
 * bit 6. Time is the machine's 28 MHz clock, advanced lazily (`sync`) before every port access,
 * interrupt check and interrupt status read.
 */
export class UartDevice implements IGenericDevice<IZxNextMachine> {
  readonly channels: [UartChannel, UartChannel] = [new UartChannel(), new UartChannel()];

  /** uart_select_r: 0 = UART 0 (ESP), 1 = UART 1 (Pi) */
  selectedUart = 0;

  private readonly _clock: Clock28;
  private _nextEvent = Infinity;

  constructor(public readonly machine: IZxNextMachine) {
    this._clock = new Clock28(machine);
  }

  /**
   * Soft reset (`i_reset`): select UART 0, empty the FIFOs, clear the errors, stop both state machines.
   * The prescaler and the frame register keep their values (their only reset is the core load).
   */
  reset(): void {
    const now = this._clock.now();
    this.selectedUart = 0;
    for (const ch of this.channels) {
      ch.resetFifos();
      ch.prevRxReq = ch.prevTxReq = false;
    }
    // --- im2_peripheral: int_req_d is 0 in reset, so the TX empty level is an edge right after it
    this.updateInterrupts();
    this.channels.forEach((_, i) => this.peerTryStart(i, now));
    this.updateNextEvent();
  }

  /** Power-on (a hard reset reloads the FPGA core): every register to its initial value, the peers too. */
  hardReset(): void {
    for (const ch of this.channels) {
      ch.prescalerLsb = DEFAULT_PRESCALER_LSB;
      ch.prescalerMsb = 0;
      ch.frame = DEFAULT_FRAME;
      ch.peerQueue.length = 0;
      ch.peerCurrent = null;
      ch.peerLineFreeAt = 0;
      ch.peerCtsClear = true;
      ch.peerLoopback = false;
      ch.peerOutput.length = 0;
    }
    this.reset();
  }

  dispose(): void {}

  private get activeChannel(): UartChannel {
    return this.channels[this.selectedUart];
  }

  // ==========================================================================
  // Time

  /** Brings both UARTs up to the machine's current 28 MHz clock. */
  sync(): number {
    const now = this._clock.now();
    if (now >= this._nextEvent) this.advanceTo(now);
    return now;
  }

  private updateNextEvent(): void {
    let next = Infinity;
    for (const ch of this.channels) {
      if (ch.txState === 2) next = Math.min(next, ch.txEnd);
      const cur = ch.peerCurrent;
      if (cur) next = Math.min(next, cur.availDone ? cur.endAt : cur.availAt);
    }
    this._nextEvent = next;
  }

  /** Processes the line events up to `target` in time order. */
  private advanceTo(target: number): void {
    while (true) {
      let at = Infinity;
      let which = -1;
      let what = 0; // 0: TX done, 1: RX frame received, 2: RX line free
      this.channels.forEach((ch, i) => {
        if (ch.txState === 2 && ch.txEnd < at) {
          at = ch.txEnd;
          which = i;
          what = 0;
        }
        const cur = ch.peerCurrent;
        if (cur && !cur.availDone && cur.availAt < at) {
          at = cur.availAt;
          which = i;
          what = 1;
        }
        if (cur && cur.availDone && cur.endAt < at) {
          at = cur.endAt;
          which = i;
          what = 2;
        }
      });
      if (which < 0 || at > target) break;
      const ch = this.channels[which];
      if (what === 0) {
        // --- The stop bit ends: the peer has the byte; the transmitter takes the next one
        const value = ch.txByte;
        ch.txState = 0;
        ch.peerOutput.push(value);
        if (ch.peerOutput.length > PEER_OUTPUT_KEPT) ch.peerOutput.splice(0, ch.peerOutput.length - PEER_OUTPUT_KEPT);
        if (ch.peerLoopback) this.rxReceive(which, value);
        this.txTryStart(which, at);
      } else if (what === 1) {
        this.peerFrameReceived(which, ch.peerCurrent!);
      } else {
        ch.peerCurrent = null;
        ch.peerLineFreeAt = at;
        this.peerTryStart(which, at);
      }
      this.updateInterrupts();
      this.updateNextEvent();
    }
    this.updateNextEvent();
  }

  // ==========================================================================
  // Transmitter (uart_tx.vhd)

  /** S_IDLE takes a byte when the FIFO has one and neither reset (bit 7) nor break (bit 6) holds it. */
  private txTryStart(index: number, at: number): void {
    const ch = this.channels[index];
    if (ch.txState !== 0 || ch.txCount === 0 || (ch.frame & (FRAME_RESET | FRAME_BREAK))) return;
    ch.txByte = ch.txPop() & dataMask(ch.frame);
    ch.txState = 1;
    this.txTrySend(index, at);
  }

  /** S_RTR -> S_START once CTS is clear or flow control is off; frame and prescaler are sampled now. */
  private txTrySend(index: number, at: number): void {
    const ch = this.channels[index];
    if (ch.txState !== 1) return;
    if (ch.frame & FRAME_FLOW_CONTROL && !ch.peerCtsClear) return;
    ch.txState = 2;
    ch.txEnd = at + frameBits(ch.frame) * ch.bitTicks;
  }

  // ==========================================================================
  // Receiver (uart_rx.vhd) and the RX FIFO

  /** The peer starts its next frame when the line is free and the Next is ready to receive. */
  private peerTryStart(index: number, at: number): void {
    const ch = this.channels[index];
    if (ch.peerCurrent || !ch.peerQueue.length || ch.peerLoopback || !ch.readyToReceive) return;
    const next = ch.peerQueue.shift()!;
    const start = Math.max(at, ch.peerLineFreeAt);
    const p = ch.bitTicks;
    const bits = frameBits(ch.frame);
    // --- uart_rx samples mid-bit: the stop bit (or the error) is known half a bit before the frame ends
    const availAt = start + bits * p - (p >> 1);
    ch.peerCurrent = {
      kind: next.kind,
      value: next.value,
      start,
      availAt,
      availDone: false,
      endAt: next.kind === "break" ? Infinity : start + bits * p,
      breakAt: availAt + 8 * p,
      void: !!(ch.frame & FRAME_RESET)
    };
  }

  private peerFrameReceived(index: number, cur: PeerSegment): void {
    const ch = this.channels[index];
    cur.availDone = true;
    if (cur.void || ch.frame & FRAME_RESET) return;
    const parityEnabled = (ch.frame & 0x04) !== 0;
    if (cur.kind === "byte" || (cur.kind === "parity" && !parityEnabled)) {
      this.rxReceive(index, cur.value & dataMask(ch.frame));
    } else {
      // --- A parity or stop-bit error throws the byte away and latches the framing error
      ch.errFraming = true;
    }
  }

  /** o_Rx_avail: into the FIFO, or held while it is full; a byte arriving while one is held overflows. */
  private rxReceive(index: number, value: number): void {
    const ch = this.channels[index];
    if (ch.frame & FRAME_RESET) return;
    if (ch.rxHeld >= 0) {
      ch.errOverflow = true;
      return;
    }
    const entry = value | (ch.errOverflow || ch.errFraming ? 0x100 : 0);
    if (ch.rxCount === RX_FIFO_SIZE) ch.rxHeld = entry;
    else ch.rxPush(entry);
  }

  /** o_err_break: the receiver sits in S_ERROR with 8 zero bits shifted in. */
  private breakActive(ch: UartChannel, now: number): boolean {
    const cur = ch.peerCurrent;
    return !!cur && cur.kind === "break" && !cur.void && !(ch.frame & FRAME_RESET) && now >= cur.breakAt && now < cur.endAt;
  }

  // ==========================================================================
  // Interrupts (zxnext.vhd ~1897: im2_int_req)

  /**
   * RX: near full, or available unless `$C6` asks for near full only; TX: the TX FIFO empty. A rising
   * level is an im2_peripheral request edge: it latches the status and, when enabled, interrupts.
   */
  updateInterrupts(): void {
    const id = this.machine.interruptDevice;
    if (!id) return;
    this.channels.forEach((ch, i) => {
      const nearFullOnly = i === 0 ? id.uart0RxNearFull : id.uart1RxNearFull;
      const rxEnabled = i === 0 ? id.uart0RxNearFull || id.uart0RxAvailable : id.uart1RxNearFull || id.uart1RxAvailable;
      const txEnabled = i === 0 ? id.uart0TxEmpty : id.uart1TxEmpty;
      const rxReq = ch.rxCount >= RX_NEAR_FULL || (ch.rxCount > 0 && !nearFullOnly);
      const txReq = ch.txCount === 0;
      if (rxReq && !ch.prevRxReq) id.request(i === 0 ? DAISY_PRIORITY_UART0_RX : DAISY_PRIORITY_UART1_RX, rxEnabled, true);
      if (txReq && !ch.prevTxReq) id.request(i === 0 ? DAISY_PRIORITY_UART0_TX : DAISY_PRIORITY_UART1_TX, txEnabled, true);
      ch.prevRxReq = rxReq;
      ch.prevTxReq = txReq;
    });
  }

  /** After a state change at `now`: the peers and transmitters may continue, the levels may rise. */
  private settle(now: number): void {
    this.channels.forEach((_, i) => {
      this.txTryStart(i, now);
      this.txTrySend(i, now);
      this.peerTryStart(i, now);
    });
    this.updateInterrupts();
    this.updateNextEvent();
  }

  // ==========================================================================
  // Port $133B: status read / TX byte write

  readTxPort(): number {
    const now = this.sync();
    const ch = this.activeChannel;
    const head = ch.rxCount ? ch.rxFifo[ch.rxHead] : 0;
    const status =
      (this.breakActive(ch, now) ? 0x80 : 0x00) |
      (ch.errFraming ? 0x40 : 0x00) |
      (head & 0x100 ? 0x20 : 0x00) |
      (ch.txCount === 0 && !ch.txBusy ? 0x10 : 0x00) |
      (ch.rxCount >= RX_NEAR_FULL ? 0x08 : 0x00) |
      (ch.errOverflow ? 0x04 : 0x00) |
      (ch.txCount === TX_FIFO_SIZE ? 0x02 : 0x00) |
      (ch.rxCount ? 0x01 : 0x00);
    // --- uart0_tx_rd_fe: the end of the status read clears the overflow and framing errors
    ch.errOverflow = ch.errFraming = false;
    return status;
  }

  writeTxPort(value: number): void {
    const now = this.sync();
    const ch = this.activeChannel;
    // --- The FIFO ignores writes while full or held in reset
    if (ch.frame & FRAME_RESET || ch.txCount === TX_FIFO_SIZE) return;
    ch.txPush(value & 0xff);
    this.updateInterrupts();
    this.settle(now);
  }

  // ==========================================================================
  // Port $143B: RX byte read / prescaler LSB write

  readRxPort(): number {
    const now = this.sync();
    const ch = this.activeChannel;
    if (!ch.rxCount) return 0x00;
    const value = ch.rxPop() & 0xff;
    if (ch.rxHeld >= 0) {
      ch.rxPush(ch.rxHeld);
      ch.rxHeld = -1;
    }
    this.settle(now);
    return value;
  }

  writeRxPort(value: number): void {
    this.sync();
    const ch = this.activeChannel;
    if (value & 0x80) ch.prescalerLsb = (ch.prescalerLsb & 0x007f) | ((value & 0x7f) << 7);
    else ch.prescalerLsb = (ch.prescalerLsb & 0x3f80) | (value & 0x7f);
  }

  // ==========================================================================
  // Port $153B: select

  /** "00000" & UART 0's prescaler MSB, or "01000" & UART 1's. */
  readSelectPort(): number {
    return (this.selectedUart << 6) | (this.activeChannel.prescalerMsb & 0x07);
  }

  /** Bit 6 selects; with bit 4 set, bits 2-0 go to the prescaler MSB of the UART bit 6 selects. */
  writeSelectPort(value: number): void {
    this.sync();
    this.selectedUart = (value >> 6) & 0x01;
    if (value & 0x10) this.channels[this.selectedUart].prescalerMsb = value & 0x07;
  }

  // ==========================================================================
  // Port $163B: frame

  readFramePort(): number {
    return this.activeChannel.frame;
  }

  /**
   * All eight bits are stored. Bit 7 holds the FIFOs and both state machines in reset for as long as
   * it is set; bit 6 holds the TX line in break; bit 5 enables hardware flow control.
   */
  writeFramePort(value: number): void {
    const now = this.sync();
    const ch = this.activeChannel;
    ch.frame = value & 0xff;
    if (ch.frame & FRAME_RESET) ch.resetFifos();
    this.settle(now);
  }

  // ==========================================================================
  // $C6 changes the RX request level (near full only or not)

  onInterruptEnableChanged(): void {
    this.sync();
    this.updateInterrupts();
  }

  // ==========================================================================
  // The peer: the device on the other end of the serial lines

  /** The peer sends frames on the Next's RX line, back to back at the Next's own baud rate and framing. */
  peerSend(channel: number, frames: Array<{ value: number; kind?: UartPeerFrameKind }>): void {
    const now = this.sync();
    const ch = this.channels[channel & 1];
    for (const f of frames) ch.peerQueue.push({ kind: f.kind ?? "byte", value: f.value & 0xff });
    this.settle(now);
  }

  /** The peer holds the RX line low (a break) after the frames already queued, or releases it. */
  peerBreak(channel: number, on: boolean): void {
    const now = this.sync();
    const ch = this.channels[channel & 1];
    if (on) {
      ch.peerQueue.push({ kind: "break", value: 0 });
    } else {
      const queued = ch.peerQueue.findIndex((f) => f.kind === "break");
      if (queued >= 0) ch.peerQueue.splice(queued, 1);
      const cur = ch.peerCurrent;
      // --- Modelled as at least one whole frame long: a shorter one would arrive as a byte of zeros
      if (cur?.kind === "break" && cur.endAt === Infinity) cur.endAt = Math.max(now, cur.availAt);
    }
    this.settle(now);
  }

  /** The peer's RTS, the Next's CTS: with flow control on, the transmitter waits while it is not clear. */
  peerSetCts(channel: number, clear: boolean): void {
    const now = this.sync();
    this.channels[channel & 1].peerCtsClear = clear;
    this.settle(now);
  }

  /** Wires the Next's TX line to its own RX line (the peer stops driving it). */
  peerSetLoopback(channel: number, on: boolean): void {
    const now = this.sync();
    this.channels[channel & 1].peerLoopback = on;
    this.settle(now);
  }

  /** The Next's RTR output as the peer sees it: true = ready to receive. */
  peerReadyToReceive(channel: number): boolean {
    this.sync();
    return this.channels[channel & 1].readyToReceive;
  }

  /** The bytes the Next has transmitted on this UART since power-on, complete frames only (the last 4096). */
  peerOutput(channel: number): number[] {
    this.sync();
    return [...this.channels[channel & 1].peerOutput];
  }
}
