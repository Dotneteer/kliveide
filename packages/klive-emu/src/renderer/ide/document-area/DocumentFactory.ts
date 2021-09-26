import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";

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
  initialFocus?: boolean;

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
 * A base class for document panel descriptors
 */
export abstract class DocumentPanelDescriptorBase implements IDocumentPanel {
  private _panelState: Record<string, any> = {};
  private _documentDescriptorChanged = new LiteEvent<void>();

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
   * Is the panel temporary?
   */
  temporary: boolean;

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

  /**
   * Sign that the document descriptor has changed
   */
  signDescriptorChange(): void {
    this._documentDescriptorChanged.fire();
  }

  /**
   * Signs that the document descriptor has changed
   */
  get documentDescriptorChanged(): ILiteEvent<void> {
    return this._documentDescriptorChanged;
  }
}
