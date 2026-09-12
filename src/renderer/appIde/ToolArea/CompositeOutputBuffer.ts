import { LiteEvent } from "@emu/utils/lite-event";
import {
  IOutputBuffer,
  OutputColor,
  OutputContentLine,
  OutputSeverity
} from "./abstractions";
import { ILiteEvent } from "@abstractions/ILiteEvent";

/**
 * Implements a composite buffer to write the contents of the output pane to
 */
export class CompositeOutputBuffer implements IOutputBuffer {
  constructor (public readonly buffers: IOutputBuffer[]) {}

  resetStyle (): void {
    this.buffers.forEach(buffer => buffer.resetStyle());
  }

  severity (severity: OutputSeverity | undefined): void {
    this.buffers.forEach(buffer => buffer.severity(severity));
  }

  color (color: OutputColor): void {
    this.buffers.forEach(buffer => buffer.color(color));
  }

  backgroundColor (bgcolor: OutputColor): void {
    this.buffers.forEach(buffer => buffer.backgroundColor(bgcolor));
  }

  bold (use: boolean): void {
    this.buffers.forEach(buffer => buffer.bold(use));
  }

  italic (use: boolean): void {
    this.buffers.forEach(buffer => buffer.italic(use));
  }

  underline (use: boolean): void {
    this.buffers.forEach(buffer => buffer.underline(use));
  }

  strikethru (use: boolean): void {
    this.buffers.forEach(buffer => buffer.strikethru(use));
  }

  write (message: string, data?: unknown, actionable?: boolean): void {
    this.buffers.forEach(buffer => buffer.write(message, data, actionable));
    this.changed();
  }

  writeLine (message?: string, data?: unknown, actionable?: boolean): void {
    this.buffers.forEach(buffer =>
      buffer.writeLine(message, data, actionable)
    );
    this.changed();
  }

  writeLines(message: string): void {
    this.buffers.forEach(buffer => buffer.writeLines(message));
    this.changed();
  }

  /**
   * Fired by this buffer's own write methods.
   *
   * It used to be a bare `LiteEvent` that **nothing ever fired**, so a panel bound directly to a
   * composite never updated. It worked only by accident: composites are transient, and the pane
   * buffers underneath them fire their own events.
   *
   * Firing here rather than by subscribing to the children is deliberate. A composite wraps
   * long-lived pane buffers, so a subscription would keep the composite alive for as long as the
   * panes and would need a `dispose()` no caller has. A composite only exists to fan a write out,
   * so its own writes are exactly the changes it has to report.
   */
  private readonly _contentsChanged = new LiteEvent<void>();
  private _revision = 0;

  get contentsChanged(): ILiteEvent<void> {
    return this._contentsChanged;
  }

  get revision(): number {
    return this._revision;
  }

  flushChanges(): void {
    this.buffers.forEach((buffer) => buffer.flushChanges());
    this._contentsChanged.fire();
  }

  /** Fans an operation out to every child, then reports the change once. */
  private changed(): void {
    this._revision++;
    this._contentsChanged.fire();
  }

  getBufferText (): string {
    return this.buffers.map(buffer => buffer.getBufferText()).join("");
  }

  pushStyle (): void {
    this.buffers.forEach(buffer => buffer.pushStyle());
  }

  popStyle (): void {
    this.buffers.forEach(buffer => buffer.popStyle());
  }

  clear (): void {
    this.buffers.forEach(buffer => buffer.clear());
    this.changed();
  }

  getContents (): OutputContentLine[] {
    return this.buffers.flatMap(buffer => buffer.getContents());
  }
}
