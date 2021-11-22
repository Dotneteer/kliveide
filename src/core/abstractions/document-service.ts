import { ILiteEvent } from "@core/utils/lite-event";
import { ProjectNode } from "./project-node";

/**
 * Data to navigate within a document
 */
export interface NavigationInfo {
  line?: number;
  column?: number;
}

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
   * Is the panel temporary?
   */
  temporary: boolean;

  /**
   * The title of the panel
   */
  title: string;

  /**
   * Indicates if the document should have initial focus
   */
  initialFocus: boolean;

  /**
   * The project node behind the document panel
   */
  projectNode: ProjectNode;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

  /**
   * Navigates to the specified document location
   * @param location Document location
   */
  navigateToLocation(location: NavigationInfo): Promise<void>;

  /**
   * Sign that the document descriptor has changed
   */
  signDescriptorChange(): void;

  /**
   * Allows saving the panel state
   */
  saveDocumentState(): void;

  /**
   * Allows the panel to restore its state
   */
  restoreDocumentState(): void;

  /**
   * Signs that the document descriptor has changed
   */
  readonly documentDescriptorChanged: ILiteEvent<void>;

  /**
   * Optional data object
   */
  data?: unknown;
}

/**
 * Represents the information about a code editor
 */
export type CodeEditorInfo = {
  /**
   * Langauge to use with the editor
   */
  language: string;

  /**
   * Can be promoted to build root?
   */
  allowBuildRoot?: boolean;
};

/**
 * Represents information about a custom language
 *
 * HACK: we use "any" for the properties to avoid any dependencies from
 * the Monaco Editor (as that cannot be loaded into the main process)
 *
 */
export type CustomLanguageInfo = {
  id: string;
  options?: any;
  languageDef?: any;
  lightTheme?: any;
  darkTheme?: any;
  supportsBreakpoints?: boolean;
};

/**
 * Represents the information about displayed documents
 */
export type DocumentsInfo = {
  docs: IDocumentPanel[];
  active: IDocumentPanel | null;
};

/**
 * A factory that can create a document panel
 */
export interface IDocumentFactory {
  /**
   * Creates a document panel
   * @param resource Resosurce name
   * @param contents Contents of the document
   */
  createDocumentPanel(
    resource: string,
    contents: string | Buffer
  ): Promise<IDocumentPanel>;
}

/**
 * IDocumentService manages the opened documents
 */
export interface IDocumentService {
  /**
   * Gets the registered document panels
   */
  getDocuments(): IDocumentPanel[];

  /**
   * Registers a factory for the specified file name
   * @param filename Filename to use as the key for the factory
   * @param factory Factory instance
   */
  registerFileBoundFactory(filename: string, factory: IDocumentFactory): void;

  /**
   * Registers a factory for the specified file extension
   * @param extension File extension the factory belongs to
   * @param factory factory isntance
   */
  registerExtensionBoundFactory(
    extension: string,
    factory: IDocumentFactory
  ): void;

  /**
   * Registers a code editor for the specified extension
   * @param extension File extendion
   * @param editorInfo Editor information
   */
  registerCodeEditor(extension: string, editorInfo: CodeEditorInfo): void;

  /**
   * Registers a custom language
   * @param language Language definition
   */
  registerCustomLanguage(language: CustomLanguageInfo): void;

  /**
   * Gets code editor information for the specified resouce
   * @param resource Resource namse
   * @returns Code editor, if found; otherwise, undefined
   */
  getCodeEditorInfo(resource: string): CodeEditorInfo | undefined;

  /**
   * Gets a custom language extension
   * @param id Language id
   */
  getCustomLanguage(id: string): CustomLanguageInfo | undefined;

  /**
   * Gets a factory for the specified resource
   * @param resource Resouce name
   */
  getResourceFactory(resource: string): IDocumentFactory | null;

  /**
   * Registers a document
   * @param doc Document instance to register
   * @param index Document index
   * @param makeActive Make this document the active one?
   */
  registerDocument(
    doc: IDocumentPanel,
    makeActive: boolean,
    index?: number
  ): Promise<IDocumentPanel>;

  /**
   * Unregisters (and removes) the specified document
   * @param doc
   */
  unregisterDocument(doc: IDocumentPanel): Promise<void>;

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  setActiveDocument(doc: IDocumentPanel | null): Promise<void>;

  /**
   * Gets the active document
   */
  getActiveDocument(): IDocumentPanel | null;

  /**
   * Gets the document with the specified identifier
   * @param id Document ID to search for
   */
  getDocumentById(id: string): IDocumentPanel | null;

  /**
   * Gets the temporary document
   */
  getTemporaryDocument(): IDocumentPanel | null;

  /**
   * Moves the document to the left
   * @param doc Document to move
   */
  moveLeft(doc: IDocumentPanel): void;

  /**
   * Moves the document to the right
   * @param doc Document to move
   */
  moveRight(doc: IDocumentPanel): void;

  /**
   * Closes all documents
   */
  closeAll(): Promise<void>;

  /**
   * Closes all documents except the specified one
   * @param doc Document to keep open
   */
  closeOthers(doc: IDocumentPanel): Promise<void>;

  /**
   * Closes all documents to the right of the specified one
   * @param doc Document to keep open
   */
  closeToTheRight(doc: IDocumentPanel): Promise<void>;

  /**
   * Fires when any documents changes occurres
   */
  readonly documentsChanged: ILiteEvent<DocumentsInfo>;

  /**
   * Fires the documents changed event
   */
  fireChanges(): void;
}
