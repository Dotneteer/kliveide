import { ILiteEvent, LiteEvent } from "@/emu/utils/lite-event";
import { IOutputBuffer, OutputColor, OutputContentLine, OutputSpan } from "./abstractions";

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
  
    constructor(
      public readonly bufferedLines = 1024,
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
    resetColor(): void {
      this._color = undefined;
      this._bgColor = undefined;
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
        text: message,
        foreGround: this._color,
        background: this._bgColor,
        isBold: this._isBold,
        isItalic: this._isItalic,
        isUnderline: this._isUnderline,
        isStrikeThru: this._isStrikethru,
        actionable,
        data
      }
  
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
      }
      if (this._currentLineIndex >= this.bufferedLines) {
        this._buffer.shift();
      } else {
        this._currentLineIndex++;
      }
      this._buffer[this._currentLineIndex] = { spans: [] };
    }

    /**
     * This event fires when the contents of the buffer changes.
     */
    get contentsChanged(): ILiteEvent<void> {
      return this._contentsChanged;
    }
  }