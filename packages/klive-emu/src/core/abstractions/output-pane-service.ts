import { ILiteEvent } from "@core/LiteEvent";

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
  getContents(): string[];

  /**
   * Sets the default color
   */
  resetColor(): void;

  /**
   * Sets the output to the specified color
   * @param color
   */
  color(color: OutputColor): void;

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
   */
  write(message: string): void;

  /**
   * Writes a message and adds a new output line
   * @param message
   */
  writeLine(message?: string): void;

  /**
   * This event fires when the contents of the buffer changes.
   */
  readonly contentsChanged: ILiteEvent<void>;
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
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any>;

  /**
   * Sets the state of the side bar
   * @param state Optional state to set
   * @param fireImmediate Fire a panelStateLoaded event immediately?
   */
  setPanelState(state: Record<string, any> | null): void;

  /**
   * Gets the buffer of the pane
   */
  get buffer(): IOutputBuffer;
}

/**
 * The service that manages output panes
 */
export interface IOutputPaneService {
  /**
   * Registers a new output pane
   * @param pane Pane descriptor
   */
  registerOutputPane(pane: IOutputPane): void;

  /**
   * Gets the current set of output panes
   * @returns
   */
  getOutputPanes(): IOutputPane[];

  /**
   * Gets the active output pane
   */
  getActivePane(): IOutputPane | null;

  /**
   * Sets the active output pane
   * @param pane
   */
  setActivePane(pane: IOutputPane): void;

  /**
   * Clears the active pane
   */
  clearActivePane(): void;

  /**
   * Gets a pane by its ID
   * @param id Gets the pane with the specified id
   */
  getPaneById(id: string | number): IOutputPane | undefined;

  /**
   * Fires when the list of output panes changed
   */
  get panesChanged(): ILiteEvent<IOutputPane[]>;

  /**
   * Fires when the active pane is about to change.
   */
  get activePaneChanging(): ILiteEvent<void>;

  /**
   * Fires when the active pane has changed.
   */
  get activePaneChanged(): ILiteEvent<IOutputPane>;

  /**
   * Fires when the contents of any of the output panes changes.
   * The event argument is the pane with changed contents
   */
  get paneContentsChanged(): ILiteEvent<IOutputPane>;
}
