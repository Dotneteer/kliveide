import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

const RX_FIFO_SIZE = 512;
const TX_FIFO_SIZE = 64;
const DEFAULT_PRESCALER = 243; // 115200 baud @ 28MHz
const DEFAULT_FRAME = 0x18; // 8N1

// --- FIFO with pointer-based circular buffer (matches FPGA fifop.vhd)
export class UartFifo {
  private readonly buffer: number[];
  private readPtr = 0;
  private writePtr = 0;
  private _count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  get count(): number {
    return this._count;
  }
  get isEmpty(): boolean {
    return this._count === 0;
  }
  get isFull(): boolean {
    return this._count === this.capacity;
  }
  // --- 3/4 capacity (matches FPGA near_full flag)
  get isNearFull(): boolean {
    return this._count >= (this.capacity * 3) >> 2;
  }

  push(value: number): boolean {
    if (this.isFull) return false;
    this.buffer[this.writePtr] = value;
    this.writePtr = (this.writePtr + 1) % this.capacity;
    this._count++;
    return true;
  }

  pop(): number {
    if (this.isEmpty) return 0;
    const value = this.buffer[this.readPtr];
    this.readPtr = (this.readPtr + 1) % this.capacity;
    this._count--;
    return value;
  }

  peek(): number {
    if (this.isEmpty) return 0;
    return this.buffer[this.readPtr];
  }

  clear(): void {
    this.readPtr = 0;
    this.writePtr = 0;
    this._count = 0;
  }
}

// --- Per-UART channel state (matches FPGA uart.vhd per-UART signals)
export class UartChannel {
  readonly rxFifo = new UartFifo(RX_FIFO_SIZE);
  readonly txFifo = new UartFifo(TX_FIFO_SIZE);

  // --- 17-bit prescaler: prescalerMsb(2:0) & prescalerLsb(13:0)
  prescalerLsb = DEFAULT_PRESCALER & 0x3fff;
  prescalerMsb = (DEFAULT_PRESCALER >> 14) & 0x07;

  // --- Frame register (default 0x18 = 8N1)
  // Bits: 6=break, 5=hw flow ctrl, 4:3=data bits, 2=parity en, 1=parity type, 0=stop bits
  frameRegister = DEFAULT_FRAME;

  // --- Status flags
  breakCondition = false;
  framingError = false;
  rxOverflow = false;

  reset(): void {
    this.rxFifo.clear();
    this.txFifo.clear();
    this.prescalerLsb = DEFAULT_PRESCALER & 0x3fff;
    this.prescalerMsb = (DEFAULT_PRESCALER >> 14) & 0x07;
    this.frameRegister = DEFAULT_FRAME;
    this.breakCondition = false;
    this.framingError = false;
    this.rxOverflow = false;
  }

  get prescaler(): number {
    return (this.prescalerMsb << 14) | this.prescalerLsb;
  }
}

/**
 * Dual UART device for the ZX Spectrum Next.
 *
 * Implements two independent UARTs (UART0 = ESP Wi-Fi, UART1 = Pi GPIO)
 * sharing four I/O port registers selected by port 0x153B bit 6.
 *
 * Port mapping (matches FPGA uart.vhd):
 *   0x143B — RX data read / Prescaler LSB write
 *   0x153B — UART select register (R/W)
 *   0x163B — Frame configuration (R/W)
 *   0x133B — TX data write / Status byte read
 *
 * RX FIFO: 512 entries (9-bit: 8 data + 1 error flag)
 * TX FIFO: 64 entries
 */
export class UartDevice implements IGenericDevice<IZxNextMachine> {
  readonly channels: [UartChannel, UartChannel] = [
    new UartChannel(),
    new UartChannel()
  ];

  // --- Select register state
  selectedUart = 0; // 0 = UART0 (ESP), 1 = UART1 (Pi)

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.channels[0].reset();
    this.channels[1].reset();
    this.selectedUart = 0;
  }

  dispose(): void {}

  private get activeChannel(): UartChannel {
    return this.channels[this.selectedUart];
  }

  // ==========================================================================
  // Port 0x133B: TX data write / Status byte read
  // ==========================================================================

  readTxPort(): number {
    const ch = this.activeChannel;

    // --- err_bit8: error flag on the next byte in RX FIFO (bit 8 of 9-bit entry)
    const errBit8 =
      !ch.rxFifo.isEmpty && (ch.rxFifo.peek() & 0x100) !== 0;

    // --- Status byte construction (matches FPGA uart.vhd)
    const status =
      (ch.breakCondition ? 0x80 : 0x00) |
      (ch.framingError ? 0x40 : 0x00) |
      (errBit8 ? 0x20 : 0x00) |
      (ch.txFifo.isEmpty ? 0x10 : 0x00) |
      (ch.rxFifo.isNearFull ? 0x08 : 0x00) |
      (ch.rxOverflow ? 0x04 : 0x00) |
      (ch.txFifo.isFull ? 0x02 : 0x00) |
      (!ch.rxFifo.isEmpty ? 0x01 : 0x00);

    // --- Clear-on-read flags (matches FPGA behavior)
    ch.framingError = false;
    ch.rxOverflow = false;

    return status;
  }

  writeTxPort(value: number): void {
    this.activeChannel.txFifo.push(value & 0xff);
  }

  // ==========================================================================
  // Port 0x143B: RX data read / Prescaler LSB write
  // ==========================================================================

  readRxPort(): number {
    const ch = this.activeChannel;
    if (ch.rxFifo.isEmpty) return 0x00;
    return ch.rxFifo.pop() & 0xff; // Strip error flag (bit 8)
  }

  writeRxPort(value: number): void {
    const ch = this.activeChannel;
    if (value & 0x80) {
      // --- bit 7 = 1: write upper 7 bits of prescaler LSB (bits 13:7)
      ch.prescalerLsb = (ch.prescalerLsb & 0x7f) | ((value & 0x7f) << 7);
    } else {
      // --- bit 7 = 0: write lower 7 bits of prescaler LSB (bits 6:0)
      ch.prescalerLsb = (ch.prescalerLsb & 0x3f80) | (value & 0x7f);
    }
  }

  // ==========================================================================
  // Port 0x153B: UART Select register
  // ==========================================================================

  readSelectPort(): number {
    const ch = this.activeChannel;
    // --- bit 7=0, bit 6=uart_select, bits 5:3=0, bits 2:0=prescaler MSB
    return (this.selectedUart << 6) | (ch.prescalerMsb & 0x07);
  }

  writeSelectPort(value: number): void {
    // --- Prescaler MSB write goes to CURRENT channel before switching
    // --- (matches FPGA: falling-edge latch uses old uart_select)
    if (value & 0x10) {
      this.activeChannel.prescalerMsb = value & 0x07;
    }
    // --- Then switch UART select
    this.selectedUart = (value >> 6) & 0x01;
  }

  // ==========================================================================
  // Port 0x163B: Frame register
  // ==========================================================================

  readFramePort(): number {
    // --- Returns bits 6:0, bit 7 always 0
    return this.activeChannel.frameRegister;
  }

  writeFramePort(value: number): void {
    const ch = this.activeChannel;
    if (value & 0x80) {
      // --- bit 7: reset TX/RX FSMs and empty FIFOs
      ch.rxFifo.clear();
      ch.txFifo.clear();
      ch.breakCondition = false;
      ch.framingError = false;
      ch.rxOverflow = false;
    }
    // --- Store bits 6:0 (bit 7 is action only, not stored)
    ch.frameRegister = value & 0x7f;
  }

  // ==========================================================================
  // External interface (for testing and future WebSocket/ESP/Pi integration)
  // ==========================================================================

  pushRxByte(channel: number, value: number, error = false): void {
    const ch = this.channels[channel & 1];
    const entry = (error ? 0x100 : 0x00) | (value & 0xff);
    if (!ch.rxFifo.push(entry)) {
      ch.rxOverflow = true;
    }
  }

  popTxByte(channel: number): number | undefined {
    const ch = this.channels[channel & 1];
    if (ch.txFifo.isEmpty) return undefined;
    return ch.txFifo.pop();
  }

  hasTxData(channel: number): boolean {
    return !this.channels[channel & 1].txFifo.isEmpty;
  }

  drainTxFifo(channel: number): void {
    this.channels[channel & 1].txFifo.clear();
  }

  setBreakCondition(channel: number, value: boolean): void {
    this.channels[channel & 1].breakCondition = value;
  }

  setFramingError(channel: number, value: boolean): void {
    this.channels[channel & 1].framingError = value;
  }

  onNewFrame(): void {
    // --- Auto-drain TX FIFOs to simulate serial transmit completion.
    // --- At typical baud rates (115200), a 64-byte FIFO drains in ~5.5ms,
    // --- well within a 20ms frame at 50Hz.
    this.channels[0].txFifo.clear();
    this.channels[1].txFifo.clear();
  }
}
