/**
 * This class represents the input stream of the Z80 Assembler
 */
export class InputStream {
  // --- Current stream position
  private _pos = 0;

  // --- Current line number
  private _line = 1;

  // --- Current column number
  private _column = 0;

  /**
   * Creates a stream that uses the specified source code
   * @param source Source code string
   */
  constructor(public readonly source: string) {}

  /**
   * Gets the specified part of the source code
   * @param start Start position
   * @param end End position
   */
  getSourceSpan(start: number, end: number): string {
    return this.source.substring(start, end);
  }

  /**
   * Gets the current position in the stream. Starts from 0.
   */
  get position(): number {
    return this._pos;
  }

  /**
   * Gets the current line number. Starts from 1.
   */
  get line(): number {
    return this._line;
  }

  /**
   * Gets the current column number. Starts from0.
   */
  get column(): number {
    return this._column;
  }

  /**
   * Peeks the next character in the stream
   * @returns null, if EOF; otherwise the current source code character
   */
  peek(): string | null {
    return this.ahead(0);
  }

  /**
   * Looks ahead with `n` characters in the stream.
   * @param n Number of positions to look ahead. Default: 1
   * @returns null, if EOF; otherwise the look-ahead character
   */
  ahead(n: number = 1): string | null {
    return this._pos + n > this.source.length - 1
      ? null
      : this.source[this._pos + n];
  }

  /**
   * Gets the next character from the stream
   */
  get(): string | null {
    // --- Check for EOF
    if (this._pos >= this.source.length) {
      return null;
    }

    // --- Get the char, and keep track of position
    const ch = this.source[this._pos++];
    if (ch === "\n") {
      this._line++;
      this._column = 0;
    } else {
      this._column++;
    }
    return ch;
  }
}
