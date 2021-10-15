import * as React from "react";

import { getDocumentService, getState, getStore, getThemeService } from "@core/service-registry";

import { CSSProperties } from "styled-components";
import MonacoEditor from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import ReactResizeDetector from "react-resize-detector";
import { DocumentPanelDescriptorBase } from "../document-area/DocumentFactory";
import { FileOperationResponse } from "@core/messaging/message-types";
import { IDocumentPanel } from "@abstractions/document-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { getEditorService } from "./editorService";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

/**
 * Component properties
 */
interface Props {
  descriptor: IDocumentPanel;
  sourceCode: string;
  language: string;
}

/**
 * Component state
 */
interface State {
  width: string;
  height: string;
  show: boolean;
}

/**
 * A sample document
 */
export default class EditorDocument extends React.Component<Props, State> {
  private divHost = React.createRef<HTMLDivElement>();
  private _editor: monacoEditor.editor.IStandaloneCodeEditor;
  private _unsavedChangeCounter = 0;
  private _descriptorChanged: () => void;
  private _refreshBreakpoints: () => void;
  private _subscribedToBreakpointEvents = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      width: "100%",
      height: "100%",
      show: false,
    };
    this._descriptorChanged = () => this.descriptorChanged();
    this._refreshBreakpoints = () => this.refreshBreakpoints();
  }

  /**
   * Set up the Monaco editor before instantiating it
   * @param monaco
   */
  editorWillMount(monaco: typeof monacoEditor): void {
    // --- Does the editor uses a custom language (and not one supported
    // --- out of the box)?
    if (
      !monaco.languages
        .getLanguages()
        .some(({ id }) => id === this.props.language)
    ) {
      // --- Do we support that custom language?
      const languageInfo = getDocumentService().getCustomLanguage(
        this.props.language
      );
      if (languageInfo) {
        // --- Yes, register a new language
        monaco.languages.register({ id: languageInfo.id });

        // --- Register a tokens provider for the language
        monaco.languages.setMonarchTokensProvider(
          languageInfo.id,
          languageInfo.languageDef
        );

        // --- Set the editing configuration for the language
        monaco.languages.setLanguageConfiguration(
          languageInfo.id,
          languageInfo.options
        );

        // --- Define light theme for the language
        if (languageInfo.lightTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-light`, {
            base: "vs",
            inherit: true,
            rules: languageInfo.lightTheme.rules,
            encodedTokensColors: languageInfo.lightTheme.encodedTokensColors,
            colors: languageInfo.lightTheme.colors,
          });
        }
        // --- Define dark theme for the language
        if (languageInfo.darkTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-dark`, {
            base: "vs-dark",
            inherit: true,
            rules: languageInfo.darkTheme.rules,
            encodedTokensColors: languageInfo.darkTheme.encodedTokensColors,
            colors: languageInfo.darkTheme.colors,
          });
        }
      }
    }
  }

  /**
   * Set up the editor after that has been instantiated
   * @param editor
   * @param monaco
   */
  editorDidMount(
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: typeof monacoEditor
  ) {
    // --- Restore thr previously saved state, provided we have one
    monaco.languages.setMonarchTokensProvider;
    this._editor = editor;
    const documentResource = this.props.descriptor.id;
    const state = getEditorService().loadState(documentResource);
    if (state) {
      this._editor.setValue(state.text);
      this._editor.restoreViewState(state.viewState);
    }
    if (this.props.descriptor.initialFocus) {
      window.requestAnimationFrame(() => this._editor.focus());
    }

    // --- Dos the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );
    if (languageInfo?.supportsBreakpoints) {
      const store = getStore();
      store.breakpointsChanged.on(this._refreshBreakpoints);
      store.compilationChanged.on(this._refreshBreakpoints);
      this._subscribedToBreakpointEvents = true;
      // --- Prepare the editor for breakpoint handling
      let oldDecorations = editor.deltaDecorations(
        [],
        [
          createBreakpointDecoration(2),
          createCurrentBreakpointDecoration(4),
          createDisabledBreakpointDecoration(6),
        ]
      );
      console.log(oldDecorations);
      editor.onMouseDown((e) => {
        if (e.target.type === 2) {
          const lineNo = e.target.position.lineNumber;
          console.log(
            `Margin: (${e.target.position.lineNumber}, ${e.target.position.column}`
          );
          oldDecorations = editor.deltaDecorations(oldDecorations, [
            {
              range: new monaco.Range(lineNo, 1, lineNo, 1),
              options: {
                isWholeLine: false,
                glyphMarginClassName: "myGlyphMarginClass",
              },
            },
          ]);
        }
      });
    }
  }

  /**
   * Respond to editor contents changes
   * @param _newValue New editor contents
   * @param e Description of changes
   */
  async onEditorContentsChange(
    _newValue: string,
    e: monacoEditor.editor.IModelContentChangedEvent
  ) {
    // --- Make the document permanent
    const documentService = getDocumentService();
    const currentDoc = documentService.getDocumentById(
      this.props.descriptor.id
    );
    if (currentDoc?.temporary) {
      // --- Make this document permanent
      currentDoc.temporary = false;
      documentService.registerDocument(currentDoc, true);
    }

    // --- Save document after the change
    this._unsavedChangeCounter++;
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE));
    if (
      this._unsavedChangeCounter === 1 &&
      this._editor?.getModel()?.getValue()
    ) {
      await this.saveDocument(this._editor.getModel().getValue());
    }
    this._unsavedChangeCounter--;
  }

  /**
   * Subscribes to events after the component has been mounted
   */
  componentDidMount(): void {
    this.setState({ show: true });
    this.props.descriptor.documentDescriptorChanged.on(this._descriptorChanged);
  }

  /**
   * Unsubscribes from events before the component is unmounted
   */
  async componentWillUnmount(): Promise<void> {
    // --- Dispose event handler
    this.props.descriptor.documentDescriptorChanged.off(
      this._descriptorChanged
    );
    if (this._subscribedToBreakpointEvents) {
      const store = getStore();
      store.breakpointsChanged.off(this._refreshBreakpoints);
      store.compilationChanged.off(this._refreshBreakpoints);
    }

    // --- Check if this document is still registered
    const docId = this.props.descriptor.id;
    const doc = getDocumentService().getDocumentById(docId);
    if (doc) {
      const text = this._editor.getValue();
      getEditorService().saveState(this.props.descriptor.id, {
        text: this._editor.getValue(),
        viewState: this._editor.saveViewState(),
      });
      if (this._unsavedChangeCounter > 0) {
        await this.saveDocument(text);
      }
    }
  }

  /**
   * Make the editor focused when the descriptor changes to focused
   */
  descriptorChanged(): void {
    if (this.props.descriptor.initialFocus) {
      window.requestAnimationFrame(() => this._editor.focus());
    }
  }

  render() {
    const placeholderStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      width: "100%",
      height: "100%",
      overflow: "hidden",
    };
    const options = {
      selectOnLineNumbers: true,
      glyphMargin: true,
    };

    const tone = getThemeService().getActiveTheme().tone;
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );
    let theme = tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && tone === "light") ||
      (languageInfo?.darkTheme && tone === "dark")
    ) {
      theme = `${this.props.language}-${tone}`;
    }
    return (
      <>
        <div ref={this.divHost} style={placeholderStyle}>
          {this.state.show && (
            <MonacoEditor
              language={this.props.language}
              theme={theme}
              value={this.props.sourceCode}
              options={options}
              onChange={(value, e) => this.onEditorContentsChange(value, e)}
              editorWillMount={(editor) => this.editorWillMount(editor)}
              editorDidMount={(editor, monaco) =>
                this.editorDidMount(editor, monaco)
              }
            />
          )}
        </div>
        <ReactResizeDetector
          handleWidth
          handleHeight
          onResize={() => {
            this._editor.layout();
          }}
        />
      </>
    );
  }

  async saveDocument(documentText: string): Promise<void> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "SaveFileContents",
      name: this.props.descriptor.id,
      contents: documentText,
    });
    if (result.error) {
      console.error(result.error);
    }
  }

  /**
   * Takes care that the editor's breakpoint decorations are updated
   * @param breakpoints Current breakpoints
   * @param compilation Current compilations
   */
  refreshBreakpoints(): void {
    const state = getState();
    const breakpoints = state.debugger?.breakpoints ?? [];
    const compilation = state.compilation;
    console.log("Refreshing breakpoints.");
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class EditorDocumentPanelDescriptor extends DocumentPanelDescriptorBase {
  constructor(
    id: string,
    title: string,
    public readonly language: string,
    public readonly contents: string
  ) {
    super(id, title);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return (
      <EditorDocument
        descriptor={this}
        sourceCode={this.contents}
        language={this.language}
      />
    );
  }
}

/**
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createBreakpointDecoration(
  lineNo: number
): monacoEditor.editor.IModelDeltaDecoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: "breakpointMargin",
    },
  };
}

/**
 * Creates a disabled breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createDisabledBreakpointDecoration(
  lineNo: number
): monacoEditor.editor.IModelDeltaDecoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: "disabledBreakpointMargin",
    },
  };
}

/**
 * Creates a disabled breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createCurrentBreakpointDecoration(
  lineNo: number
): monacoEditor.editor.IModelDeltaDecoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: true,
      className: "activeBreakpointLine",
      glyphMarginClassName: "activeBreakpointMargin",
    },
  };
}
