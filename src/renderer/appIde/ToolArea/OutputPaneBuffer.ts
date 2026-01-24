import { LiteEvent } from "@emu/utils/lite-event";
import { IOutputBuffer, OutputColor, OutputContentLine, OutputSpan } from "./abstractions";
import { ILiteEvent } from "@abstractions/ILiteEvent";

type StyleState = {
  color?: OutputColor;
  bgColor?: OutputColor;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethru: boolean;
};

/**
 * Implements a simple buffer to write the contents of the output pane to
 */
export class OutputPaneBuffer implements IOutputBuffer {
  private _buffer: OutputContentLine[] = [];
  private _currentLineIndex: number = -1;
  private _color: OutputColor;
  private _bgColor: OutputColor;
  private _isBold: boolean = false;
  private _isItalic: boolean = false;
  private _isUnderline: boolean = false;
  private _isStrikethru: boolean = false;
  private _contentsChanged = new LiteEvent<void>();
  private _styleStack: StyleState[] = [];

  constructor(
    public readonly bufferedLines = 10240,
    public readonly maxLineLenght = 1024
  ) {}

  /**
   * Clears the contents of the buffer
   */
  clear(): void {
    this._buffer = [];
    this._currentLineIndex = -1;
    this._contentsChanged.fire();
  }

  /**
   * Gets the contents of the buffer
   */
  getContents(): OutputContentLine[] {
    return this._buffer;
  }

  /**
   * Sets the default color
   */
  resetStyle(): void {
    this._color = undefined;
    this._bgColor = undefined;
    this._isBold = false;
    this._isItalic = false;
    this._isStrikethru = false;
    this._isUnderline = false;
  }

  /**
   * Sets the output to the specified color
   * @param color
   */
  color(color: OutputColor): void {
    this._color = color;
  }

  /**
   * Sets the output background to the specified color
   */
  backgroundColor(bgcolor: OutputColor): void {
    this._bgColor = bgcolor;
  }

  /**
   * Indicates if the font is to be used in bold
   * @param use
   */
  bold(use: boolean): void {
    this._isBold = use;
  }

  /**
   * Indicates if the font is to be used in italic
   * @param use
   */
  italic(use: boolean): void {
    this._isItalic = use;
  }

  /**
   * Indicates if the font is to be used with underline
   * @param use
   */
  underline(use: boolean): void {
    this._isUnderline = use;
  }

  /**
   * Indicates if the font is to be used with strikethru
   * @param use
   */
  strikethru(use: boolean): void {
    this._isStrikethru = use;
  }

  /**
   * Writes a new entry to the output
   * @param message Message to write
   * @param data Optional item data
   * @param actionable Actionable text?
   */
  write(message: string, data?: unknown, actionable?: boolean): void {
    if (this._currentLineIndex < 0) {
      this._currentLineIndex = 0;
      this._buffer[0] = { spans: [] };
    }

    const newSpan: OutputSpan = {
      text: message.replaceAll(" ", "\xa0"),
      foreground: this._color,
      background: this._bgColor,
      isBold: this._isBold,
      isItalic: this._isItalic,
      isUnderline: this._isUnderline || actionable,
      isStrikeThru: this._isStrikethru,
      actionable,
      data
    };

    this._buffer[this._currentLineIndex].spans.push(newSpan);
    this._contentsChanged.fire();
  }

  /**
   * Writes a message and adds a new output line
   * @param message Message to write
   * @param data Optional item data
   * @param actionable Actionable text?
   */
  writeLine(message?: string, data?: unknown, actionable?: boolean): void {
    if (message) {
      this.write(message, data, actionable);
    } else {
      this.pushStyle();
      this.resetStyle();
      this.write("\xa0", data, actionable);
      this.popStyle();
    }
    if (this._currentLineIndex >= this.bufferedLines) {
      this._buffer.shift();
    } else {
      this._currentLineIndex++;
    }
    this._buffer[this._currentLineIndex] = { spans: [] };
  }

  /**
   * Splits a message into multiple lines and adds them to the output
   * @param message Message to write
   */
  writeLines(message: string): void {
    const lines = message.split("\n");
    for (const line of lines) {
      this.writeLine(line);
    }
  }

  /**
   * This event fires when the contents of the buffer changes.
   */
  get contentsChanged(): ILiteEvent<void> {
    return this._contentsChanged;
  }

  /**
   * Gets the string representation of the buffer
   */
  getBufferText(): string {
    let result = "";
    this._buffer.forEach((l) => {
      l.spans.forEach((s) => (result += s.text));
      result += "\n";
    });
    return result;
  }

  /**
   * Saves the current style state
   */
  pushStyle(): void {
    this._styleStack.push({
      color: this._color,
      bgColor: this._bgColor,
      isBold: this._isBold,
      isItalic: this._isItalic,
      isUnderline: this._isUnderline,
      isStrikethru: this._isStrikethru
    });
  }

  /**
   * Restores the style state
   */
  popStyle(): void {
    if (this._styleStack.length === 0) {
      return;
    }
    const state = this._styleStack.pop();
    this._color = state.color;
    this._bgColor = state.bgColor;
    this._isBold = state.isBold;
    this._isItalic = state.isItalic;
    this._isUnderline = state.isUnderline;
    this._isStrikethru = state.isStrikethru;
  }
}
