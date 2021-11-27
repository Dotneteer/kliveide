import * as React from "react";

import {
  dispatch,
  getDocumentService,
  getState,
  getStore,
  getThemeService,
} from "@core/service-registry";

import MonacoEditor, { monaco } from "react-monaco-editor";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
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
import {
  hideEditorStatusAction,
  showEditorStatusAction,
} from "@core/state/editor-status-reducer";
import {
  CSSProperties,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";
import { useResizeObserver } from "@components/useResizeObserver";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

// --- Shortcuts to Monaco editor types
type Editor = monacoEditor.editor.IStandaloneCodeEditor;
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
  registerApi?: (api: EditorDocumentAPi) => void;
}

// --- Represents the editor markers held by the code editor
const CODE_EDITOR_MARKERS = "CodeEditorMarkers";

export type EditorDocumentAPi = {
  getEditor: () => Editor;
  setPosition: (lineNumber: number, column: number) => void;
};

/**
 * Represents a Monaco code editor document
 */
function EditorDocument({
  descriptor,
  sourceCode,
  language,
  registerApi,
}: PropsWithChildren<Props>) {
  // --- Implicit state
  const divHost = useRef<HTMLDivElement>();
  const editor = useRef<Editor>();
  const subscribedToBreakpointEvents = useRef(false);
  const oldDecorations = useRef<string[]>([]);
  const oldHoverDecorations = useRef<string[]>([]);
  const oldExecPointDecoration = useRef<string[]>([]);
  const previousContent = useRef<string | null>(null);
  const editorPosUnsubscribe = useRef<monaco.IDisposable>();
  const unsavedChangeCounter = useRef(0);

  // --- Bind event handler function
  const _descriptorChanged = descriptorChanged;
  const _refreshBreakpoints = refreshBreakpoints;
  const _refreshErrorMarkers = refreshErrorMarkers;
  const _refreshCurrentBreakpoint = refreshCurrentBreakpoint;

  useEffect(() => {
    // --- Handle document descriptor and compilation changes
    const store = getStore();
    descriptor.documentDescriptorChanged.on(_descriptorChanged);
    store.compilationChanged.on(_refreshErrorMarkers);

    // --- When the editor is ready, set up its events
    if (editor.current) {
      connectEditorEvents(editor.current);
    }

    return () => {
      // --- Unsubscribe from document descriptor and compilation events
      descriptor.documentDescriptorChanged.off(_descriptorChanged);
      store.compilationChanged.off(_refreshErrorMarkers);

      // --- We do not need the editor events any more
      if (editor.current) {
        releaseEditorEvents(editor.current);
      }
    };
  });

  // --- The style of the <div> hosting the Monaco editor
  const placeholderStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  // --- Set up the editor according to the language
  const languageInfo = getDocumentService().getCustomLanguage(language);
  const options: monacoEditor.editor.IEditorOptions = {
    selectOnLineNumbers: true,
    glyphMargin: languageInfo?.supportsBreakpoints,
    hover: { enabled: true },
  };

  // --- Select the editor them according to the current application theme
  const tone = getThemeService().getActiveTheme().tone;
  let theme = tone === "light" ? "vs" : "vs-dark";
  if (
    (languageInfo?.lightTheme && tone === "light") ||
    (languageInfo?.darkTheme && tone === "dark")
  ) {
    theme = `${language}-${tone}`;
  }

  // --- Respond to resizing the main container
  useResizeObserver(divHost, () => editor.current?.layout());

  return (
    <>
      <div ref={divHost} style={placeholderStyle}>
        <MonacoEditor
          language={language}
          theme={theme}
          value={sourceCode}
          options={options}
          onChange={(value, e) => onEditorContentsChange(value, e)}
          editorWillMount={(editor) => editorWillMount(editor)}
          editorDidMount={(e, m) => editorDidMount(e, m)}
        />
      </div>
    </>
  );

  /**
   * Set up the Monaco editor before instantiating it
   * @param monaco
   */
  function editorWillMount(monaco: typeof monacoEditor): void {
    ensureLanguage(language);
  }

  /**
   * Ensures the specified language and its dependencies are registered
   * @param language
   */
  function ensureLanguage(language: string): void {
    if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
      // --- Do we support that custom language?
      const languageInfo = getDocumentService().getCustomLanguage(language);
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
        if (languageInfo.depensOn) {
          for (const dependOn of languageInfo.depensOn) {
            ensureLanguage(dependOn);
          }
        }
      }
    }
  }

  /**
   * Set up the editor after that has been instantiated
   */
  function editorDidMount(newEditor: Editor, monaco: typeof monacoEditor) {
    // --- Immediately register the API to communicate with the editor component
    registerApi?.({ setPosition, getEditor: () => newEditor });

    // --- Restore the previously saved state, provided we have one
    monaco.languages.setMonarchTokensProvider;
    if (editor.current) {
      editor.current.dispose();
    }
    editor.current = newEditor;
    const documentResource = descriptor.id;
    const state = getEditorService().loadState(documentResource);
    if (state) {
      newEditor.setValue(state.text);
      newEditor.restoreViewState(state.viewState);
    }

    // --- Indicate the editor position in the status bar
    const position = newEditor.getPosition();
    dispatch(showEditorStatusAction(position.lineNumber, position.column));

    // --- Take the focus, if the document want to have it
    if (descriptor.initialFocus) {
      window.requestAnimationFrame(() => newEditor.focus());
    }

    // --- Save the last value of the editor
    previousContent.current = newEditor.getValue();
  }

  /**
   * Set up editor events
   * @param editor Editor to set up
   */
  function connectEditorEvents(editor: Editor): void {
    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(language);
    if (languageInfo?.supportsBreakpoints) {
      // --- Yes, this document manages breakpoints
      const store = getStore();

      // --- Take care to refresh the breakpoint decorations whenever
      // --- breakpoints change
      store.breakpointsChanged.on(_refreshBreakpoints);
      store.executionStateChanged.on(_refreshCurrentBreakpoint);

      // --- Also, after a compilation, we have information about unreachable
      // --- breakpoints, refresh the decorations
      store.compilationChanged.on(_refreshBreakpoints);

      // --- As we subscribed to breakpoint-related events, when disposing the
      // --- component, we need to unsubscribe from them.
      subscribedToBreakpointEvents.current = true;

      // --- Handle mouse events
      editor.onMouseDown((e) => handleEditorMouseDown(e));
      editor.onMouseMove((e) => handleEditorMouseMove(e));
      editor.onMouseLeave((e) => handleEditorMouseLeave(e));

      // --- Display breakpoint and marker information
      requestAnimationFrame(() => {
        refreshBreakpoints();
        refreshErrorMarkers();
        refreshCurrentBreakpoint();
      });
    }

    // --- Handle editor position changes
    editorPosUnsubscribe.current = editor.onDidChangeCursorPosition((e) => {
      dispatch(
        showEditorStatusAction(e.position.lineNumber, e.position.column)
      );
    });
  }

  /**
   * Release editor events
   * @param editor Editor to release
   */
  function releaseEditorEvents(editor: Editor): void {
    if (subscribedToBreakpointEvents.current) {
      const store = getStore();

      // --- Take care to refresh the breakpoint decorations whenever
      // --- breakpoints change
      store.breakpointsChanged.off(_refreshBreakpoints);
      store.executionStateChanged.off(_refreshCurrentBreakpoint);

      // --- Also, after a compilation, we have information about unreachable
      // --- breakpoints, refresh the decorations
      store.compilationChanged.off(_refreshBreakpoints);
    }

    // --- Sign that no status will come from this editor
    dispatch(hideEditorStatusAction());
    if (editorPosUnsubscribe.current) {
      editorPosUnsubscribe.current.dispose();
    }
  }

  /**
   * Gets the resource name of this document
   */
  function getResourceName(): string {
    const projPath = getState().project.path;
    return descriptor.id.substr(projPath.length);
  }

  /**
   * Make the editor focused when the descriptor changes to focused
   */
  function descriptorChanged(): void {
    if (descriptor.initialFocus) {
      window.requestAnimationFrame(() => editor.current?.focus());
    }
  }

  /**
   * Respond to editor contents changes
   * @param _newValue New editor contents
   * @param e Description of changes
   */
  async function onEditorContentsChange(
    _newValue: string,
    e: monacoEditor.editor.IModelContentChangedEvent
  ) {
    // --- Remove the previous error markers
    const model = editor.current.getModel();
    monaco.editor.setModelMarkers(model, CODE_EDITOR_MARKERS, []);
    dispatch(resetCompileAction());

    // --- Make the document permanent in the document tab bar
    const documentService = getDocumentService();
    const currentDoc = documentService.getDocumentById(descriptor.id);
    if (currentDoc?.temporary) {
      // --- Make a temporary document permanent
      currentDoc.temporary = false;
      await documentService.registerDocument(currentDoc, true);
    }

    // --- Does the editor support breakpoints?
    const languageInfo = getDocumentService().getCustomLanguage(language);
    if (languageInfo?.supportsBreakpoints) {
      // --- Keep track of breakpoint changes
      if (e.changes.length > 0) {
        // --- Get the text that has been deleted
        const change = e.changes[0];
        const deletedText = monacoEditor.editor
          .createModel(previousContent.current)
          .getValueInRange(change.range);
        const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || [])
          .length;

        // --- Have we deleted one or more EOLs?
        if (deletedLines > 0) {
          // --- Yes, scroll up breakpoints
          const newBp = createBreakpointForLine(
            change.range.startLineNumber + deletedLines
          );
          dispatch(scrollBreakpointsAction(newBp, -deletedLines));
        }

        // --- Have we inserted one or more EOLs?
        const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || [])
          .length;
        if (insertedLines > 0) {
          // --- Yes, scroll down breakpoints.
          const newBp = createBreakpointForLine(
            change.range.startLineNumber +
              (change.range.startColumn === 1 ? 0 : 1)
          );
          dispatch(scrollBreakpointsAction(newBp, insertedLines));
        }

        // --- If changed, normalize breakpoints
        if (deletedLines > 0 || insertedLines > 0) {
          dispatch(
            normalizeBreakpointsAction(
              getResourceName(),
              editor.current.getModel().getLineCount()
            )
          );
        }
      }
    }

    // --- Save the current value as the previous one
    previousContent.current = editor.current.getValue();

    // --- Save document after the change (with delay)
    unsavedChangeCounter.current++;
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE));
    if (unsavedChangeCounter.current === 1 && previousContent.current) {
      await saveDocument(editor.current.getModel().getValue());
    }
    unsavedChangeCounter.current--;
  }

  /**
   * Saves the document to its file
   * @param documentText Document text to save
   */
  async function saveDocument(documentText: string): Promise<void> {
    const result = await sendFromIdeToEmu<FileOperationResponse>({
      type: "SaveFileContents",
      name: descriptor.id,
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
  function refreshBreakpoints(): void {
    // --- Filter for source code breakpoint belonging to this resoure
    const state = getState();
    const breakpoints = state.debugger?.breakpoints ?? [];
    const editorBps = breakpoints.filter(
      (bp) => bp.type === "source" && bp.resource === getResourceName()
    ) as SourceCodeBreakpoint[];

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = editor.current.getModel().getLineCount();
    editorBps.forEach((bp) => {
      let unreachable = false;
      if (compilationResult?.errors?.length === 0) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
          fi.filename.endsWith(getResourceName())
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
    oldDecorations.current = editor.current.deltaDecorations(
      oldDecorations.current,
      decorations
    );
  }

  /**
   * Refreshes the error markers
   */
  function refreshErrorMarkers(): void {
    // --- Check if we have any compilation errors
    const compilationResult = getState().compilation?.result;
    if (!compilationResult) {
      return;
    }

    // --- Convert errors to markers
    const model = editor.current.getModel();
    const markers = compilationResult.errors
      .filter((err) => err.fileName === descriptor.id)
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
   * Refreshes the current breakpoint
   * @returns
   */
  async function refreshCurrentBreakpoint(): Promise<void> {
    // --- Refresh the information only during paused state
    const state = getState();
    const compilationResult = state?.compilation?.result;
    const execState = state.emulatorPanel?.executionState ?? 0;
    if (
      execState !== 3 ||
      !compilationResult ||
      compilationResult.errors.length > 0
    ) {
      oldExecPointDecoration.current = editor.current.deltaDecorations(
        oldExecPointDecoration.current,
        []
      );
      return;
    }

    // --- Does this file contains the default breakpoint?
    const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
      fi.filename.endsWith(getResourceName())
    );
    if (fileIndex >= 0) {
      // --- We have address information for this source code file
      const lineInfo = compilationResult.listFileItems.find(
        (li) =>
          li.fileIndex === fileIndex &&
          li.address === state.emulatorPanel.programCounter
      );
      if (lineInfo) {
        oldExecPointDecoration.current = editor.current.deltaDecorations(
          oldExecPointDecoration.current,
          [createCurrentBreakpointDecoration(lineInfo.lineNumber)]
        );
      }
      return;
    }
    oldExecPointDecoration.current = editor.current.deltaDecorations(
      oldExecPointDecoration.current,
      []
    );
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  function handleEditorMouseMove(
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;
      const existBp = findSourceBreakpoint(lineNo);
      const message = `Click to ${
        existBp ? "remove the existing" : "add a new"
      } breakpoint`;
      oldHoverDecorations.current = editor.current.deltaDecorations(
        oldHoverDecorations.current,
        [createHoverBreakpointDecoration(lineNo, message)]
      );
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      editor.current.deltaDecorations(oldHoverDecorations.current, []);
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseLeave(
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    editor.current.deltaDecorations(oldHoverDecorations.current, []);
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseDown(
    e: monacoEditor.editor.IEditorMouseEvent
  ): void {
    if (e.target?.type === 2) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const newBp = createBreakpointForLine(lineNo);
      const existBp = findSourceBreakpoint(lineNo);
      if (existBp) {
        dispatch(removeBreakpointAction(existBp));
      } else {
        dispatch(addBreakpointAction(newBp));
      }
      handleEditorMouseLeave(e);
    }
  }

  /**
   * Sets the specified position
   * @param lineNumber Line number
   * @param column Column number
   */
  function setPosition(lineNumber: number, column: number): void {
    editor.current.revealPositionInCenter({ lineNumber, column });
    editor.current.setPosition({ lineNumber, column });
    window.requestAnimationFrame(() => editor.current.focus());
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  function createBreakpointForLine(line: number): SourceCodeBreakpoint | null {
    return {
      type: "source",
      resource: getResourceName(),
      line,
    };
  }

  /**
   * Tests if the breakpoint exists in the specified line
   * @param line Line number to test
   */
  function findSourceBreakpoint(line: number): SourceCodeBreakpoint | null {
    const newBp: SourceCodeBreakpoint = {
      type: "source",
      resource: getResourceName(),
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
  private _api: EditorDocumentAPi;
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
        registerApi={(api) => (this._api = api)}
      />
    );
  }

  /**
   * Navigates to the specified document location
   * @param location Document location
   */
  async navigateToLocation(location: NavigationInfo): Promise<void> {
    this._api?.setPosition(location.line, location.column);
  }

  /**
   * Allows saving the panel state
   */
  saveDocumentState(): void {
    if (!this._api) {
      // --- No API, no restore
      return;
    }

    // --- If so, save its state
    const editor = this._api.getEditor();
    const text = editor.getValue();
    getEditorService().saveState(this.id, {
      text,
      viewState: editor.saveViewState(),
    });
  }

  /**
   * Allows the panel to restore its state
   */
  restoreDocumentState(): void {
    // --- We restore the editor state after the editor component
    // --- has been mounted.
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
