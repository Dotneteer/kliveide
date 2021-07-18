import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";

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
   * Writes a new entry to the output
   * @param message Message to write
   */
  write(message: string): void;

  /**
   * Writes a message and adds a new output line
   * @param message
   */
  writeLine(message: string): void;
}

/**
 * Implements a simple buffer to write the contents of the output pane to
 */
export class OutputPaneBuffer implements IOutputBuffer {
  private _buffer: string[] = [];
  private _currentLineIndex: number = -1;

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
   * Writes a new entry to the output
   * @param message Message to write
   */
  write(message: string): void {
    if (this._currentLineIndex < 0) {
      this._currentLineIndex = 0;
      this._buffer[0] = "";
    }
    this._buffer[this._currentLineIndex] = (
      this._buffer[this._currentLineIndex] + message
    ).substr(0, this.maxLineLenght);
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
      console.log(`Changed: ${pane.id}`);
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
}

/**
 * The singleton instance of the output pane service
 */
export const outputPaneService = new OutputPaneService();
