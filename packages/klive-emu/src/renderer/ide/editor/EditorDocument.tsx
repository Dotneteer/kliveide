import * as React from "react";

import {
  dispatch,
  getDocumentService,
  getState,
  getStore,
  getThemeService,
} from "@core/service-registry";

import { CSSProperties } from "styled-components";
import MonacoEditor, { monaco } from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import ReactResizeDetector from "react-resize-detector";
import { DocumentPanelDescriptorBase } from "../document-area/DocumentFactory";
import { FileOperationResponse } from "@core/messaging/message-types";
import { IDocumentPanel, NavigationInfo } from "@abstractions/document-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { getEditorService } from "./editorService";
import { findBreakpoint } from "@abstractions/debug-helpers";
import { SourceCodeBreakpoint } from "@abstractions/code-runner-service";
import {
  addBreakpointAction,
  normalizeBreakpointsAction,
  removeBreakpointAction,
  scrollBreakpointsAction,
} from "@core/state/debugger-reducer";
import { resetCompileAction } from "@core/state/compilation-reducer";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

// --- Shortcuts to Monaco editor types
type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type MarkdownString = monacoEditor.IMarkdownString;
type MarkerData = monacoEditor.editor.IMarkerData;
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

// --- Represents the editor markers held by the code editor
const CODE_EDITOR_MARKERS = "CodeEditorMarkers";

/**
 * This component implements a document editor based on Monaco editor
 */
export default class EditorDocument extends React.Component<Props, State> {
  private divHost = React.createRef<HTMLDivElement>();
  private _editor: monacoEditor.editor.IStandaloneCodeEditor;
  private _unsavedChangeCounter = 0;
  private _descriptorChanged: () => void;
  private _refreshBreakpoints: () => void;
  private _refreshErrorMarkers: () => void;
  private _subscribedToBreakpointEvents = false;
  private _oldDecorations: string[] = [];
  private _oldHoverDecorations: string[] = [];
  private _previousContent: string | null = null;

  /**
   * Initializes the editor
   * @param props
   */
  constructor(props: Props) {
    super(props);
    this.state = {
      width: "100%",
      height: "100%",
      show: false,
    };

    // --- Bind these event handlers
    this._descriptorChanged = () => this.descriptorChanged();
    this._refreshBreakpoints = () => this.refreshBreakpoints();
    this._refreshErrorMarkers = () => this.refreshErrorMarkers();
  }

  /**
   * Gets the resource name of this document
   */
  get resourceName(): string {
    const projPath = getState().project.path;
    return this.props.descriptor.id.substr(projPath.length);
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
        // --- Yes, register the new language
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
    // --- Restore the previously saved state, provided we have one
    monaco.languages.setMonarchTokensProvider;
    this._editor = editor;
    const documentResource = this.props.descriptor.id;
    const state = getEditorService().loadState(documentResource);
    if (state) {
      this._editor.setValue(state.text);
      this._editor.restoreViewState(state.viewState);
    }

    // --- Take the focus, if the document want to have it
    if (this.props.descriptor.initialFocus) {
      window.requestAnimationFrame(() => this._editor.focus());
    }

    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );
    if (languageInfo?.supportsBreakpoints) {
      // --- Yes, this document manages breakpoints
      const store = getStore();

      // --- Take care to refresh the breakpoint decorations whenever
      // --- breakpoints change
      store.breakpointsChanged.on(this._refreshBreakpoints);

      // --- Also, after a compilation, we have information about unreachable
      // --- breakpoints, refresh the decorations
      store.compilationChanged.on(this._refreshBreakpoints);

      // --- As we subscribed to breakpoint-related events, when disposing the
      // --- component, we need to unsubscribe from them.
      this._subscribedToBreakpointEvents = true;

      // --- Handle mouse events
      editor.onMouseDown((e) => this.handleEditorMouseDown(e));
      editor.onMouseMove((e) => this.handleEditorMouseMove(e));
      editor.onMouseLeave((e) => this.handleEditorMouseLeave(e));

      // --- Display breakpoint and marker information
      this.refreshBreakpoints();
      this.refreshErrorMarkers();
    }

    // --- Save the last value of the editor
    this._previousContent = editor.getValue();
  }

  /**
   * Subscribes to events after the component has been mounted
   */
  componentDidMount(): void {
    this.setState({ show: true });
    this.props.descriptor.documentDescriptorChanged.on(this._descriptorChanged);
    getStore().compilationChanged.on(this._refreshErrorMarkers);
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
      store.compilationChanged.off(this._refreshErrorMarkers);
    }

    // --- Check if this document is still registered
    const docId = this.props.descriptor.id;
    const doc = getDocumentService().getDocumentById(docId);
    if (doc) {
      // --- If so, save its state
      const text = this._editor.getValue();
      getEditorService().saveState(this.props.descriptor.id, {
        text: this._editor.getValue(),
        viewState: this._editor.saveViewState(),
      });

      // --- If there are pending changes not saved yet, save now
      if (this._unsavedChangeCounter > 0) {
        await this.saveDocument(text);
      }
    }
  }

  /**
   * Render the component visuals
   */
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

  /**
   * Make the editor focused when the descriptor changes to focused
   */
  descriptorChanged(): void {
    if (this.props.descriptor.initialFocus) {
      window.requestAnimationFrame(() => this._editor.focus());
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
    // --- Remove the previous error markers
    const model = this._editor.getModel();
    monaco.editor.setModelMarkers(model, CODE_EDITOR_MARKERS, []);
    dispatch(resetCompileAction());

    // --- Make the document permanent in the document tab bar
    const documentService = getDocumentService();
    const currentDoc = documentService.getDocumentById(
      this.props.descriptor.id
    );
    if (currentDoc?.temporary) {
      // --- Make a temporary document permanent
      currentDoc.temporary = false;
      documentService.registerDocument(currentDoc, true);
    }

    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(
      this.props.language
    );
    if (languageInfo?.supportsBreakpoints) {
      // --- Keep track of breakpoint changes
      if (e.changes.length > 0) {
        // --- Get the text that has been deleted
        const change = e.changes[0];
        const deletedText = monacoEditor.editor
          .createModel(this._previousContent)
          .getValueInRange(change.range);
        const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || [])
          .length;

        // --- Have we deleted one or more EOLs?
        if (deletedLines > 0) {
          // --- Yes, scroll up breakpoints
          const newBp = this.createBreakpointForLine(
            change.range.startLineNumber + deletedLines
          );
          dispatch(scrollBreakpointsAction(newBp, -deletedLines));
        }

        // --- Have we inserted one or more EOLs?
        const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || [])
          .length;
        if (insertedLines > 0) {
          // --- Yes, scroll down breakpoints.
          const newBp = this.createBreakpointForLine(
            change.range.startLineNumber +
              (change.range.startColumn === 1 ? 0 : 1)
          );
          dispatch(scrollBreakpointsAction(newBp, insertedLines));
        }

        // --- If changed, normalize breakpoints
        if (deletedLines > 0 || insertedLines > 0) {
          dispatch(
            normalizeBreakpointsAction(
              this.resourceName,
              this._editor.getModel().getLineCount()
            )
          );
        }
      }
    }

    // --- Save the current value as the previous one
    this._previousContent = this._editor.getValue();

    // --- Save document after the change (with delay)
    this._unsavedChangeCounter++;
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE));
    if (this._unsavedChangeCounter === 1 && this._previousContent) {
      await this.saveDocument(this._editor.getModel().getValue());
    }
    this._unsavedChangeCounter--;
  }

  /**
   * Saves the document to its file
   * @param documentText Document text to save
   */
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
    // --- Filter for source code breakpoint belonging to this resoure
    const state = getState();
    const breakpoints = state.debugger?.breakpoints ?? [];
    const editorBps = breakpoints.filter(
      (bp) => bp.type === "source" && bp.resource === this.resourceName
    ) as SourceCodeBreakpoint[];

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = this._editor.getModel().getLineCount();
    editorBps.forEach((bp) => {
      let unreachable = false;
      if (compilationResult?.errors?.length === 0) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
          fi.filename.endsWith(this.resourceName)
        );
        if (fileIndex >= 0) {
          // --- We have address information for this source code file
          const bpInfo = compilationResult.listFileItems.find(
            (li) => li.fileIndex === fileIndex && li.lineNumber === bp.line
          );
          unreachable = !bpInfo;
        }
      }
      if (bp.line <= editorLines) {
        const decoration = unreachable
          ? createUnreachableBreakpointDecoration(bp.line)
          : createBreakpointDecoration(bp.line);
        decorations.push(decoration);
      } else {
        dispatch(removeBreakpointAction(bp));
      }
    });
    this._oldDecorations = this._editor.deltaDecorations(
      this._oldDecorations,
      decorations
    );
  }

  /**
   * Refreshes the error markers
   */
  refreshErrorMarkers(): void {
    // --- Check if we have any compilation errors
    const compilationResult = getState().compilation?.result;
    if (!compilationResult) {
      return;
    }

    // --- Convert errors to markers
    const model = this._editor.getModel();
    const markers = compilationResult.errors
      .filter((err) => err.fileName === this.props.descriptor.id)
      .map(
        (err) =>
          ({
            severity: monacoEditor.MarkerSeverity.Error,
            message: "Error",
            startLineNumber: err.line,
            endLineNumber: err.line,
            startColumn: err.startColumn,
            endColumn: err.endColumn,
          } as MarkerData)
      );
    monaco.editor.setModelMarkers(model, CODE_EDITOR_MARKERS, markers);
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  handleEditorMouseMove(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;
      const existBp = this.findBreakpoint(lineNo);
      const message = `Click to ${
        existBp ? "remove the existing" : "add a new"
      } breakpoint`;
      this._oldHoverDecorations = this._editor.deltaDecorations(
        this._oldHoverDecorations,
        [createHoverBreakpointDecoration(lineNo, message)]
      );
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      this._editor.deltaDecorations(this._oldHoverDecorations, []);
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  handleEditorMouseLeave(e: monacoEditor.editor.IEditorMouseEvent): void {
    this._editor.deltaDecorations(this._oldHoverDecorations, []);
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
      this.handleEditorMouseLeave(e);
    }
  }

  /**
   * Sets the specified position
   * @param lineNumber Line number
   * @param column Column number
   */
  setPosition(lineNumber: number, column: number): void {
    this._editor.revealPosition({ lineNumber, column });
    this._editor.setPosition({ lineNumber, column });
    window.requestAnimationFrame(() => this._editor.focus());
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  private createBreakpointForLine(line: number): SourceCodeBreakpoint | null {
    return {
      type: "source",
      resource: this.resourceName,
      line,
    };
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  private findBreakpoint(line: number): SourceCodeBreakpoint | null {
    const newBp: SourceCodeBreakpoint = {
      type: "source",
      resource: this.resourceName,
      line,
    };
    const breakpoints = getState().debugger?.breakpoints ?? [];
    return findBreakpoint(breakpoints, newBp) as SourceCodeBreakpoint;
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class EditorDocumentPanelDescriptor extends DocumentPanelDescriptorBase {
  private _host = React.createRef<EditorDocument>();
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
        ref={this._host}
        descriptor={this}
        sourceCode={this.contents}
        language={this.language}
      />
    );
  }

  /**
   * Navigates to the specified document location
   * @param location Document location
   */
  async navigateToLocation(location: NavigationInfo): Promise<void> {
    if (this._host) {
      this._host.current.setPosition(location.line, location.column);
    }
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
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createHoverBreakpointDecoration(
  lineNo: number,
  message?: string
): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: "hoverBreakpointMargin",
      glyphMarginHoverMessage: hoverMessage,
    },
  };
}

/**
 * Creates an unreachable breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createUnreachableBreakpointDecoration(lineNo: number): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: "unreachableBreakpointMargin",
    },
  };
}

/**
 * Creates a current breakpoint decoration
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
