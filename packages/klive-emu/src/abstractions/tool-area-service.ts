import { ILiteEvent } from "../shared/utils/LiteEvent";

/**
 * Represents an output panel
 */
export interface IToolPanel {
  /**
   * The index of the panel
   */
  index: number;

  /**
   * Is this the active panel?
   */
  active: boolean;

  /**
   * The title of the panel
   */
  title: string;

  /**
   * Creates a header element for the panel
   */
  createHeaderElement(): React.ReactNode;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

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
 * Represents the document information
 */
export type ToolsInfo = {
  tools: IToolPanel[];
  active: IToolPanel | null;
};

/**
 * Represents the service that handles the output area
 */
export interface IToolAreaService {
  /**
   * Gets the registered tool panels
   */
  getTools(): IToolPanel[];

  /**
   * Registers a tool
   * @param tool Tool instance to register
   * @param index Tool index
   * @param makeActive Make this tool the active one?
   */
  registerTool(tool: IToolPanel, makeActive: boolean, index?: number): void;

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  setActiveTool(doc: IToolPanel | null): void;

  /**
   * Gets the active document
   */
  getActiveTool(): IToolPanel | null;

  /**
   * Moves the document to the left
   * @param doc Document to move
   */
  moveLeft(doc: IToolPanel): void;

  /**
   * Moves the document to the right
   * @param doc Document to move
   */
  moveRight(doc: IToolPanel): void;

  /**
   * Fires when a new document has been registered
   */
  get toolsRegistered(): ILiteEvent<IToolPanel>;

  /**
   * Fires when the active document is about to change
   */
  get activeToolChanging(): ILiteEvent<IToolPanel | null>;

  /**
   * Fires when the active document has been changed
   */
  get activeToolChanged(): ILiteEvent<IToolPanel | null>;

  /**
   * Fires when any documents changes occurres
   */
  get toolsChanged(): ILiteEvent<ToolsInfo>;

  /**
   * Signs that the active pane has been scrolled
   * @param position
   */
  scrollActivePane(position: number): void;

  /**
   * This event is fired when the active pane is scrolled
   */
  get activePaneScrolled(): ILiteEvent<number | null>;
}
