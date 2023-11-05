import { ILiteEvent } from "@emu/utils/lite-event";

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
  foreGround?: OutputColor;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikeThru?: boolean;
  actionable?: boolean;
  data?: unknown;
}

/**
 * Represents a single line of the output pane's content
 */
export type OutputContentLine = {
  spans: OutputSpan[];
};

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
   * This event fires when the contents of the buffer changes.
   */
  readonly contentsChanged: ILiteEvent<void>;

  /**
   * Gets the string representation of the buffer
   */
  getBufferText(): string;
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
