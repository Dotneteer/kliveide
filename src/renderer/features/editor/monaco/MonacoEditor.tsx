import Editor from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";
import AutoSizer from "../../../../lib/react-virtualized-auto-sizer";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { useGlobalSetting, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { customLanguagesRegistry } from "@renderer/registry";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { addBreakpoint, getBreakpoints, removeBreakpoint } from "@renderer/appIde/utils/breakpoint-utils";
import styles from "./MonacoEditor.module.scss";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import {
  incBreakpointsVersionAction,
  incEditorVersionAction,
  startBackgroundCompileAction,
  setCursorPositionAction
} from "@common/state/actions";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import {
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { getIsWindows } from "@renderer/os-utils";
import { useEmuApi } from "@renderer/core/EmuApi";
import { createEmuApi } from "@common/messaging/EmuApi";
import { createMainApi } from "@common/messaging/MainApi";
import { useMainApi } from "@renderer/core/MainApi";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  SETTING_EDITOR_AUTOCOMPLETE,
  SETTING_EDITOR_DETECT_INDENTATION,
  SETTING_EDITOR_FONT_SIZE,
  SETTING_EDITOR_SELECTION_HIGHLIGHT,
  SETTING_EDITOR_INSERT_SPACES,
  SETTING_EDITOR_RENDER_WHITESPACE,
  SETTING_EDITOR_TABSIZE,
  SETTING_EDITOR_OCCURRENCES_HIGHLIGHT,
  SETTING_EDITOR_QUICK_SUGGESTION_DELAY,
  SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE
} from "@common/settings/setting-const";
import { Store } from "@common/state/redux-light";
import { AppState } from "@common/state/AppState";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { isDebuggableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";
import { languageIntelSingleton } from "@renderer/appIde/services/LanguageIntelService";
import { notifySemanticTokensChanged, type RenameEdit } from "@renderer/appIde/services/z80-providers";
import { initializeMonaco, isMonacoInitialized } from "./monacoBootstrap";
import {
  setMonacoExternalEditHandler,
  setMonacoNavigationHandler,
  setMonacoProviderStore
} from "./monacoGlobals";
import { applyExternalRenameEdits } from "./monacoExternalEdits";
import { applyMonacoUserOptions } from "./monacoEditorOptions";
import { registerMonacoDebugShortcuts } from "./monacoDebugShortcuts";

export { initializeMonaco } from "./monacoBootstrap";

let MAX_BP_UNDO_STACK = 64;

// --- We use these shortcuts in this file for Monaco types
type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type EditorDecorationsCollection = monacoEditor.editor.IEditorDecorationsCollection;
type MarkdownString = monacoEditor.IMarkdownString;


// --- This type represents the API that we can access from outside
export type EditorApi = DocumentApi & {
  setPosition(lineNo: number, column: number): void;
};

// --- Key to re-bind
const keysToRebind = [
  { key: monacoEditor.KeyCode.F1, shortCut: "F1" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F1, shortCut: "Shift+F1" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F1, shortCut: "Ctrl+F1" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F1, shortCut: "Alt+F1" },
  { key: monacoEditor.KeyCode.F2, shortCut: "F2" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F2, shortCut: "Shift+F2" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F2, shortCut: "Ctrl+F2" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F2, shortCut: "Alt+F2" },
  { key: monacoEditor.KeyCode.F3, shortCut: "F3" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F3, shortCut: "Shift+F3" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F3, shortCut: "Ctrl+F3" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F3, shortCut: "Alt+F3" },
  { key: monacoEditor.KeyCode.F4, shortCut: "F4" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F4, shortCut: "Shift+F4" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F4, shortCut: "Ctrl+F4" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F4, shortCut: "Alt+F4" },
  { key: monacoEditor.KeyCode.F5, shortCut: "F5" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F5, shortCut: "Shift+F5" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F5, shortCut: "Ctrl+F5" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F5, shortCut: "Alt+F5" },
  { key: monacoEditor.KeyCode.F6, shortCut: "F6" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F6, shortCut: "Shift+F6" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F6, shortCut: "Ctrl+F6" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F6, shortCut: "Alt+F6" },
  { key: monacoEditor.KeyCode.F7, shortCut: "F7" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F7, shortCut: "Shift+F7" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F7, shortCut: "Ctrl+F7" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F7, shortCut: "Alt+F7" },
  { key: monacoEditor.KeyCode.F8, shortCut: "F8" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F8, shortCut: "Shift+F8" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F8, shortCut: "Ctrl+F8" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F8, shortCut: "Alt+F8" },
  { key: monacoEditor.KeyCode.F9, shortCut: "F9" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F9, shortCut: "Shift+F9" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F9, shortCut: "Ctrl+F9" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F9, shortCut: "Alt+F9" },
  { key: monacoEditor.KeyCode.F10, shortCut: "F10" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F10, shortCut: "Shift+F10" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F10, shortCut: "Ctrl+F10" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F10, shortCut: "Alt+F10" },
  { key: monacoEditor.KeyCode.F11, shortCut: "F11" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F11, shortCut: "Shift+F11" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F11, shortCut: "Ctrl+F11" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F11, shortCut: "Alt+F11" },
  { key: monacoEditor.KeyCode.F12, shortCut: "F12" },
  { key: monacoEditor.KeyMod.Shift | monacoEditor.KeyCode.F12, shortCut: "Shift+F12" },
  { key: monacoEditor.KeyMod.WinCtrl | monacoEditor.KeyCode.F12, shortCut: "Ctrl+F12" },
  { key: monacoEditor.KeyMod.Alt | monacoEditor.KeyCode.F12, shortCut: "Alt+F12" }
];

// --- Monaco editor component properties
type EditorProps = {
  document: ProjectDocumentState;
  value: string;
  apiLoaded?: (api: EditorApi) => void;
  languageOverride?: string;
};

// --- This component wraps the Monaco editor
export const MonacoEditor = ({ document, value, apiLoaded, languageOverride }: EditorProps) => {
  // --- Monaco editor instance and related state variables
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  const mounted = useRef(false);

  // --- Keep track of the editors undo stack
  const undoStack = useRef<Map<string, BreakpointInfo[][]>>(new Map());
  const redoStack = useRef<Map<string, BreakpointInfo[][]>>(new Map());

  // --- Recognize app theme changes and update Monaco editor theme accordingly
  const { theme } = useTheme();
  const mainApi = useMainApi();
  const [monacoTheme, setMonacoTheme] = useState("");

  // --- Respond to editor font size change requests
  const editorFontSize = useGlobalSetting(SETTING_EDITOR_FONT_SIZE);

  // --- We use these services to respond to various IDE events
  const { store, messenger } = useRendererContext();
  const { projectService, ideCommandsService } = useAppServices();
  const emuApi = useEmuApi();

  // --- Recognize if something changed in the current document hub
  const documentHubService = useDocumentHubService();
  const hubVersion = useDocumentHubServiceVersion();

  // --- Use these state variables to manage breakpoints and their changes
  const breakpointsVersion = useSelector((s) => s.emulatorState.breakpointsVersion);
  const breakpoints = useRef<BreakpointInfo[]>([]);
  const compilation = useSelector((s) => s.compilation);
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const isProjectDebugging = useSelector((s) => s.emulatorState?.isProjectDebugging ?? false);

  // --- Store Monaco editor decorations to display breakpoint information
  const bpDecorations = useRef<EditorDecorationsCollection>(null);
  const hoverDecorations = useRef<EditorDecorationsCollection>(null);
  const execPointDecoration = useRef<EditorDecorationsCollection>(null);
  const errorWarningDecorations = useRef<EditorDecorationsCollection>(null);
  const refreshEditorBreakpoints = useRef<() => Promise<void>>(async () => undefined);

  // --- Debounce timer for background compilation (1200ms)
  const compileDebounce = useRef<ReturnType<typeof setTimeout>>(null);

  // --- True when a compile was requested while one was already in progress
  const pendingCompile = useRef(false);

  // --- The name of the resource this editor displays
  const resourceName = document.node?.projectPath;

  // --- The language to use with Monaco editor for syntax highlighting
  const [languageInfo, setLanguageInfo] = useState(
    customLanguagesRegistry.find((l) => l.id === document.language)
  );

  // --- Use these states to update editor options
  const enableAutoComplete = useGlobalSetting(SETTING_EDITOR_AUTOCOMPLETE);
  const insertSpaces = useGlobalSetting(SETTING_EDITOR_INSERT_SPACES);
  const renderWhitespaces = useGlobalSetting(SETTING_EDITOR_RENDER_WHITESPACE);
  const tabSize = useGlobalSetting(SETTING_EDITOR_TABSIZE);
  const detectIndentation = useGlobalSetting(SETTING_EDITOR_DETECT_INDENTATION);
  const enableSelectionHighlight = useGlobalSetting(SETTING_EDITOR_SELECTION_HIGHLIGHT);
  const enableOccurrencesHighlight = useGlobalSetting(SETTING_EDITOR_OCCURRENCES_HIGHLIGHT);
  const quickSuggestionDelay = useGlobalSetting(SETTING_EDITOR_QUICK_SUGGESTION_DELAY);
  const allowBackgroundCompile = useGlobalSetting(SETTING_EDITOR_ALLOW_BACKGROUND_COMPILE);

  // --- Background compilation
  const backgroundResult = useSelector((s) => s.compilation.backgroundResult);
  const backgroundInProgress = useSelector((s) => s.compilation.backgroundInProgress ?? false);

  // --- Language intelligence data (updated after each background compile)
  const languageIntel = useSelector((s) => s.compilation.languageIntel);

  // --- Keep the singleton intel service in sync with the latest compiled data
  useEffect(() => {
    if (languageIntel) {
      languageIntelSingleton.update(languageIntel);
      // Tell Monaco to re-request semantic tokens immediately
      notifySemanticTokensChanged();
    }
  }, [languageIntel]);

  // --- Wire the module-level cross-file navigation callback to this component's
  // --- ideCommandsService so that registerEditorOpener can open files in Klive.
  useEffect(() => {
    return setMonacoNavigationHandler((filePath: string, line: number) => {
      ideCommandsService.executeCommand(`nav "${filePath}" ${line}`);
    });
  }, [ideCommandsService]);

  // --- Wire the module-level store reference so that providers can read current state.
  useEffect(() => {
    return setMonacoProviderStore(store);
  }, [store]);

  // --- Wire the module-level cross-file rename callback so that the rename
  // --- provider can apply edits to files other than the currently open one.
  useEffect(() => {
    return setMonacoExternalEditHandler((edits: RenameEdit[]) => {
      void applyExternalRenameEdits(mainApi, projectService, edits);
    });
  }, [mainApi, projectService]);

  // --- Update editor file language changes
  useEffect(() => {
    setLanguageInfo(customLanguagesRegistry.find((l) => l.id === document.language));
  }, [document.language]);

  // --- Update user-controlled Monaco options when settings change.
  useEffect(() => {
    applyMonacoUserOptions(editor.current, {
      enableAutoComplete,
      insertSpaces,
      renderWhitespaces,
      tabSize,
      detectIndentation,
      enableSelectionHighlight,
      enableOccurrencesHighlight,
      quickSuggestionDelay
    });
  }, [
    enableAutoComplete,
    insertSpaces,
    renderWhitespaces,
    tabSize,
    detectIndentation,
    enableSelectionHighlight,
    enableOccurrencesHighlight,
    quickSuggestionDelay
  ]);

  // --- Respond to theme changes
  useEffect(() => {
    // --- Set the Monaco editor theme according to the document language
    const languageInfo = customLanguagesRegistry.find((l) => l.id === document.language);

    // --- Default theme name according to the Klive theme's tone
    let themeName = theme.tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && theme.tone === "light") ||
      (languageInfo?.darkTheme && theme.tone === "dark")
    ) {
      // --- The custom language supports the current theme
      themeName = `${languageInfo.id}-${theme.tone}`;
    }
    setMonacoTheme(themeName);
  }, [theme, document.language]);

  // --- Respond to readonly and locked document changes
  useEffect(() => {
    if (editor.current) {
      editor.current.updateOptions({
        readOnly: document.isReadOnly || (document.isLocked && isProjectDebugging)
      });
    }
  }, [document.isReadOnly, document.isLocked, isProjectDebugging]);

  // --- Keep the refresh callback current without making the trigger effect
  // --- depend on the large local breakpoint helper identities.
  refreshEditorBreakpoints.current = async () => {
    if (editor.current) {
      const bps = await refreshBreakpoints();
      await refreshCurrentBreakpoint(bps);
    }
  };

  // --- Refresh breakpoints when they may change
  useEffect(() => {
    void refreshEditorBreakpoints.current();
  }, [breakpointsVersion, compilation, execState, hubVersion]);

  useEffect(() => {
    // Clear previous decorations and model markers
    errorWarningDecorations.current?.clear();
    const currentModel = editor.current?.getModel();
    if (currentModel) {
      monacoEditor.editor.setModelMarkers(currentModel, "klive-z80", []);
    }

    // Don't proceed if no editor or no background result or if background compilation is disabled
    if (!editor.current || !backgroundResult || !allowBackgroundCompile) {
      return;
    }

    // Don't proceed if successful compilation or no errors
    if (
      backgroundResult.success ||
      !backgroundResult.errors ||
      backgroundResult.errors.length === 0
    ) {
      return;
    }

    // Get the current file path
    const currentFile = document.node?.projectPath;
    if (!currentFile) return;

    // Filter errors for the current file
    const fileErrors = backgroundResult.errors.filter((err) => err.filename.endsWith(currentFile));

    // Also collect invocation-site references embedded in messages of errors whose primary
    // filename is a different file (e.g. the macro body). The macro invocation prefix
    // written by buildMacroInvocationPrefix contains `at <file>:<line>:<col>` entries.
    type InvocationRef = { line: number; col: number; message: string; isWarning: boolean };
    const invocationRefs: InvocationRef[] = [];
    const atRef = /\bat\s+(\S+?):(\d+):(\d+)/g;
    backgroundResult.errors.forEach((err) => {
      if (err.filename.endsWith(currentFile)) return; // already handled by fileErrors
      atRef.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = atRef.exec(err.message)) !== null) {
        if (m[1].endsWith(currentFile)) {
          invocationRefs.push({
            line: parseInt(m[2], 10),
            col: parseInt(m[3], 10) + 1, // startColumn is 0-based; Monaco is 1-based
            message: err.message,
            isWarning: !!err.isWarning
          });
        }
      }
    });

    if (fileErrors.length === 0 && invocationRefs.length === 0) return;

    const model = editor.current.getModel();
    if (!model) return;

    const markers: monacoEditor.editor.IMarkerData[] = [];
    const afterDecorations: Decoration[] = [];

    // Helper that computes start/end column for a marker on a given line
    const getLineCols = (lineNo: number): { startCol: number; endCol: number } => {
      let startCol = 1;
      if (lineNo <= model.getLineCount()) {
        const lineContent = model.getLineContent(lineNo);
        const match = lineContent.match(/\S/);
        startCol = match ? (match.index ?? 0) + 1 : 1;
      }
      let endCol = startCol + 1;
      if (lineNo <= model.getLineCount()) {
        endCol = model.getLineLength(lineNo) + 1;
      }
      if (endCol <= startCol) endCol = startCol + 1;
      return { startCol, endCol };
    };

    fileErrors.forEach((err) => {
      const lineNo = err.line || 1;
      const isWarning = err.isWarning;
      const { startCol, endCol } = getLineCols(lineNo);

      // Standard Monaco marker: squiggles + scrollbar overview ruler + minimap + hover tooltip
      markers.push({
        severity: isWarning
          ? monacoEditor.MarkerSeverity.Warning
          : monacoEditor.MarkerSeverity.Error,
        message: err.message || "Issue detected",
        startLineNumber: lineNo,
        startColumn: startCol,
        endLineNumber: lineNo,
        endColumn: endCol
      });

      // Custom inline pill/badge displayed after the line content
      afterDecorations.push({
        range: new monacoEditor.Range(lineNo, startCol, lineNo, endCol),
        options: {
          after: {
            content: err.message || "Issue detected",
            inlineClassName: isWarning ? styles.warningIcon : styles.errorIcon
          },
          isWholeLine: false
        }
      });
    });

    // Add markers for invocation sites found in macro error message prefixes
    invocationRefs.forEach(({ line: lineNo, col: startColHint, message, isWarning }) => {
      const { startCol, endCol } = getLineCols(lineNo);
      // Use the startCol from the message if it's more precise than the line's first non-ws
      const col = Math.max(startColHint, startCol);
      markers.push({
        severity: isWarning
          ? monacoEditor.MarkerSeverity.Warning
          : monacoEditor.MarkerSeverity.Error,
        message,
        startLineNumber: lineNo,
        startColumn: col,
        endLineNumber: lineNo,
        endColumn: endCol
      });
      afterDecorations.push({
        range: new monacoEditor.Range(lineNo, col, lineNo, endCol),
        options: {
          after: {
            content: message,
            inlineClassName: isWarning ? styles.warningIcon : styles.errorIcon
          },
          isWholeLine: false
        }
      });
    });

    monacoEditor.editor.setModelMarkers(model, "klive-z80", markers);
    if (afterDecorations.length > 0) {
      errorWarningDecorations.current = editor.current.createDecorationsCollection(afterDecorations);
    }

    // --- If a compile was requested while this one was in progress, start it now
    if (pendingCompile.current) {
      pendingCompile.current = false;
      startBackgroundCompile(store, mainApi, allowBackgroundCompile);
    }
  }, [backgroundResult, document.node?.projectPath, allowBackgroundCompile, mainApi, store]);

  useEffect(() => {
    if (store && mainApi) {
      startBackgroundCompile(store, mainApi, allowBackgroundCompile);
    }
  }, [store, mainApi, allowBackgroundCompile]);

  // --- Initializes the editor when mounted
  const onMount = (ed: monacoEditor.editor.IStandaloneCodeEditor, _: typeof monacoEditor): void => {
    // --- Restore the view state to display the editor is it has been left
    mounted.current = false;
    editor.current = ed;

    // --- We need to add these commands to the editor to be able to use the shortcuts.
    // --- Otherwise, the v0.46.0 Monaco editor will not work properly with Electron v0.35.1.
    ed.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyY, () =>
      ed.trigger("keyboard", "redo", null)
    );

    // --- Clipboard handling for the entire Monaco editor (both the code area and
    // --- widget inputs like Find/Replace and Rename).
    // --- In Electron, native Cmd+C/V/X/A don't work. Monaco's addCommand always
    // --- targets the editor model regardless of which element has focus, so we use
    // --- a capture-phase DOM listener on the editor container instead.
    const editorDom = ed.getContainerDomNode();
    const clipboardHandler = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v" && key !== "x" && key !== "a") return;

      const activeEl = window.document.activeElement;
      const isWidgetInput = activeEl?.tagName === "INPUT" || 
        (activeEl?.tagName === "TEXTAREA" && !activeEl.classList.contains("inputarea"));

      if (isWidgetInput) {
        // --- The focused element is a widget input (Find/Replace, Rename, etc.)
        const input = activeEl as HTMLInputElement;
        e.preventDefault();
        e.stopImmediatePropagation();

        if (key === "c") {
          const text = input.value.slice(
            input.selectionStart ?? 0,
            input.selectionEnd ?? input.value.length
          );
          if (text) await navigator.clipboard.writeText(text);
        } else if (key === "v") {
          const clipText = await navigator.clipboard.readText();
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          input.focus();
          input.setSelectionRange(start, end);
          window.document.execCommand("insertText", false, clipText);
        } else if (key === "x") {
          const text = input.value.slice(
            input.selectionStart ?? 0,
            input.selectionEnd ?? input.value.length
          );
          if (text) await navigator.clipboard.writeText(text);
          window.document.execCommand("delete");
        } else if (key === "a") {
          input.select();
        }
      } else {
        // --- The code editor text area has focus
        e.preventDefault();
        e.stopImmediatePropagation();

        if (key === "c") {
          const selection = ed.getSelection();
          const text = ed.getModel()?.getValueInRange(selection);
          if (text) navigator.clipboard.writeText(text);
        } else if (key === "v") {
          let text = await navigator.clipboard.readText();
          text = text.replace(/\r?\n/g, "\r");
          ed.trigger("keyboard", "type", { text });
        } else if (key === "x") {
          const selection = ed.getSelection();
          const text = ed.getModel()?.getValueInRange(selection);
          if (text) {
            navigator.clipboard.writeText(text);
            ed.executeEdits("clipboard", [{
              range: selection,
              text: "",
              forceMoveMarkers: true
            }]);
          }
        } else if (key === "a") {
          const model = ed.getModel();
          if (model) {
            ed.setSelection(model.getFullModelRange());
          }
        }
      }
    };
    editorDom.addEventListener("keydown", clipboardHandler, true);

    const saveViewState = () => {
      if (mounted.current) {
        const viewState = ed.saveViewState();
        documentHubService.setDocumentViewState(document.id, viewState);
      }
    };

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    disposables.push(
      ed.onMouseDown(handleEditorMouseDown),
      ed.onMouseLeave(handleEditorMouseLeave),
      ed.onMouseMove(handleEditorMouseMove),
      ed.onDidChangeCursorPosition(saveViewState),
      ed.onDidChangeCursorSelection(saveViewState),
      ed.onDidScrollChange(saveViewState),
      ed.onDidBlurEditorWidget(saveViewState),
      ed.onDidChangeCursorPosition((e) => {
        documentHubService.saveActiveDocumentPosition(e.position.lineNumber, e.position.column);
        store.dispatch(incEditorVersionAction());
        store.dispatch(setCursorPositionAction(e.position.lineNumber, e.position.column));
      })
    );

    // --- Create the API
    const editorApi: EditorApi = {
      // --- Before disposing the document, save its state
      beforeDocumentDisposal: async () => {
        if (document.savedVersionCount === document.editVersionCount) return;

        // --- Save the contents back to the document instance
        document.contents = editor.current.getModel()?.getValue();

        // --- Now, save it back to the file
        await projectService.saveFileContent(document.id, document.contents);
        document.savedVersionCount = document.editVersionCount;
        store.dispatch(incEditorVersionAction());
      },

      // --- Reload content from external file change
      reloadContent: (contents: string | Uint8Array) => {
        if (typeof contents === "string") {
          const model = editor.current.getModel();
          if (model) {
            // Save current cursor position
            const position = editor.current.getPosition();
            const selection = editor.current.getSelection();

            // Update content
            model.setValue(contents);

            // Restore cursor position if possible
            if (position) {
              editor.current.setPosition(position);
              if (selection) {
                editor.current.setSelection(selection);
              }
            }

            // Update document state
            document.contents = contents;
            document.savedVersionCount = document.editVersionCount;
            store.dispatch(incEditorVersionAction());
          }
        }
      },

      // --- Editor API specific
      setPosition: (lineNumber: number, column: number) => {
        ed.revealLineInCenter(lineNumber);
        ed.setPosition({ lineNumber, column });
        ed.focus();
        store.dispatch(incEditorVersionAction());
      }
    };

    // --- Pass back the API so that the document hub service can use it
    apiLoaded?.(editorApi);

    const viewState = documentHubService.getDocumentViewState(document.id);
    if (viewState) {
      ed.restoreViewState(viewState);
    }

    // --- Set the editor's user-controlled options
    applyMonacoUserOptions(ed, {
      enableAutoComplete,
      insertSpaces,
      renderWhitespaces,
      tabSize,
      detectIndentation,
      enableSelectionHighlight,
      enableOccurrencesHighlight,
      quickSuggestionDelay
    });

    void registerMonacoDebugShortcuts(ed, mainApi, emuApi, store, keysToRebind);

    // --- Focus the editor
    ed.focus();

    // --- Dispose event handlers when the editor is about to dispose
    editor.current.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      editorDom.removeEventListener("keydown", clipboardHandler, true);
    });

    mounted.current = true;

    // --- Nudge Monaco to re-apply semantic tokens immediately (avoids the
    // --- colour-shift delay that's visible after switching back to this tab)
    setTimeout(() => notifySemanticTokensChanged(), 0);

    // --- Start background compilation
    startBackgroundCompile(store, mainApi, allowBackgroundCompile);

    // --- Show breakpoints and other decorations when initially displaying the editor
    (async () => {
      const bps = await refreshBreakpoints();
      await refreshCurrentBreakpoint(bps);
    })();
  };

  // --- Handle document changes
  const onValueChanged = async (_: string, e: monacoEditor.editor.IModelContentChangedEvent) => {
    // --- Now, make this document permanent
    projectService.setPermanent(document.id);

    // --- Handle breakpoint redos and undos
    const resourceKey = `${editor.current.getId()}-${resourceName}`;
    if (e.isUndoing) {
      // --- Undo the breakpoints
      const currentSet = undoStack.current.get(resourceKey);
      if (currentSet && currentSet.length > 0) {
        // --- We have a set of breakpoints to restore, get it from the stack
        const lastSet = currentSet.pop();

        // --- Restore the previous breakpoints
        await createEmuApi(messenger).resetBreakpointsTo(lastSet);

        // --- Update the redo stack
        let currentRedo = redoStack.current.get(resourceKey);
        if (!currentRedo) {
          currentRedo = [];
          redoStack.current.set(resourceKey, currentRedo);
        }
        currentRedo.push(lastSet);

        // --- Keep the redo length limit
        if (currentRedo.length > MAX_BP_UNDO_STACK) {
          currentRedo.shift();
        }
      }
    } else if (e.isRedoing) {
      // --- Redo the breakpoints
      const currentSet = redoStack.current.get(resourceKey);
      if (currentSet && currentSet.length > 0) {
        // --- We have a set of breakpoints to restore, get it from the stack
        const lastSet = currentSet.pop();

        // --- Restore the previous breakpoints
        await createEmuApi(messenger).resetBreakpointsTo(lastSet);

        // --- Update the undo stack
        let currentUndo = undoStack.current.get(resourceKey);
        if (!currentUndo) {
          currentUndo = [];
          undoStack.current.set(resourceKey, currentUndo);
        }
        currentUndo.push(lastSet);

        // --- Keep the redo length limit
        if (currentUndo.length > MAX_BP_UNDO_STACK) {
          currentUndo.shift();
        }
      }
    } else {
      // --- We are executing a normal (not redo or undo) operation
      // --- Get the current set of breakpoints
      const breakpoints = await getBreakpoints(messenger);

      // --- Get the undo stack of this document
      let currentSet = undoStack.current.get(resourceKey);
      if (!currentSet) {
        currentSet = [];
        undoStack.current.set(resourceKey, currentSet);
      }

      // --- Push the current breakpoints to the undo stack
      currentSet.push(breakpoints);

      // --- Keep the undo length limit
      if (currentSet.length > MAX_BP_UNDO_STACK) {
        currentSet.shift();
      }

      // --- Does the editor support breakpoints?
      if (languageInfo?.supportsBreakpoints) {
        // --- Keep track of breakpoint changes
        if (e.changes.length > 0) {
          // --- Special case: after changing to readonly, the editor signals
          // --- that the entire text has been changed.
          const currentText = editor.current.getModel().getValue();
          if (currentText !== e.changes?.[0].text) {
            // --- A real change has happened
            // --- Get the text that has been deleted
            const change = e.changes[0];
            const deletedText = editor.current.getModel().getValueInRange(change.range);
            const deletedLines = (deletedText.match(new RegExp(e.eol, "g")) || []).length;

            // --- Have we deleted one or more EOLs?
            if (deletedLines > 0) {
              const lowerBound =
                change.range.startLineNumber + (change.range.startColumn === 1 ? 0 : 1);
              const upperBound = change.range.endLineNumber;

              // --- Yes, scroll up breakpoints
              await createEmuApi(messenger).scrollBreakpoints(
                {
                  resource: resourceName,
                  line: lowerBound
                },
                -deletedLines,
                lowerBound,
                upperBound
              );
            }

            // --- Have we inserted one or more EOLs?
            const insertedLines = (change.text.match(new RegExp(e.eol, "g")) || []).length;
            if (insertedLines > 0) {
              // --- Yes, scroll down breakpoints.
              const lineText = editor.current
                .getModel()
                .getLineContent(change.range.startLineNumber);
              const shouldShiftDown = lineText?.trim().length === 0;
              await createEmuApi(messenger).scrollBreakpoints(
                {
                  resource: resourceName,
                  line: change.range.startLineNumber + (shouldShiftDown ? 0 : 1)
                },
                insertedLines
              );
            }

            // --- If changed, normalize breakpoints
            await createEmuApi(messenger).normalizeBreakpoints(
              resourceName,
              editor.current.getModel()?.getLineCount() ?? -1
            );
          }
        }
      }
    }

    // --- Save the contents back to the document instance
    document.contents = editor.current.getModel()?.getValue();
    document.editVersionCount++;
    store.dispatch(incEditorVersionAction());

    // --- Now, save it back to the file
    await projectService.saveFileContentAsYouType(document.id, document.contents).then(
      () => {
        document.savedVersionCount = document.editVersionCount;
        store.dispatch(incEditorVersionAction());
      },
      (reason) => {
        if (reason !== "canceled") reportError(reason);
      }
    );

    // --- Start background compilation (debounced to prevent multiple rapid compilations)
    clearTimeout(compileDebounce.current);
    compileDebounce.current = setTimeout(() => {
      if (backgroundInProgress) {
        // A compile is already running — mark that we need another one when it finishes
        pendingCompile.current = true;
      } else {
        pendingCompile.current = false;
        startBackgroundCompile(store, mainApi, allowBackgroundCompile);
      }
    }, 1200);
  };

  // --- render the editor when monaco has been initialized
  return isMonacoInitialized() ? (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            readOnly: document.isReadOnly || (isProjectDebugging && document.isLocked),
            glyphMargin: languageInfo?.supportsBreakpoints,
            "semanticHighlighting.enabled": true,
            overviewRulerBorder: true
          }}
          loading=""
          width={width}
          height={height}
          key={document.id}
          language={languageOverride ?? document.language}
          theme={monacoTheme}
          value={value}
          path={document.id}
          keepCurrentModel={true}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
  ) : null;

  /**
   * Takes care that the editor's breakpoint decorations are updated
   * @param breakpoints Current breakpoints
   * @param compilation Current compilations
   */
  async function refreshBreakpoints(): Promise<BreakpointInfo[]> {
    // --- Filter for source code breakpoints belonging to this resource
    const state = store.getState();
    const bps = (breakpoints.current = await getBreakpoints(messenger));

    // --- Get the active compilation result
    const compilationResult = state?.compilation?.result;

    // --- Create the array of decorators
    const decorations: Decoration[] = [];
    const editorLines = editor.current?.getModel()?.getLineCount() ?? null;

    // --- Iterate through all breakpoins using this file's resource name as a filter
    const resourceName = getResourceName();
    bps.forEach(async (bp) => {
      let unreachable = true;
      if (
        compilationResult?.errors?.length === 0 &&
        isDebuggableCompilerOutput(compilationResult)
      ) {
        // --- In case of a successful compilation, test if the breakpoint is allowed
        const sep = getIsWindows() ? "\\" : "/";
        const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
          fi.filename.replaceAll(sep, "/").endsWith(resourceName)
        );
        if (fileIndex >= 0) {
          // --- We have address information for this source code file
          if (bp.resource) {
            // --- This is a source code breakpoint
            const bpInfo = compilationResult.listFileItems.find(
              (li) => li.fileIndex === fileIndex && li.lineNumber === bp.line
            );

            // --- Check if the breakpoint is reachable (a single label, for example, is not)
            unreachable = !bpInfo;
          } else if (bp.address != undefined) {
            // --- This is a binary breakpoint
            const bpInfo = compilationResult.sourceMap[bp.address];
            if (bpInfo) {
              if (bpInfo.fileIndex === fileIndex) {
                decorations.push(createBinaryBreakpointDecoration(bpInfo.line, bp.disabled));
              }
            }
          }
        }
      }

      // --- Render the breakpoint according to its type and reachability
      if (editorLines !== null && bp.resource === resourceName.slice(1)) {
        if (bp.line <= editorLines) {
          let decoration: monacoEditor.editor.IModelDeltaDecoration;
          if (bp.disabled) {
            decoration = createCodeBreakpointDecoration(bp.line, true);
          } else if (unreachable) {
            decoration = createUnreachableBreakpointDecoration(bp.line);
          } else {
            // --- Check if there is a binary breakpoint
            const binBp = bps.find((b) => b.address === bp.resolvedAddress);
            decoration = binBp
              ? createBinaryBreakpointDecoration(bp.line, false)
              : createCodeBreakpointDecoration(bp.line, false);
          }
          decorations.push(decoration);
        } else if (bp.resource && bp.resource === document.node.projectPath) {
          // --- Remove the source code breakpoint exceeding the source code range
          await removeBreakpoint(messenger, bp);
        }
      }
    });

    if (bpDecorations.current) {
      bpDecorations.current.clear();
    }
    bpDecorations.current = editor.current.createDecorationsCollection(decorations);
    return bps;
  }

  /**
   * Handles the editor's mousemove event
   * @param e
   */
  async function handleEditorMouseMove(e: monacoEditor.editor.IEditorMouseEvent): Promise<void> {
    if (e.target?.type === 2) {
      // --- Mouse is over the margin, display the breakpoint placeholder
      const lineNo = e.target.position.lineNumber;

      // --- Check if there is an existing breakpoint at this line
      const existingBp = breakpoints.current.find(
        (bp) => bp.resource === resourceName && bp.line === lineNo
      );
      if (!existingBp && languageInfo?.instantSyntaxCheck) {
        // --- No existing breakpoint, alllow creating one, if the source code has anything here
        const lineContent = editor.current.getModel().getLineContent(lineNo);
        const allowBp = await createMainApi(messenger).canLineHaveBreakpoint(
          lineContent,
          languageInfo.id
        );
        if (!allowBp) {
          const message = "You cannot create a breakpoint here";
          hoverDecorations.current?.clear();
          hoverDecorations.current = editor.current.createDecorationsCollection([
            createHoverDisabledBreakpointDecoration(lineNo, message)
          ]);
          return;
        }
      }

      // --- Display the message
      hoverDecorations.current?.clear();
      const message = `Click to ${existingBp ? "remove the existing" : "add a new"} breakpoint`;
      hoverDecorations.current = editor.current.createDecorationsCollection([
        createHoverBreakpointDecoration(lineNo, message)
      ]);
    } else {
      // --- Mouse is out of margin, remove the breakpoint placeholder
      hoverDecorations.current?.clear();
    }
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseLeave(_e: monacoEditor.editor.IEditorMouseEvent): void {
    hoverDecorations.current?.clear();
  }

  /**
   * Handles the editor's mouseleave event
   * @param e
   */
  function handleEditorMouseDown(e: monacoEditor.editor.IEditorMouseEvent): void {
    if (e.event.leftButton && e.target?.type === 2) {
      // --- Breakpoint glyph is clicked
      const lineNo = e.target.position.lineNumber;
      const existingBp = breakpoints.current.find(
        (bp) => bp.resource === document.node?.projectPath && bp.line === lineNo
      );
      (async () => {
        if (existingBp) {
          await removeBreakpoint(messenger, existingBp);
        } else {
          // --- Check if this is a valid location for a breakpoint
          let allow = !languageInfo?.instantSyntaxCheck;
          if (!allow) {
            const lineContent = editor.current.getModel().getLineContent(lineNo);
            allow = await createMainApi(messenger).canLineHaveBreakpoint(
              lineContent,
              languageInfo.id
            );
          }
          if (allow) {
            await addBreakpoint(messenger, {
              resource: resourceName,
              line: lineNo,
              exec: true
            });
            await refreshSourceCodeBreakpoints(store, messenger);
            store.dispatch(incBreakpointsVersionAction());
            handleEditorMouseLeave(e);
          }
        }
      })();
    }
  }

  /**
   * Gets the resource name of this document
   */
  function getResourceName(): string {
    const projPath = store.getState().project?.folderPath;
    return document.id.substring(projPath?.length);
  }

  /**
   * Refreshes the current breakpoint
   * @returns
   */
  async function refreshCurrentBreakpoint(bps: BreakpointInfo[]): Promise<void> {
    // --- No editor, no decorations
    if (!editor.current) {
      return;
    }

    // --- No output with debug information, no decorations
    if (!isDebuggableCompilerOutput(compilation.result)) {
      return;
    }

    // --- Store the decorations
    const decorations: Decoration[] = [];

    // --- Get the current PC value
    const cpuStateResponse = await emuApi.getCpuState();
    const pc = cpuStateResponse.pc;

    // --- Is the machine running?
    const machineState = store.getState().emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState == MachineControllerState.Paused
    ) {
      // --- Does this file contains the default breakpoint?
      const sep = getIsWindows() ? "\\" : "/";
      const fileIndex = compilation.result.sourceFileList.findIndex((fi) =>
        fi.filename.replaceAll(sep, "/").endsWith(getResourceName())
      );
      if (fileIndex >= 0) {
        // --- We have address information for this source code file
        // --- Get source map information
        const sourceMapInfo = compilation.result.sourceMap[pc];

        // --- Check for the active breakpoint line
        const lineInfo = compilation.result.listFileItems.find(
          (li) => li.fileIndex === fileIndex && li.address === pc && !li.isMacroInvocation
        );

        if (lineInfo) {
          const resName = getResourceName()?.slice(1);
          const activeBp = bps.find(
            (bp) =>
              (bp.line === lineInfo.lineNumber && bp.resource === resName) || bp.address === pc
          );
          decorations.push(
            createCurrentBreakpointDecoration(
              languageInfo.fullLineBreakpoints,
              lineInfo.lineNumber,
              sourceMapInfo?.startColumn,
              sourceMapInfo?.endColumn,
              activeBp
            )
          );
        }

        // --- Check for active macro invocation line
        const macroInvocationlineInfo = compilation.result.listFileItems.find(
          (li) => li.fileIndex === fileIndex && li.address === pc && li.isMacroInvocation
        );

        if (macroInvocationlineInfo) {
          const resName = getResourceName()?.slice(1);
          const activeBp = bps.find(
            (bp) =>
              (bp.line === macroInvocationlineInfo.lineNumber && bp.resource === resName) ||
              bp.address === pc
          );
          decorations.push(
            createCurrentMacroInvocationBreakpointDecoration(
              languageInfo.fullLineBreakpoints,
              macroInvocationlineInfo.lineNumber,
              sourceMapInfo?.startColumn,
              sourceMapInfo?.endColumn,
              activeBp
            )
          );
        }
      }
    }

    if (execPointDecoration.current) {
      execPointDecoration.current.clear();
    }
    execPointDecoration.current = editor.current.createDecorationsCollection(decorations);
  }
};

/**
 * Creates a code breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createCodeBreakpointDecoration(lineNo: number, disabled: boolean): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled ? styles.disabledBreakpointMargin : styles.codeBreakpointMargin
    }
  };
}

/**
 * Creates a binary breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createBinaryBreakpointDecoration(lineNo: number, disabled: boolean): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: disabled
        ? styles.disabledBreakpointMargin
        : styles.binaryBreakpointMargin
    }
  };
}

/**
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createHoverBreakpointDecoration(lineNo: number, message?: string): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: styles.hoverBreakpointMargin,
      glyphMarginHoverMessage: hoverMessage
    }
  };
}

/**
 * Creates a breakpoint decoration
 * @param lineNo Line to apply the decoration to
 */
function createHoverDisabledBreakpointDecoration(lineNo: number, message?: string): Decoration {
  const hoverMessage: MarkdownString = message ? { value: message } : null;
  return {
    range: new monacoEditor.Range(lineNo, 1, lineNo, 1),
    options: {
      isWholeLine: false,
      glyphMarginClassName: styles.disabledHoverBreakpointMargin,
      glyphMarginHoverMessage: hoverMessage
    }
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
      glyphMarginClassName: styles.unreachableBreakpointMargin
    }
  };
}

/**
 * Creates a current breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createCurrentBreakpointDecoration(
  fullLine: boolean,
  lineNo: number,
  startColumn?: number,
  endColumn?: number,
  activeBp?: BreakpointInfo
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, startColumn ?? 1, lineNo, (endColumn ?? 1) + 1),
    options: {
      isWholeLine: fullLine,
      className: styles.activeBreakpointLine,
      glyphMarginClassName: activeBp
        ? activeBp.address !== undefined
          ? styles.activeBinBreakpointOnExistingMargin
          : styles.activeBreakpointOnExistingMargin
        : styles.activeBreakpointMargin
    }
  };
}

/**
 * Creates a current breakpoint decoration
 * @param lineNo Line to apply the decoration to
 * @returns
 */
function createCurrentMacroInvocationBreakpointDecoration(
  fullLine: boolean,
  lineNo: number,
  startColumn?: number,
  endColumn?: number,
  activeBp?: BreakpointInfo
): Decoration {
  return {
    range: new monacoEditor.Range(lineNo, startColumn ?? 1, lineNo, (endColumn ?? 1) + 1),
    options: {
      isWholeLine: fullLine,
      className: styles.activeMacroInvocationLine,
      glyphMarginClassName: activeBp
        ? activeBp.address !== undefined
          ? styles.activeMacroBinBreakpointOnExistingMargin
          : styles.activeMacroBreakpointOnExistingMargin
        : styles.activeMacroBreakpointMargin
    }
  };
}

// --- Compile the current project's code
async function startBackgroundCompile(
  store: Store<AppState>,
  mainApi: ReturnType<typeof createMainApi>,
  allowCompile: boolean = true
): Promise<boolean> {
  // --- Check if we have a build root to compile
  const state = store.getState();
  if (!state.project?.isKliveProject) {
    return false;
  }
  const buildRoot = state.project.buildRoots?.[0];
  if (!buildRoot) {
    return false;
  }
  const fullPath = `${state.project.folderPath}/${buildRoot}`;
  const language = getFileTypeEntry(fullPath, store)?.subType;

  // --- The built-in Klive Z80 assembler always runs background compilation;
  // --- the flag only gates external compilers (ZxBasic, SjasmPlus, etc.)
  const langInfo = customLanguagesRegistry.find((l) => l.id === language);
  const isBuiltInCompiler = langInfo?.compiler === "Z80Compiler";
  if (!allowCompile && !isBuiltInCompiler) {
    return false;
  }

  // --- Compile the build root
  store.dispatch(startBackgroundCompileAction());
  mainApi.startBackgroundCompile(fullPath, language);
  return true;
}
