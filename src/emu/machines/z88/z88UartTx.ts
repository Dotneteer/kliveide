/**
 * Turns the bytes the Z88 writes to its serial port's TXD register ($E3) into lines of text for the
 * IDE's output, as OZvm echoes them to its runtime message panel. Klive emulates no serial line; this
 * is a debugging aid - OZ debug builds and programs print diagnostics through the serial port.
 *
 * A CR, an LF or a CR LF pair ends a line; other control bytes are dropped, and bytes above $7E are
 * shown as `\xNN`. A line that grows past `maxLineLength` is broken there.
 */
export class Z88UartTxLines {
  private current = "";
  private lastWasCr = false;

  constructor(private readonly maxLineLength = 256) {}

  /**
   * Adds bytes; returns the lines they completed.
   * @param bytes The bytes written to TXD, in order
   */
  push(bytes: ArrayLike<number>): string[] {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i] & 0xff;
      if (byte === 0x0a && this.lastWasCr) {
        // --- The LF of a CR LF pair: the CR already ended the line
        this.lastWasCr = false;
        continue;
      }
      this.lastWasCr = byte === 0x0d;
      if (byte === 0x0d || byte === 0x0a) {
        lines.push(this.current);
        this.current = "";
        continue;
      }
      if (byte < 0x20) continue;
      this.current += byte <= 0x7e ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, "0")}`;
      if (this.current.length >= this.maxLineLength) {
        lines.push(this.current);
        this.current = "";
      }
    }
    return lines;
  }

  /** The text of the line not yet ended */
  get pending(): string {
    return this.current;
  }

  /** Forgets the line not yet ended */
  clear(): void {
    this.current = "";
    this.lastWasCr = false;
  }
}
