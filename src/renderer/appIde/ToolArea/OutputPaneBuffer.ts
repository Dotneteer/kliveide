import { LiteEvent } from "@emu/utils/lite-event";
import { IOutputBuffer, OutputColor, OutputContentLine, OutputSpan } from "./abstractions";
import { ILiteEvent } from "@abstractions/ILiteEvent";
import { internStyle } from "./output-style-table";

type StyleState = {
  color?: OutputColor;
  bgColor?: OutputColor;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethru: boolean;
};

/** Appended in place of the remainder of a line that exceeded `maxLineLength`. */
export const TRUNCATION_NOTICE = " …[line truncated]";

/**
 * How far past `bufferedLines` the buffer is allowed to grow before it is trimmed.
 *
 * The previous code did `shift()` once per line for every line past the cap — an O(n) memmove of up
 * to 10,240 entries, per line, forever. Trimming a block at a time amortises that to O(n / slack)
 * per line while keeping the code obviously correct, which a head-index ring buffer would not.
 */
const TRIM_SLACK = 256;

/**
 * Schedules a coalesced flush.
 *
 * `requestAnimationFrame` where there is one, so a burst of writes spread over several IPC messages
 * still lands as a single repaint. Node has none — the buffer's own tests run in the `node` project
 * — so it falls back to a macrotask, which coalesces a synchronous burst just as well.
 */
const scheduleFlush: (fn: () => void) => void =
  typeof requestAnimationFrame === "function"
    ? (fn) => {
        requestAnimationFrame(fn);
      }
    : (fn) => {
        setTimeout(fn, 0);
      };

/**
 * Implements a simple buffer to write the contents of the output pane to
 */
export class OutputPaneBuffer implements IOutputBuffer {
  private _buffer: OutputContentLine[] = [];
  private _color: OutputColor;
  private _bgColor: OutputColor;
  private _isBold: boolean = false;
  private _isItalic: boolean = false;
  private _isUnderline: boolean = false;
  private _isStrikethru: boolean = false;
  private _contentsChanged = new LiteEvent<void>();
  private _styleStack: StyleState[] = [];

  /** Bumped by every content change, whether or not a notification has fired yet. */
  private _revision = 0;
  private _flushScheduled = false;

  /** `getContents()` result, rebuilt only when the revision it was taken at goes stale. */
  private _snapshot: OutputContentLine[] = [];
  private _snapshotRevision = -1;

  /** Length of the current line's text so far, and whether it has already been cut off. */
  private _currentLineLength = 0;
  private _currentLineTruncated = false;

  constructor(
    public readonly bufferedLines = 10240,
    public readonly maxLineLength = 1024
  ) {}

  /**
   * A counter that increases on every content change.
   *
   * Because `contentsChanged` is coalesced, a consumer cannot use "did the event fire" to decide
   * whether it has seen the latest content. The revision can be compared instead, and it is what
   * makes the `getContents()` snapshot safe to hand out.
   */
  get revision(): number {
    return this._revision;
  }

  /**
   * Clears the contents of the buffer
   */
  clear(): void {
    this._buffer = [];
    this._currentLineLength = 0;
    this._currentLineTruncated = false;
    this.contentChanged();
  }

  /**
   * Gets the contents of the buffer
   *
   * The result is a **stable snapshot**: the same array instance is returned until the contents
   * actually change, and a new one after. Consumers used to defensively `.slice()` the live
   * internal array on every change event, which made a burst of N writes cost N copies of a buffer
   * that grows toward `bufferedLines`.
   */
  getContents(): OutputContentLine[] {
    if (this._snapshotRevision !== this._revision) {
      /*
       * The last line is the one `write()` is still appending to. While nothing has been written to
       * it, it is the cursor position rather than content, and including it renders a phantom blank
       * row at the end of every pane. An *explicitly* blank line — `writeLine()` with no message —
       * is not this case: it has already been left behind by a following line.
       */
      const lineCount = this._buffer.length;
      const end =
        lineCount > 0 && this._buffer[lineCount - 1].spans.length === 0 ? lineCount - 1 : lineCount;
      this._snapshot = this._buffer.slice(0, end);
      this._snapshotRevision = this._revision;
    }
    return this._snapshot;
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
    if (this._buffer.length === 0) {
      this._buffer.push({ spans: [] });
    }

    // --- Everything after the cut on an over-long line is dropped, silently: the notice was
    // --- already appended by the write that hit the limit.
    if (this._currentLineTruncated) return;

    /*
     * Spaces stay spaces.
     *
     * This used to be `message.replaceAll(" ", "\xa0")`, to stop HTML collapsing runs of
     * whitespace — which `white-space: pre` in the stylesheet now handles properly. The
     * substitution reached further than the display: `getBufferText()` reads these strings, so
     * every "Copy to clipboard" produced text whose spaces were U+00A0 and pasted into a shell or
     * an editor as invisible non-breaking spaces. It also only held alignment while the monospace
     * face resolved, NBSP not being guaranteed to share the space advance in a fallback font.
     */
    let text = message;
    let cutHere = false;
    const room = this.maxLineLength - this._currentLineLength;
    if (text.length > room) {
      text = text.slice(0, Math.max(0, room));
      cutHere = true;
    }

    const spans = this._buffer[this._buffer.length - 1].spans;
    spans.push(this.makeSpan(text, this._isUnderline || !!actionable, actionable, data));
    this._currentLineLength += text.length;

    if (cutHere) {
      /*
       * The cut is announced rather than silent. An unenforced `maxLineLenght` (sic) meant a
       * runaway `write()` was stored verbatim; enforcing it without saying so would instead lose
       * output with no trace of why it went missing.
       */
      spans.push(this.makeSpan(TRUNCATION_NOTICE, false));
      this._currentLineTruncated = true;
    }

    this.contentChanged();
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
    } else if (this._buffer.length === 0) {
      // --- An explicitly blank first line still needs a line to be blank.
      this._buffer.push({ spans: [] });
    }

    this._buffer.push({ spans: [] });
    this._currentLineLength = 0;
    this._currentLineTruncated = false;

    /*
     * Trim in blocks rather than one `shift()` per line. See `TRIM_SLACK`.
     */
    if (this._buffer.length > this.bufferedLines + TRIM_SLACK) {
      this._buffer.splice(0, this._buffer.length - this.bufferedLines);
    }

    this.contentChanged();
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
   *
   * **Coalesced.** It used to fire once per `write()` — that is once per *styled run*, not per line
   * — synchronously, with the subscriber answering each one with an O(n) copy and a React commit.
   * Writing N runs therefore cost N copies and N commits: a 64K disassembly is ~80,000 of them.
   * Now a burst of writes produces one notification, on the next frame.
   *
   * Reads are not delayed by this. `getContents()` and `revision` are always current; only the
   * notification is batched.
   */
  get contentsChanged(): ILiteEvent<void> {
    return this._contentsChanged;
  }

  /**
   * Fires any pending change notification immediately.
   *
   * For tests, and for callers that must observe the effect of a write before yielding to the event
   * loop. Does nothing when no flush is pending.
   */
  flushChanges(): void {
    if (!this._flushScheduled) return;
    this._flushScheduled = false;
    this._contentsChanged.fire();
  }

  /**
   * Gets the string representation of the buffer
   */
  getBufferText(): string {
    /*
     * Reads the same snapshot the renderer draws, so "Copy to clipboard" yields exactly the lines
     * on screen. Walking the raw buffer instead — as this used to — included the trailing line the
     * cursor sits on, and so ended every copy with a blank line that was never displayed.
     */
    let result = "";
    this.getContents().forEach((l) => {
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

  /**
   * Builds a span carrying the current style, plus the id the renderer memoises its CSS against.
   *
   * The truncation notice passes `underline: false` and no data, so it interns as its own plain
   * style rather than inheriting the colour of the line it is cutting short.
   */
  private makeSpan(
    text: string,
    isUnderline: boolean,
    actionable?: boolean,
    data?: unknown
  ): OutputSpan {
    const isNotice = !actionable && data === undefined && text === TRUNCATION_NOTICE;
    const style = {
      foreground: isNotice ? undefined : this._color,
      background: isNotice ? undefined : this._bgColor,
      isBold: isNotice ? false : this._isBold,
      isItalic: isNotice ? false : this._isItalic,
      isUnderline,
      isStrikeThru: isNotice ? false : this._isStrikethru
    };
    return { text, ...style, styleId: internStyle(style), actionable, data };
  }

  /** Records a content change and schedules a single notification for the whole burst. */
  private contentChanged(): void {
    this._revision++;
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    scheduleFlush(() => {
      if (!this._flushScheduled) return;
      this._flushScheduled = false;
      this._contentsChanged.fire();
    });
  }
}
