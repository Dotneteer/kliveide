import { setDocumentFrameStateAction } from "../../../shared/state/document-frame-reducer";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { ideStore } from "../ideStore";

/**
 * Represents a document panel
 */
export interface IDocumentPanel {
  /**
   * The document identifier
   */
  id: string;

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
  setPanelState(
    state: Record<string, any> | null
  ): void;
}

/**
 * A base class for document panel descriptors
 */
export abstract class DocumentPanelDescriptorBase implements IDocumentPanel {
  private _panelState: Record<string, any> = {};

  /**
   * Instantiates the panel with the specified title
   * @param title
   */
  constructor(public readonly id: string, public readonly title: string) {}

  /**
   * The index of the panel
   */
  index: number;

  /**
   * Is this the active panel?
   */
  active: boolean;

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
  setPanelState(
    state: Record<string, any> | null
  ): void {
    if (state) {
      this._panelState = { ...this._panelState, ...state };
    }
  }
}

/**
 * Represenst a service that handles document panels
 */
class DocumentService {
  private _documents: IDocumentPanel[];
  private _activeDocument: IDocumentPanel | null;
  private _activationStack: IDocumentPanel[];
  private _documentRegistered = new LiteEvent<IDocumentPanel>();
  private _documentUnregistered = new LiteEvent<IDocumentPanel>();
  private _activeDocumentChanging = new LiteEvent<IDocumentPanel | null>();
  private _activeDocumentChanged = new LiteEvent<IDocumentPanel | null>();
  private _documentsChanged = new LiteEvent<DocumentsInfo>();

  constructor() {
    this._documents = [];
    this._activeDocument = null;
    this._activationStack = [];
  }

  /**
   * Gets the registered document panels
   */
  getDocuments(): IDocumentPanel[] {
    return this._documents;
  }

  /**
   * Registers a document
   * @param doc Document instance to register
   * @param index Document index
   * @param makeActive Make this document the active one?
   */
  registerDocument(
    doc: IDocumentPanel,
    makeActive: boolean = true,
    index?: number
  ): void {
    // --- Fix the insert position
    if (index === undefined || index === null) {
      index = this._documents.length;
    } else if (index < 0) {
      index = 0;
    } else if (index > this._documents.length - 1) {
      index = this._documents.length;
    }

    // --- Insert the document and activate it
    this._documents.splice(index, 0, doc);
    this._documents = this._documents.slice(0);
    doc.index = index;
    this._documentRegistered.fire(doc);
    if (makeActive || !this._activeDocument) {
      this.setActiveDocument(doc);
    }
    this._activationStack.push(doc);
    this.fireChanges();
  }

  /**
   * Unregisters (and removes) the specified document
   * @param doc
   */
  unregisterDocument(doc: IDocumentPanel): void {
    // --- Unregister existing document only
    const position = this._documents.indexOf(doc);
    if (position < 0) {
      return;
    }

    // --- Remove the document
    this._documents.splice(position, 1);
    this._documents = this._documents.slice(0);
    this._activationStack = this._activationStack.filter((d) => d !== doc);
    this._documentUnregistered.fire(doc);

    // --- Activate a document
    if (this._activationStack.length > 0) {
      this.setActiveDocument(this._activationStack.pop());
    } else if (this._documents.length === 0) {
      this.setActiveDocument(null);
    } else if (position >= this._documents.length - 1) {
      this.setActiveDocument(this._documents[this._documents.length - 1]);
    } else {
      this.setActiveDocument(this._documents[position + 1]);
    }
    this.fireChanges();
  }

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  setActiveDocument(doc: IDocumentPanel | null): void {
    // --- Save the state of the active panel
    if (this._activeDocument) {
      const fullState = Object.assign(
        {},
        ideStore.getState().documentFrame ?? {},
        {
          [this._activeDocument.id]: this._activeDocument.getPanelState(),
        }
      );
      ideStore.dispatch(setDocumentFrameStateAction(fullState));
    }

    // --- Invoke custom action
    this._activeDocumentChanging.fire(doc);

    if (!doc) {
      // --- There is no active document
      const oldDocument = this._activeDocument;
      this._activeDocument = null;
      if (!oldDocument) {
        this._activeDocumentChanged.fire(null);
        this.fireChanges();
        return;
      }
    }

    // --- You can activate only an existing document
    const position = this._documents.indexOf(doc);
    if (position < 0) {
      return;
    }

    // --- Activate the document
    this._activeDocument = doc;
    this._activationStack.push(doc);
    this._documents.forEach((d) => (d.active = false));
    doc.active = true;

    // --- Load the state of the active document
    const documentsState = ideStore.getState().documentFrame ?? {};
    const documentState = documentsState?.[this._activeDocument.id];
    if (documentState) {
      this._activeDocument.setPanelState(documentState);
    }

    // --- Invoke custom action
    this._activeDocumentChanged.fire(doc);
    this.fireChanges();
  }

  /**
   * Gets the active document
   */
  getActiveDocument(): IDocumentPanel | null {
    return this._activeDocument;
  }

  /**
   * Fires when a new document has been registered
   */
  get documentRegistered(): ILiteEvent<IDocumentPanel> {
    return this._documentRegistered;
  }

  /**
   * Fires when a new document has been unregistered
   */
  get documentUnregistered(): ILiteEvent<IDocumentPanel> {
    return this._documentUnregistered;
  }

  /**
   * Fires when the active document is about to change
   */
  get activeDocumentChanging(): ILiteEvent<IDocumentPanel | null> {
    return this._activeDocumentChanging;
  }

  /**
   * Fires when the active document has been changed
   */
  get activeDocumentChanged(): ILiteEvent<IDocumentPanel | null> {
    return this._activeDocumentChanged;
  }

  /**
   * Fires when any documents changes occurres
   */
  get documentsChanged(): ILiteEvent<DocumentsInfo> {
    return this._documentsChanged;
  }

  /**
   * Fires the documents changed event
   */
  private fireChanges(): void {
    this._documentsChanged.fire({
      docs: this._documents.slice(0),
      active: this._activeDocument,
    });
  }
}

/**
 * Represents the document information
 */
export type DocumentsInfo = {
  docs: IDocumentPanel[];
  active: IDocumentPanel | null;
};

/**
 * The singleton instance of the service
 */
export const documentService = new DocumentService();
