import {
  CodeEditorInfo,
  CustomLanguageInfo,
  DocumentsInfo,
  IDocumentFactory,
  IDocumentPanel,
  IDocumentService,
} from "@abstractions/document-service";
import { ILiteEvent, LiteEvent } from "@core/utils/lite-event";
import { getNodeExtension, getNodeFile } from "@abstractions/project-node";
import { CodeEditorFactory } from "./CodeEditorFactory";
import { getSettingsService, getState } from "@core/service-registry";
import { SettingLocation } from "@abstractions/settings-service";

/**
 * Represenst a service that handles document panels
 */
export class DocumentService implements IDocumentService {
  private _documents: IDocumentPanel[];
  private _activeDocument: IDocumentPanel | null;
  private _activationStack: IDocumentPanel[];
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
   * Gets code editor information for the specified resouce
   * @param resource Resource namse
   * @returns Code editor, if found; otherwise, undefined
   */
  async getCodeEditorLanguage(resource: string): Promise<string | undefined> {
    // --- Get the file name from the full resource name
    const filename = getNodeFile(resource);

    // #3: Test if we have an extension for the specified language in the current settings
    const langInProject = await getLanguage("current");
    if (langInProject) {
      return langInProject;
    }

    // #4: Test if we have an extension for the specified language in the user settings
    const langInSettings = await getLanguage("user");
    if (langInSettings) {
      return langInSettings;
    }

    // #5: Test if extension has an editor factory
    for (const entry of this._languageExtensions) {
      if (
        entry[1].extensions &&
        entry[1].extensions.some((e) => filename.endsWith(e))
      ) {
        return entry[0];
      }
    }

    // #6: Use code editor with the defaults (no language)
    return "";

    // --- Obtains langugae information from configuration
    async function getLanguage(
      location: SettingLocation
    ): Promise<string | undefined> {
      const settings = await getSettingsService().getConfigurationObject(
        location
      );
      const langSettings = settings?.["languages"];
      if (langSettings && typeof langSettings === "object") {
        for (const key in langSettings) {
          const exts = langSettings[key].toString().split("|") as string[];
          if (exts && exts.some((e) => filename.endsWith(e))) {
            return key;
          }
        }
      }
      return undefined;
    }
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
  async getResourceFactory(resource: string): Promise<IDocumentFactory | null> {
    // --- Get the file name from the full resource name
    const filename = getNodeFile(resource);
    const extension = getNodeExtension(resource);

    // #1: Test if the file has a factory
    const fileNameFactory = this._fileBoundFactories.get(filename);
    if (fileNameFactory) {
      return fileNameFactory;
    }

    // #2: Test if the extension has a factory
    if (!extension) {
      return null;
    }
    const extensionFactory = this._extensionBoundFactories.get(extension);
    if (extensionFactory) {
      return extensionFactory;
    }

    return new CodeEditorFactory(await this.getCodeEditorLanguage(resource));
  }

  /**
   * Registers a document
   * @param doc Document instance to register
   * @param index Document index
   * @param makeActive Make this document the active one?
   */
  async registerDocument(
    doc: IDocumentPanel,
    makeActive: boolean = true,
    index?: number
  ): Promise<IDocumentPanel> {
    // --- Do not register a document already registered
    let existingDoc = this.getDocumentById(doc.id);
    if (!existingDoc) {
      existingDoc = doc;
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

      if (makeActive || !this._activeDocument) {
        await this.setActiveDocument(doc);
      }
      this._activationStack.push(doc);
      this.fireChanges();
    } else {
      if (makeActive || !this._activeDocument) {
        await this.setActiveDocument(existingDoc);
      }
    }
    return existingDoc;
  }

  /**
   * Unregisters (and removes) the specified document
   * @param doc
   */
  async unregisterDocument(doc: IDocumentPanel): Promise<void> {
    // --- Unregister existing document only
    const position = this._documents.indexOf(doc);
    if (position < 0) {
      return;
    }

    // --- Remove the document
    this._documents.splice(position, 1);
    this._documents = this._documents.slice(0);
    this._activationStack = this._activationStack.filter((d) => d !== doc);

    // --- Activate a document
    if (this._activationStack.length > 0) {
      await this.setActiveDocument(this._activationStack.pop());
    } else if (this._documents.length === 0) {
      await this.setActiveDocument(null);
    } else if (position >= this._documents.length - 1) {
      await this.setActiveDocument(this._documents[this._documents.length - 1]);
    } else {
      await this.setActiveDocument(this._documents[position + 1]);
    }
    this.fireChanges();
  }

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  async setActiveDocument(doc: IDocumentPanel | null): Promise<void> {
    if (this._activeDocument === doc) {
      return;
    }

    // --- Save the state of the old document
    const oldDocument = this._activeDocument;
    if (oldDocument) {
      oldDocument.saveDocumentState();
    }

    if (!doc) {
      // --- There is no active document
      this._activeDocument = null;

      // --- Sign changes, if there was a previous active document
      if (!oldDocument) {
        this.fireChanges();
        return;
      }
    }

    // --- You can activate only an existing document
    const position = this._documents.indexOf(doc);
    if (position < 0) {
      return;
    }

    // --- Activate the document with its state
    doc.restoreDocumentState();
    this._activeDocument = doc;
    this._activationStack.push(doc);
    this._documents.forEach((d) => (d.active = false));
    doc.active = true;

    // --- Invoke custom action
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
  async closeAll(): Promise<void> {
    const docs = this._documents.slice(0);
    docs.forEach(async (d) => await this.unregisterDocument(d));
  }

  /**
   * Closes all documents except the specified one
   * @param doc Document to keep open
   */
  async closeOthers(doc: IDocumentPanel): Promise<void> {
    const otherDocs = this._documents.filter((d) => d !== doc);
    otherDocs.forEach(async (d) => await this.unregisterDocument(d));
  }

  /**
   * Closes all documents to the right of the specified one
   * @param doc Document to keep open
   */
  async closeToTheRight(doc: IDocumentPanel): Promise<void> {
    const index = this._documents.indexOf(doc);
    if (index >= 0 && index < this._documents.length - 1) {
      const rightDocs = this._documents.slice(index + 1);
      rightDocs.forEach(async (d) => await this.unregisterDocument(d));
    }
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
