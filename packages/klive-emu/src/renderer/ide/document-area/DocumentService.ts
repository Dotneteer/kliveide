import { setDocumentFrameStateAction } from "../../../shared/state/document-frame-reducer";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { ideStore } from "../ideStore";
import { CodeEditorFactory } from "./CodeEditorFactory";
import {
  CodeEditorInfo,
  CustomLanguageInfo,
  IDocumentFactory,
  IDocumentPanel,
} from "./DocumentFactory";

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
  private _fileBoundFactories = new Map<string, IDocumentFactory>();
  private _extensionBoundFactories = new Map<string, IDocumentFactory>();
  private _editorExtensions = new Map<string, CodeEditorInfo>();
  private _languageExtensions = new Map<string, CustomLanguageInfo>();

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
   * Registers a factory for the specified file name
   * @param filename Filename to use as the key for the factory
   * @param factory Factory instance
   */
  registerFileBoundFactory(filename: string, factory: IDocumentFactory): void {
    this._fileBoundFactories.set(filename, factory);
  }

  /**
   * Registers a factory for the specified file extension
   * @param extension File extension the factory belongs to
   * @param factory factory isntance
   */
  registerExtensionBoundFactory(
    extension: string,
    factory: IDocumentFactory
  ): void {
    this._extensionBoundFactories.set(extension, factory);
  }

  /**
   * Registers a code editor for the specified extension
   * @param extension File extendion
   * @param editorInfo Editor information
   */
  registerCodeEditor(extension: string, editorInfo: CodeEditorInfo): void {
    this._editorExtensions.set(extension, editorInfo);
  }

  /**
   * Registers a custom language
   * @param language Language definition
   */
  registerCustomLanguage(language: CustomLanguageInfo): void {
    this._languageExtensions.set(language.id, language);
  }

  /**
   * Gets a custom language extension
   * @param id Language id
   */
  getCustomLanguage(id: string): CustomLanguageInfo | undefined {
    return this._languageExtensions.get(id);
  }

  /**
   * Gets a factory for the specified resource
   * @param resource Resouce name
   */
  getResourceFactory(resource: string): IDocumentFactory | null {
    // --- Get the field name from the full resource name
    const parts = resource.split("/");
    const filename = parts.length > 0 ? parts[parts.length - 1] : "";
    if (!filename) {
      return null;
    }

    // --- Get the extension from the file name
    const segments = filename.split(".");
    const extension =
      segments.length > 0 ? "." + segments.slice(1).join(".") : "";

    // --- Test if the file has a factory
    const fileNameFactory = this._fileBoundFactories.get(filename);
    if (fileNameFactory) {
      return fileNameFactory;
    }

    // --- Test if the extension has a factory
    if (!extension) {
      return null;
    }
    const extensionFactory = this._extensionBoundFactories.get(extension);
    if (extensionFactory) {
      return extensionFactory;
    }

    // --- Test if extension has an editor factory
    const codeEditorInfo = this._editorExtensions.get(extension);
    const language = codeEditorInfo?.language ?? "";
    return new CodeEditorFactory(language);
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
    // --- Do not register a document already registered
    const existingDoc = this.getDocumentById(doc.id);
    if (!existingDoc) {
      // --- Fix the insert position
      if (index === undefined || index === null) {
        index = this._documents.length;
      } else if (index < 0) {
        index = 0;
      } else if (index > this._documents.length - 1) {
        index = this._documents.length;
      } else {
        index = index + 1;
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
    } else {
      if (makeActive || !this._activeDocument) {
        this.setActiveDocument(existingDoc);
      }
    }
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
   * Gets the document with the specified identifier
   * @param id Document ID to search for
   */
  getDocumentById(id: string): IDocumentPanel | null {
    return this._documents.find((d) => d.id === id) ?? null;
  }

  /**
   * Gets the temporary document
   */
  getTemporaryDocument(): IDocumentPanel | null {
    return this._documents.find((d) => d.temporary) ?? null;
  }

  /**
   * Moves the document to the left
   * @param doc Document to move
   */
  moveLeft(doc: IDocumentPanel): void {
    const index = this._documents.indexOf(doc);
    if (index > 0) {
      const tmp = this._documents[index];
      this._documents[index] = this._documents[index - 1];
      this._documents[index - 1] = tmp;
      this._documents = this._documents.slice(0);
      this.fireChanges();
    }
  }

  /**
   * Moves the document to the right
   * @param doc Document to move
   */
  moveRight(doc: IDocumentPanel): void {
    const index = this._documents.indexOf(doc);
    if (index >= 0 && index < this._documents.length - 1) {
      const tmp = this._documents[index];
      this._documents[index] = this._documents[index + 1];
      this._documents[index + 1] = tmp;
      this._documents = this._documents.slice(0);
      this.fireChanges();
    }
  }

  /**
   * Closes all documents
   */
  closeAll(): void {
    const docs = this._documents.slice(0);
    docs.forEach((d) => this.unregisterDocument(d));
  }

  /**
   * Closes all documents except the specified one
   * @param doc Document to keep open
   */
  closeOthers(doc: IDocumentPanel): void {
    const otherDocs = this._documents.filter((d) => d !== doc);
    otherDocs.forEach((d) => this.unregisterDocument(d));
  }

  /**
   * Closes all documents to the right of the specified one
   * @param doc Document to keep open
   */
  closeToTheRight(doc: IDocumentPanel): void {
    const index = this._documents.indexOf(doc);
    if (index >= 0 && index < this._documents.length - 1) {
      const rightDocs = this._documents.slice(index + 1);
      rightDocs.forEach((d) => this.unregisterDocument(d));
    }
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
  fireChanges(): void {
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
