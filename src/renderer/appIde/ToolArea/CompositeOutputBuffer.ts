import { LiteEvent } from "@emu/utils/lite-event";
import { IOutputBuffer, OutputColor, OutputContentLine } from "./abstractions";
import { ILiteEvent } from "@abstractions/ILiteEvent";

/**
 * Implements a composite buffer to write the contents of the output pane to
 */
export class CompositeOutputBuffer implements IOutputBuffer {
  constructor (public readonly buffers: IOutputBuffer[]) {}

  resetStyle (): void {
    this.buffers.forEach(buffer => buffer.resetStyle());
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
  }

  writeLine (message?: string, data?: unknown, actionable?: boolean): void {
    this.buffers.forEach(buffer =>
      buffer.writeLine(message, data, actionable)
    );
  }

  writeLines(message: string): void {
    this.buffers.forEach(buffer => buffer.writeLines(message));
  }

  contentsChanged: ILiteEvent<void> = new LiteEvent<void>();

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
  }

  getContents (): OutputContentLine[] {
    return this.buffers.flatMap(buffer => buffer.getContents());
  }
}
