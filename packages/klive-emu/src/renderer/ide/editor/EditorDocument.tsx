import * as React from "react";

import {
  dispatch,
  getDocumentService,
  getState,
  getStore,
  getThemeService,
} from "@core/service-registry";

import { CSSProperties } from "styled-components";
import MonacoEditor from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import ReactResizeDetector from "react-resize-detector";
import { DocumentPanelDescriptorBase } from "../document-area/DocumentFactory";
import { FileOperationResponse } from "@core/messaging/message-types";
import { IDocumentPanel } from "@abstractions/document-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { getEditorService } from "./editorService";
import { findBreakpoint } from "@abstractions/debug-helpers";
import { SourceCodeBreakpoint } from "@abstractions/code-runner-service";
import {
  addBreakpointAction,
  removeBreakpointAction,
} from "@core/state/debugger-reducer";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type MarkdownString = monacoEditor.IMarkdownString;

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
  private _oldDecorations: string[] = [];
  private _oldHoverDecorations: string[] = [];

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

    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );

    if (languageInfo?.supportsBreakpoints) {
      const store = getStore();
      store.breakpointsChanged.on(this._refreshBreakpoints);
      store.compilationChanged.on(this._refreshBreakpoints);
      this._subscribedToBreakpointEvents = true;

      editor.onMouseDown((e) => this.handleEditorMouseDown(e));
      editor.onMouseMove((e) => this.handleEditorMouseMove(e));
      editor.onMouseLeave((e) => this.handleEditorMouseLeave(e));

      this.refreshBreakpoints();
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

    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );

    const options: monacoEditor.editor.IEditorOptions = {
      selectOnLineNumbers: true,
      glyphMargin: languageInfo?.supportsBreakpoints,
      hover: {
        enabled: true,
        delay: 5000,
        sticky: true,
      },
    };

    const tone = getThemeService().getActiveTheme().tone;
    let theme = tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && tone === "light") ||
      (languageInfo?.darkTheme && tone === "dark")
    ) {
      theme = `${this.props.language}-${tone}`;
    }
    console.log("render");
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
    const projPath = state?.project?.path;
    if (!projPath) {
      return;
    }

    // --- Filter for source code breakpoint belonging to this resoure
    const breakpoints = state.debugger?.breakpoints ?? [];
    const resource = this.props.descriptor.id.substr(projPath.length);
    const editorBps = breakpoints.filter(
      (bp) => bp.type === "source" && bp.resource === resource
    );
    const decorations = editorBps.map((bp) =>
      createBreakpointDecoration((bp as SourceCodeBreakpoint).line)
    );
    this._oldDecorations = this._editor.deltaDecorations(
      this._oldDecorations,
      decorations
    );
    // const compilation = state.compilation;
    console.log("Refreshing breakpoints.");
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  handleEditorMouseMove(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;
      this._oldHoverDecorations = this._editor.deltaDecorations(
        this._oldHoverDecorations,
        [createDisabledBreakpointDecoration(lineNo)]
      );
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      this._editor.deltaDecorations(this._oldHoverDecorations, []);
      console.log("Out", this._oldHoverDecorations);
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  handleEditorMouseLeave(e: monacoEditor.editor.IEditorMouseEvent): void {
    console.log(this._oldHoverDecorations);
    this._editor.deltaDecorations(this._oldHoverDecorations, []);
    console.log(this._oldHoverDecorations);
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  handleEditorMouseDown(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.target?.type === 2) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const newBp = this.createBreakpointForLine(lineNo);
      const existBp = this.findBreakpoint(lineNo);
      if (existBp) {
        dispatch(removeBreakpointAction(existBp));
      } else {
        dispatch(addBreakpointAction(newBp));
      }
    }
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  private createBreakpointForLine(line: number): SourceCodeBreakpoint | null {
    const state = getState();
    const projPath = state?.project?.path;
    if (!projPath) {
      return null;
    }
    return {
      type: "source",
      resource: this.props.descriptor.id.substr(projPath.length),
      line,
    };
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  private findBreakpoint(line: number): SourceCodeBreakpoint | null {
    const state = getState();
    const projPath = state?.project?.path;
    if (!projPath) {
      return null;
    }
    const newBp: SourceCodeBreakpoint = {
      type: "source",
      resource: this.props.descriptor.id.substr(projPath.length),
      line,
    };
    const breakpoints = state.debugger?.breakpoints ?? [];
    return findBreakpoint(breakpoints, newBp) as SourceCodeBreakpoint;
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
  lineNo: number,
  message?: string
): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: "breakpointMargin",
      glyphMarginHoverMessage: hoverMessage,
    },
  };
}

/**
 * Creates a disabled breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createDisabledBreakpointDecoration(lineNo: number): Decoration {
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
function createCurrentBreakpointDecoration(lineNo: number): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: true,
      className: "activeBreakpointLine",
      glyphMarginClassName: "activeBreakpointMargin",
    },
  };
}
