import { ILiteEvent } from "@abstractions/ILiteEvent";

/**
 * Available output colors
 */
export type OutputColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "bright-black"
  | "bright-red"
  | "bright-green"
  | "bright-yellow"
  | "bright-blue"
  | "bright-magenta"
  | "bright-cyan"
  | "bright-white";

export type OutputSpan = {
  text: string;
  background?: OutputColor;
  foreground?: OutputColor;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikeThru?: boolean;
  actionable?: boolean;
  data?: unknown;

  /**
   * Id of this span's style combination, from `output-style-table`.
   *
   * Resolved once at write time so the renderer can memoise the `CSSProperties` object it builds,
   * instead of allocating a fresh one per span per render. Optional because it is a rendering
   * optimisation, not part of the wire format: `OutputSpecification` crosses IPC without it, and a
   * span that arrives without one still paints correctly from its own fields.
   */
  styleId?: number;
};

/**
 * What a line of output *means*, as opposed to what colour it is painted.
 *
 * The buffer has always carried colour — `CompilerCommand` writes an error in `bright-red` and a
 * warning in `yellow` — and colour is not a substitute. It is chosen for contrast against a theme,
 * several unrelated things legitimately share one, and no panel can ask "which of these are errors"
 * of a hue. Marking, counting or filtering diagnostics needs the intent recorded separately, which
 * is what this is.
 *
 * Optional everywhere: most output is not a diagnostic, and a pane that never sets it behaves
 * exactly as it did before this existed.
 */
export type OutputSeverity = "error" | "warning" | "info";

export type OutputSpecification = OutputSpan & {
  pane: string;
  writeLine?: boolean;
  /** Severity for the line this span is written into. See `OutputSeverity`. */
  severity?: OutputSeverity;
};

/**
 * Represents a single line of the output pane's content
 */
export type OutputContentLine = {
  spans: OutputSpan[];

  /**
   * The severity of this line, when a writer declared one.
   *
   * On the line rather than on the span, because that is the unit it describes: a diagnostic is a
   * line assembled from several spans — a bold code, a message, a clickable file reference — and
   * all of them belong to the same error.
   */
  severity?: OutputSeverity;
};

/**
 * Represents an operation that can be performed on the buffer
  */
export type BufferOperation =
  | "clear"
  | "write"
  | "writeLine"
  | "resetStyle"
  | "color"
  | "backgroundColor"
  | "bold"
  | "italic"
  | "underline"
  | "strikethru"
  | "pushStyle"
  | "popStyle"
  | "severity";

/**
 * Represents a buffer for an output pane
 */
export interface IOutputBuffer {
  /**
   * Clears the contents of the buffer
   */
  clear(): void;

  /**
   * Gets the contents of the buffer
   */
  getContents(): OutputContentLine[];

  /**
   * Sets the default color
   */
  resetStyle(): void;

  /**
   * Marks the lines written from now on with a severity, until `resetStyle()` or another call.
   *
   * Shaped like the style setters below — sticky state applied at write time, saved and restored by
   * `pushStyle`/`popStyle`, cleared by `resetStyle` — because that is how every writer already
   * drives this buffer, and a diagnostic sets its severity in the same breath as its colour.
   *
   * @param severity The severity to mark, or `undefined` to stop marking.
   */
  severity(severity: OutputSeverity | undefined): void;

  /**
   * Sets the output to the specified color
   */
  color(color: OutputColor): void;

  /**
   * Sets the output background to the specified color
   */
  backgroundColor(bgcolor: OutputColor): void;

  /**
   * Indicates if the font is to be used in bold
   * @param use
   */
  bold(use: boolean): void;

  /**
   * Indicates if the font is to be used in italic
   * @param use
   */
  italic(use: boolean): void;

  /**
   * Indicates if the font is to be used with underline
   * @param use
   */
  underline(use: boolean): void;

  /**
   * Indicates if the font is to be used with strikethru
   * @param use
   */
  strikethru(use: boolean): void;

  /**
   * Writes a new entry to the output
   * @param message Message to write
   * @param data Optional item data
   * @param actionable Actionable text?
   */
  write(message: string, data?: unknown, actionable?: boolean): void;

  /**
   * Writes a message and adds a new output line
   * @param message Message to write
   * @param data Optional item data
   * @param actionable Actionable text?
   */
  writeLine(message?: string, data?: unknown, actionable?: boolean): void;

  /**
   * Splits a message into multiple lines and adds them to the output
   * @param message Message to write
   */
  writeLines(message: string): void;

  /**
   * This event fires when the contents of the buffer changes.
   *
   * **Coalesced**: a burst of writes produces one notification rather than one per styled run.
   * Compare `revision` when you need to know whether you have seen the latest content.
   */
  readonly contentsChanged: ILiteEvent<void>;

  /**
   * A counter that increases on every content change, whether or not a notification has fired yet.
   */
  readonly revision: number;

  /**
   * Fires any pending change notification immediately, instead of on the next frame.
   */
  flushChanges(): void;

  /**
   * Gets the string representation of the buffer
   */
  getBufferText(): string;

  /**
   * Saves the current style to the stack
   */
  pushStyle(): void;

  /**
   * Restores the style from the stack
   */
  popStyle(): void;
}

/**
 * Represents an output pane
 */
export interface IOutputPane {
  /**
   * The identifier of the pane
   */
  id: number | string;

  /**
   * The title of the panel
   */
  title: string;

  /**
   * Gets the buffer of the pane
   */
  readonly buffer: IOutputBuffer;

  /**
   * Responds to an action of a highlighted item
   * @param data
   */
  onContentLineAction(data: unknown): Promise<void>;
}
