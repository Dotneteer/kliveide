import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";

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
}

/**
 * A base class for document panel descriptors
 */
export abstract class OutputPaneDescriptorBase implements IOutputPane {
  private _panelState: Record<string, any> = {};

  /**
   * Instantiates the panel with the specified title
   * @param title
   */
  constructor(
    public readonly id: number | string,
    public readonly title: string
  ) {}

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
}

/**
 * The service that manages output panes
 */
class OutputPaneService {
  private _panes: IOutputPane[] = [];
  private _panesChanged = new LiteEvent<IOutputPane[]>();
  private _activePane: IOutputPane | null = null;
  private _activePaneChanging = new LiteEvent<IOutputPane>();
  private _activePaneChanged = new LiteEvent<IOutputPane>();

  /**
   * Registers a new output pane
   * @param pane Pane descriptor
   */
  registerOutputPane(pane: IOutputPane): void {
    this._panes.push(pane);
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

  setActivePane(pane: IOutputPane): void {
    if (this._activePane !== pane && this._panes.indexOf(pane) >= 0) {
      this._activePaneChanging.fire();
      this._activePane = pane;
      this._activePaneChanged.fire();
    }
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
  get activePaneChanging(): ILiteEvent<IOutputPane> {
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
