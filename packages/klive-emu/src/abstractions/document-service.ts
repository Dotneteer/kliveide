import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import { ProjectNode } from "../renderer/ide/explorer-tools/ProjectNode";
import { ILiteEvent } from "../shared/utils/LiteEvent";

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
   * Sign that the document descriptor has changed
   */
  signDescriptorChange(): void;

  /**
   * Signs that the document descriptor has changed
   */
  readonly documentDescriptorChanged: ILiteEvent<void>;
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
 * Describes the body of an code editor related theme
 */
type EditorThemeBody = {
  rules: monacoEditor.editor.ITokenThemeRule[];
  encodedTokensColors?: string[];
  colors: monacoEditor.editor.IColors;
};

/**
 * Represents information about a custom language
 */
export type CustomLanguageInfo = {
  id: string;
  options?: monacoEditor.languages.LanguageConfiguration;
  languageDef?: monacoEditor.languages.IMonarchLanguage;
  lightTheme?: EditorThemeBody;
  darkTheme?: EditorThemeBody;
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
  ): IDocumentPanel;

  /**
   * Unregisters (and removes) the specified document
   * @param doc
   */
  unregisterDocument(doc: IDocumentPanel): void;

  /**
   * Sets the specified document to be the active one
   * @param doc Document to activate
   */
  setActiveDocument(doc: IDocumentPanel | null): void;

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
  closeAll(): void;

  /**
   * Closes all documents except the specified one
   * @param doc Document to keep open
   */
  closeOthers(doc: IDocumentPanel): void;

  /**
   * Closes all documents to the right of the specified one
   * @param doc Document to keep open
   */
  closeToTheRight(doc: IDocumentPanel): void;

  /**
   * Fires when any documents changes occurres
   */
  readonly documentsChanged: ILiteEvent<DocumentsInfo>;

  /**
   * Fires the documents changed event
   */
  fireChanges(): void;
}
