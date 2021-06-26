import React from "react";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";

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
 * A base class for document panel descriptors
 */
export abstract class ToolPanelDescriptorBase implements IToolPanel {
  private _panelState: Record<string, any> = {};

  /**
   * Instantiates the panel with the specified title
   * @param title
   */
  constructor(public readonly title: string) {}

  /**
   * The index of the panel
   */
  index: number;

  /**
   * Is this the active panel?
   */
  active: boolean;

  /**
   * Creates a header element for the panel
   */
  abstract createHeaderElement(): React.ReactNode;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  abstract createContentElement(): React.ReactNode;

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
 * Represents the service that handles the output area
 */
class ToolAreaService {
  private _tools: IToolPanel[];
  private _activeTool: IToolPanel | null;
  private _toolsRegistered = new LiteEvent<IToolPanel>();
  private _activeToolChanging = new LiteEvent<IToolPanel | null>();
  private _activeToolChanged = new LiteEvent<IToolPanel | null>();
  private _documentsChanged = new LiteEvent<ToolsInfo>();

  constructor() {
    this._tools = [];
    this._activeTool = null;
  }

  /**
   * Gets the registered tool panels
   */
  getTools(): IToolPanel[] {
    return this._tools;
  }

  /**
   * Registers a tool
   * @param tool Tool instance to register
   * @param index Tool index
   * @param makeActive Make this tool the active one?
   */
  registerTool(
    tool: IToolPanel,
    makeActive: boolean = true,
    index?: number
  ): void {
    // --- Fix the insert position
    if (index === undefined || index === null) {
      index = this._tools.length;
    } else if (index < 0) {
      index = 0;
    } else if (index > this._tools.length - 1) {
      index = this._tools.length;
    }

    // --- Insert the document and activate it
    this._tools.splice(index, 0, tool);
    this._tools = this._tools.slice(0);
    tool.index = index;
    this._toolsRegistered.fire(tool);
    if (makeActive || !this._activeTool) {
      this.setActiveTool(tool);
    }
    this.fireChanges();
  }

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  setActiveTool(doc: IToolPanel | null): void {
    // --- Save the state of the active panel
    if (this._activeTool) {
      // const fullState = Object.assign(
      //   {},
      //   ideStore.getState().documentFrame ?? {},
      //   {
      //     [this._activeTool.id]: this._activeTool.getPanelState(),
      //   }
      // );
      // ideStore.dispatch(setDocumentFrameStateAction(fullState));
    }

    // --- Invoke custom action
    this._activeToolChanging.fire(doc);

    if (!doc) {
      // --- There is no active document
      const oldDocument = this._activeTool;
      this._activeTool = null;
      if (!oldDocument) {
        this._activeToolChanged.fire(null);
        this.fireChanges();
        return;
      }
    }

    // --- You can activate only an existing document
    const position = this._tools.indexOf(doc);
    if (position < 0) {
      return;
    }

    // --- Activate the document
    this._activeTool = doc;
    this._tools.forEach((d) => (d.active = false));
    doc.active = true;

    // --- Load the state of the active document
    // const documentsState = ideStore.getState().documentFrame ?? {};
    // const documentState = documentsState?.[this._activeTool.id];
    // if (documentState) {
    //   this._activeTool.setPanelState(documentState);
    // }

    // --- Invoke custom action
    this._activeToolChanged.fire(doc);
    this.fireChanges();
  }

  /**
   * Gets the active document
   */
  getActiveTool(): IToolPanel | null {
    return this._activeTool;
  }

  /**
   * Moves the document to the left
   * @param doc Document to move
   */
  moveLeft(doc: IToolPanel): void {
    const index = this._tools.indexOf(doc);
    if (index > 0) {
      const tmp = this._tools[index];
      this._tools[index] = this._tools[index - 1];
      this._tools[index - 1] = tmp;
      this._tools = this._tools.slice(0);
      this.fireChanges();
    }
  }

  /**
   * Moves the document to the right
   * @param doc Document to move
   */
  moveRight(doc: IToolPanel): void {
    const index = this._tools.indexOf(doc);
    if (index >= 0 && index < this._tools.length - 1) {
      const tmp = this._tools[index];
      this._tools[index] = this._tools[index + 1];
      this._tools[index + 1] = tmp;
      this._tools = this._tools.slice(0);
      this.fireChanges();
    }
  }

  /**
   * Fires when a new document has been registered
   */
  get toolsRegistered(): ILiteEvent<IToolPanel> {
    return this._toolsRegistered;
  }

  /**
   * Fires when the active document is about to change
   */
  get activeToolChanging(): ILiteEvent<IToolPanel | null> {
    return this._activeToolChanging;
  }

  /**
   * Fires when the active document has been changed
   */
  get activeToolChanged(): ILiteEvent<IToolPanel | null> {
    return this._activeToolChanged;
  }

  /**
   * Fires when any documents changes occurres
   */
  get documentsChanged(): ILiteEvent<ToolsInfo> {
    return this._documentsChanged;
  }

  /**
   * Fires the documents changed event
   */
  private fireChanges(): void {
    this._documentsChanged.fire({
      tools: this._tools.slice(0),
      active: this._activeTool,
    });
  }
}

/**
 * Represents the document information
 */
 export type ToolsInfo = {
  tools: IToolPanel[];
  active: IToolPanel | null;
};


export const toolAreaService = new ToolAreaService();