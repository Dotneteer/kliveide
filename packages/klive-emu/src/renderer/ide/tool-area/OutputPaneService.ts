import { CSSProperties } from "styled-components";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { toStyleString } from "../utils/css-utils";

export type OutputColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

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
  writeLine(message: string): void;

  /**
   * This event fires when the contents of the buffer changes.
   */
  readonly contentsChanged: ILiteEvent<void>;
}

/**
 * Implements a simple buffer to write the contents of the output pane to
 */
export class OutputPaneBuffer implements IOutputBuffer {
  private _buffer: string[] = [];
  private _currentLineIndex: number = -1;
  private _color: OutputColor | null = null;
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
  }

  /**
   * Gets the contents of the buffer
   */
  getContents(): string[] {
    return this._buffer;
  }

  /**
   * Sets the default color
   */
  resetColor(): void {
    this._color = null;
  }

  /**
   * Sets the output to the specified color
   * @param color
   */
  color(color: OutputColor): void {
    this._color = color;
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
   */
  write(message: string): void {
    if (this._currentLineIndex < 0) {
      this._currentLineIndex = 0;
      this._buffer[0] = "";
    }

    if (this.isStyled()) {
      message = `<span style="${toStyleString(
        this.getStyle()
      )}">${message}</span>`;
    }

    this._buffer[this._currentLineIndex] = (
      this._buffer[this._currentLineIndex] + message
    ).substr(0, this.maxLineLenght);

    this._contentsChanged.fire();
  }

  /**
   * Writes a message and adds a new output line
   * @param message
   */
  writeLine(message: string): void {
    this.write(message);
    if (this._currentLineIndex >= this.bufferedLines) {
      this._buffer.shift();
    } else {
      this._currentLineIndex++;
    }
    this._buffer[this._currentLineIndex] = "";
  }

    /**
   * This event fires when the contents of the buffer changes.
   */
  get contentsChanged(): ILiteEvent<void> {
    return this._contentsChanged;
  }

  /**
   * Tests if we need to apply style
   */
  private isStyled(): boolean {
    return (
      !!this._color ||
      this._isBold ||
      this._isItalic ||
      this._isStrikethru ||
      this._isUnderline
    );
  }

  private getStyle(): CSSProperties {
    const style: CSSProperties = {};
    if (this._color) {
      style.color = `var(--console-ansi${this._color[0].toUpperCase()}${this._color.substring(
        1
      )})`;
    }
    if (this._isBold) {
      style.fontWeight = 600;
    }
    if (this._isItalic) {
      style.fontStyle = "italic";
    }
    if (this._isUnderline || this._isStrikethru) {
      style.textDecoration = `${this._isUnderline ? "underline " : " "} ${
        this._isStrikethru ? "line-through" : ""
      }`.trim();
    }
    return style;
  }
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
 * A base class for document panel descriptors
 */
export abstract class OutputPaneDescriptorBase implements IOutputPane {
  private _panelState: Record<string, any> = {};
  private _buffer: IOutputBuffer;

  /**
   * Instantiates the panel with the specified title
   * @param title
   */
  constructor(
    public readonly id: number | string,
    public readonly title: string,
    bufferLines?: number,
    maxLineLength?: number
  ) {
    this._buffer = new OutputPaneBuffer(bufferLines, maxLineLength);
  }

  /**
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any> {
    return this._panelState;
  }

  /**
   * Sets the state of the side bar panel
   * @param state Optional state to set
   */
  setPanelState(state: Record<string, any> | null): void {
    if (state) {
      this._panelState = { ...this._panelState, ...state };
    }
  }

  /**
   * Gets the buffer of the pane
   */
  get buffer(): IOutputBuffer {
    return this._buffer;
  }
}

/**
 * The service that manages output panes
 */
class OutputPaneService {
  private _panes: IOutputPane[] = [];
  private _paneMap = new Map<string | number, IOutputPane>();
  private _panesChanged = new LiteEvent<IOutputPane[]>();
  private _activePane: IOutputPane | null = null;
  private _activePaneChanging = new LiteEvent<void>();
  private _activePaneChanged = new LiteEvent<IOutputPane>();
  private _paneContentsChanged = new LiteEvent<IOutputPane>();

  /**
   * Registers a new output pane
   * @param pane Pane descriptor
   */
  registerOutputPane(pane: IOutputPane): void {
    if (this._paneMap.has(pane.id)) {
      throw new Error(`Output pane ${pane.id} is already registered.`);
    }
    this._panes.push(pane);
    this._paneMap.set(pane.id, pane);
    if (!this._activePane) {
      this.setActivePane(pane);
    }
    pane.buffer.contentsChanged.on(() => {
      this._paneContentsChanged.fire(pane);
    })
  }

  /**
   * Gets the current set of output panes
   * @returns
   */
  getOutputPanes(): IOutputPane[] {
    return this._panes.slice(0);
  }

  /**
   * Gets the active output pane
   */
  getActivePane(): IOutputPane | null {
    return this._activePane;
  }

  /**
   * Sets the active output pane
   * @param pane
   */
  setActivePane(pane: IOutputPane): void {
    if (this._activePane !== pane && this._panes.indexOf(pane) >= 0) {
      this._activePaneChanging.fire();
      this._activePane = pane;
      this._activePaneChanged.fire(pane);
    }
  }

  /**
   *
   * @param id Gets the pane with the specified id
   */
  getPaneById(id: string | number): IOutputPane | undefined {
    return this._paneMap.get(id);
  }

  /**
   * Fires when the list of output panes changed
   */
  get panesChanged(): ILiteEvent<IOutputPane[]> {
    return this._panesChanged;
  }

  /**
   * Fires when the active pane is about to change.
   */
  get activePaneChanging(): ILiteEvent<void> {
    return this._activePaneChanging;
  }

  /**
   * Fires when the active pane has changed.
   */
  get activePaneChanged(): ILiteEvent<IOutputPane> {
    return this._activePaneChanged;
  }

  /**
   * Fires when the contents of any of the output panes changes.
   * The event argument is the pane with changed contents
   */
  get paneContentsChanged(): ILiteEvent<IOutputPane> {
    return this._paneContentsChanged;
  }
}

/**
 * The singleton instance of the output pane service
 */
export const outputPaneService = new OutputPaneService();
