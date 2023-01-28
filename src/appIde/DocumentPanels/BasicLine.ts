import { ILiteEvent, LiteEvent } from "@/emu/utils/lite-event";

/**
 * Available output colors
 */
export type SpectrumColor =
  | "black"
  | "blue"
  | "red"
  | "magenta"
  | "green"
  | "cyan"
  | "yellow"
  | "white";

/**
 * Represents a span within a line
 */
export type BasicLineSpan = {
  text: string;
  paper?: SpectrumColor;
  ink?: SpectrumColor;
  bright?: boolean;
  flash?: boolean;
  inverse?: boolean;
};

/**
 * Represents a single line of the output pane's content
 */
export type BasicLine = {
  spans: BasicLineSpan[];
};

/**
 * Implements a simple buffer to write the contents of the output pane to
 */
export class BasicProgramBuffer {
  private _buffer: BasicLine[] = [];
  private _currentLineIndex: number = -1;
  private _ink: SpectrumColor;
  private _paper: SpectrumColor;
  private _bright: boolean = false;
  private _flash: boolean = false;
  private _inverse: boolean = false;
  private _contentsChanged = new LiteEvent<void>();

  constructor (
    public readonly bufferedLines = 10240,
    public readonly maxLineLenght = 10240
  ) {}
  /**
   * Clears the contents of the buffer
   */
  clear (): void {
    this._buffer = [];
    this._currentLineIndex = -1;
    this._contentsChanged.fire();
  }

  /**
   * Gets the contents of the buffer
   */
  getContents (): BasicLine[] {
    return this._buffer;
  }

  /**
   * Sets the default color
   */
  resetColor (): void {
    this._ink = undefined;
    this._paper = undefined;
    this._bright = false;
    this._flash = false;
    this._inverse = false;
  }

  /**
   * Sets the ink to the specified color
   * @param color
   */
  ink (color: SpectrumColor): void {
    this._ink = color;
  }

  /**
   * Sets the output background to the specified color
   */
  paper (bgcolor: SpectrumColor): void {
    this._paper = bgcolor;
  }

  /**
   * Indicates the paper is bright
   * @param use
   */
  bright (use: boolean): void {
    this._bright = use;
  }

  /**
   * Indicates the character is flashing
   * @param use
   */
  flash (use: boolean): void {
    this._flash = use;
  }

  /**
   * Indicates the character is in inverse
   * @param use
   */
  inverse (use: boolean): void {
    this._inverse = use;
  }

  /**
   * Writes a new entry to the output
   * @param message Message to write
   */
  write (message: string): void {
    if (this._currentLineIndex < 0) {
      this._currentLineIndex = 0;
      this._buffer[0] = { spans: [] };
    }

    const newSpan: BasicLineSpan = {
      text: message.replaceAll(" ", "\xa0"),
      ink: this._ink,
      paper: this._paper,
      bright: this._bright,
      flash: this._flash,
      inverse: this._inverse
    };

    this._buffer[this._currentLineIndex].spans.push(newSpan);
    this._contentsChanged.fire();
  }

  /**
   * Writes a message and adds a new output line
   * @param message Message to write
   */
  writeLine (message?: string): void {
    if (message) {
      this.write(message);
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
  get contentsChanged (): ILiteEvent<void> {
    return this._contentsChanged;
  }

  /**
   * Gets the string representation of the buffer
   */
  getBufferText (): string {
    let result = "";
    this._buffer.forEach(l => {
      l.spans.forEach(s => (result += s.text));
      result += "\n";
    });
    return result;
  }
}

/**
 * Gets a word from the memory
 * @param memory Memory array
 * @param address Memory address
 */
export function getMemoryWord (memory: Uint8Array, address: number): number {
  const loByte = memory[address & 0xffff];
  const hiByte = memory[(address + 1) & 0xffff];
  return (hiByte << 8) + loByte;
}
