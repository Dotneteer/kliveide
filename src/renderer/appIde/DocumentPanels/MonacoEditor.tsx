import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";

// Import Monaco language workers for built-in language support
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/_.contribution';

// Import and configure Monaco workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure worker creation
(self as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

import AutoSizer from "../../../lib/react-virtualized-auto-sizer";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { useGlobalSetting, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "../services/AppServicesProvider";
import { customLanguagesRegistry } from "@renderer/registry";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { addBreakpoint, getBreakpoints, removeBreakpoint } from "../utils/breakpoint-utils";
import styles from "./MonacoEditor.module.scss";
import { refreshSourceCodeBreakpoints } from "@common/utils/breakpoints";
import {
  incBreakpointsVersionAction,
  incEditorVersionAction,
  startBackgroundCompileAction
} from "@common/state/actions";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";
import { useDocumentHubServiceVersion } from "../services/DocumentServiceProvider";
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
import { getFileTypeEntry } from "../project/project-node";
import { isDebuggableCompilerOutput } from "../utils/compiler-utils";

let monacoInitialized = false;

let MAX_BP_UNDO_STACK = 64;

// --- We use these shortcuts in this file for Monaco types
type Decoration = monacoEditor.editor.IModelDeltaDecoration;
type EditorDecorationsCollection = monacoEditor.editor.IEditorDecorationsCollection;
type MarkdownString = monacoEditor.IMarkdownString;

// --- We need to invoke this function while initializing the app. This is required to
// --- render the Monaco editor with the supported language syntax highlighting.
export async function initializeMonaco() {
  // --- Use the ESM version of monaco-editor which is bundled by Vite
  // --- This avoids the AMD loader issues in production builds
  loader.config({ monaco: monacoEditor });
  
  // --- Wait for monaco to initialize
  const monaco = await loader.init();
  
  customLanguagesRegistry.forEach((entry) => ensureLanguage(monaco, entry.id));
  monacoInitialized = true;

  function ensureLanguage(monaco: any, language: string) {
    if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
      // --- Do we support that custom language?
      const languageInfo = customLanguagesRegistry.find((l) => l.id === language);
      if (languageInfo) {
        // --- Yes, register the new language
        monaco.languages.register({ id: languageInfo.id });

        // --- Register a tokens provider for the language
        monaco.languages.setMonarchTokensProvider(languageInfo.id, languageInfo.languageDef);

        // --- Set the editing configuration for the language
        monaco.languages.setLanguageConfiguration(languageInfo.id, languageInfo.options);

        // --- Define light theme for the language
        if (languageInfo.lightTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-light`, {
            base: "vs",
            inherit: true,
            rules: languageInfo.lightTheme.rules,
            encodedTokensColors: languageInfo.lightTheme.encodedTokensColors,
            colors: languageInfo.lightTheme.colors
          });
        }
        // --- Define dark theme for the language
        if (languageInfo.darkTheme) {
          monaco.editor.defineTheme(`${languageInfo.id}-dark`, {
            base: "vs-dark",
            inherit: true,
            rules: languageInfo.darkTheme.rules,
            encodedTokensColors: languageInfo.darkTheme.encodedTokensColors,
            colors: languageInfo.darkTheme.colors
          });
        }
        if (languageInfo.depensOn) {
          for (const dependOn of languageInfo.depensOn) {
            ensureLanguage(monaco, dependOn);
          }
        }
      }
    }
  }
}

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
};

// --- This component wraps the Monaco editor
export const MonacoEditor = ({ document, value, apiLoaded }: EditorProps) => {
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
  const { projectService } = useAppServices();
  const emuApi = useEmuApi();

  // --- Recognize if something changed in the current document hub
  const hubVersion = useDocumentHubServiceVersion();

  // --- Use these state variables to manage breakpoinst and their changes
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

  // --- Sets the Auto complete editor option
  const updateAutoComplete = () => {
    if (editor.current) {
      editor.current.updateOptions({
        quickSuggestions: enableAutoComplete,
        suggestOnTriggerCharacters: enableAutoComplete
      });
    }
  };

  // --- Sets the InsertSpaces editor option
  const updateInsertSpaces = () => {
    if (editor.current) {
      editor.current.updateOptions({
        insertSpaces
      });
    }
  };

  // --- Sets the RenderWhitespaces editor option
  const updateRenderWhitespaces = () => {
    if (editor.current) {
      editor.current.updateOptions({
        renderWhitespace: renderWhitespaces
      });
    }
  };

  // --- Sets the tab size of the editor
  const updateTabSize = () => {
    if (editor.current) {
      editor.current.updateOptions({
        tabSize
      });
    }
  };

  // --- Set the detect indentation flag
  const updateDetectIndentation = () => {
    if (editor.current) {
      editor.current.updateOptions({
        detectIndentation
      });
    }
  };

  // --- Set the highlight flag
  const updateSelectionHighlight = () => {
    if (editor.current) {
      editor.current.updateOptions({
        selectionHighlight: enableSelectionHighlight
      });
    }
  };

  // --- Set the occurrences highlight flag
  const updateOccurrencesHighlight = () => {
    if (editor.current) {
      editor.current.updateOptions({
        occurrencesHighlight: enableOccurrencesHighlight
      });
    }
  };

  // --- Set the quick suggestion delay
  const updateQuickSuggestionDelay = () => {
    if (editor.current) {
      editor.current.updateOptions({
        quickSuggestionsDelay: quickSuggestionDelay
      });
    }
  };

  // --- Update editor file language changes
  useEffect(() => {
    setLanguageInfo(customLanguagesRegistry.find((l) => l.id === document.language));
  }, [document.language]);

  // --- Update Autocomplete changes
  useEffect(() => {
    updateAutoComplete();
  }, [enableAutoComplete]);

  // --- Update InsertSpaces changes
  useEffect(() => {
    updateInsertSpaces();
  }, [insertSpaces]);

  // --- Update RenderWhitespaces changes
  useEffect(() => {
    updateRenderWhitespaces();
  }, [renderWhitespaces]);

  // --- Update TabSize changes
  useEffect(() => {
    updateTabSize();
  }, [tabSize]);

  // --- Update DetectIndentation changes
  useEffect(() => {
    updateDetectIndentation();
  }, [detectIndentation]);

  // --- Update selection highlight changes
  useEffect(() => {
    updateSelectionHighlight();
  }, [enableSelectionHighlight]);

  // --- Update the occurrences highlight changes
  useEffect(() => {
    updateOccurrencesHighlight();
  }, [enableOccurrencesHighlight]);

  // --- Update the quick suggestion delay changes
  useEffect(() => {
    updateQuickSuggestionDelay();
  }, [quickSuggestionDelay]);

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

  useEffect(() => {
    (async () => {
      const settings = (await mainApi.getUserSettings())?.shortcuts ?? {};
      if (settings.stepInto) {
        bindKey(settings.stepInto, async () => {
          if (isPaused()) {
            await emuApi.issueMachineCommand("stepInto");
          }
        });
      }
      if (settings.stepOver) {
        bindKey(settings.stepOver, async () => {
          if (isPaused()) {
            await emuApi.issueMachineCommand("stepOver");
          }
        });
      }
      if (settings.stepOut) {
        bindKey(settings.stepOut, async () => {
          if (isPaused()) {
            await emuApi.issueMachineCommand("stepOut");
          }
        });
      }

      function bindKey(shortcut: string, action: () => Promise<void>) {
        const mappingKey = keysToRebind.find((key) => key.shortCut === shortcut);
        if (mappingKey) {
          editor.current?.addCommand(mappingKey.key, async () => {
            await action();
          });
        }
      }
    })();

    function isPaused() {
      const state = store.getState();
      return (
        !state?.compilation?.inProgress &&
        state?.emulatorState?.machineState === MachineControllerState.Paused
      );
    }
  }, [editor.current]);

  // --- Refresh breakpoints when they may change
  useEffect(() => {
    if (editor.current) {
      (async () => {
        const bps = await refreshBreakpoints();
        await refreshCurrentBreakpoint(bps);
      })();
    }
  }, [breakpointsVersion, compilation, execState, hubVersion]);

  useEffect(() => {
    // Clear previous decorations
    errorWarningDecorations.current?.clear();

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

    // Filter errors for the current file - try different matching approaches
    let fileErrors = backgroundResult.errors.filter((err) => err.filename.endsWith(currentFile));

    if (fileErrors.length === 0) {
      return;
    }

    console.log("Errors", fileErrors);

    // Create decorations for errors and warnings
    const decorations: Decoration[] = [];
    fileErrors.forEach((err) => {
      // Ensure we have valid line/column information
      const lineNo = err.line || 1;

      // Determine startCol - use first non-whitespace character if not defined
      let startCol = err.startColumn;
      if (editor.current) {
        const model = editor.current.getModel();
        if (model && lineNo <= model.getLineCount()) {
          const lineContent = model.getLineContent(lineNo);
          // Find position of first non-whitespace character in the line
          const match = lineContent.match(/\S/);
          if (match) {
            startCol = match.index + 1; // Convert to 1-based index
          } else {
            startCol = 1; // Default to beginning of line if it's all whitespace
          }
        } else {
          startCol = 1; // Default fallback
        }
      } else {
        startCol = 1; // Default if no editor or model
      }

      // Calculate endCol from the current line's length if not provided
      let endCol = err.endColumn;
      if (editor.current) {
        const model = editor.current.getModel();
        if (model && lineNo <= model.getLineCount()) {
          // Use the line length as the end column, or startCol + 10 as fallback
          endCol = model.getLineLength(lineNo) + 1;
        } else {
          endCol = startCol + 10; // Default fallback
        }
      }

      // Create the decoration
      decorations.push({
        range: new monacoEditor.Range(lineNo, startCol, lineNo, endCol),
        options: {
          className: err.isWarning ? styles.warningDecoration : styles.errorDecoration,
          after: {
            content: err.message || "Issue detected",
            inlineClassName: err.isWarning ? styles.warningIcon : styles.errorIcon
          },
          isWholeLine: false
        }
      });
    });

    // Apply decorations
    if (decorations.length > 0) {
      errorWarningDecorations.current = editor.current.createDecorationsCollection(decorations);
      console.log("Decorations applied:", decorations);
    }
  }, [backgroundResult, document.node?.projectPath, allowBackgroundCompile]);

  useEffect(() => {
    if (store && mainApi && allowBackgroundCompile) {
      startBackgroundCompile(store, mainApi, allowBackgroundCompile);
    }
  }, [store, mainApi, allowBackgroundCompile]);

  // --- Initializes the editor when mounted
  const onMount = (ed: monacoEditor.editor.IStandaloneCodeEditor, _: typeof monacoEditor): void => {
    // --- Restore the view state to display the editor is it has been left
    mounted.current = false;
    editor.current = ed;
    ed.setValue(value);

    // --- We need to add these commands to the editor to be able to use the shortcuts.
    // --- Otherwise, the v0.46.0 Monaco editor will not work properly with Electron v0.35.1.
    ed.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyY, () =>
      ed.trigger("keyboard", "redo", null)
    );

    // Copy with Ctrl+Shift+C
    ed.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyC, () => {
      const selection = ed.getSelection();
      const text = ed.getModel()?.getValueInRange(selection);
      if (text) {
        navigator.clipboard.writeText(text);
      }
    });

    // Paste with Ctrl+Shift+V
    ed.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyV, async () => {
      let text = await navigator.clipboard.readText();
      // --- Correct line breaks for paste
      text = text.replace(/\r?\n/g, "\r");
      ed.trigger("keyboard", "type", { text });
    });

    const saveViewState = () => {
      if (mounted.current) {
        const viewState = ed.saveViewState();
        projectService.getActiveDocumentHubService().setDocumentViewState(document.id, viewState);
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
        projectService
          .getActiveDocumentHubService()
          .saveActiveDocumentPosition(e.position.lineNumber, e.position.column);
        store.dispatch(incEditorVersionAction());
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

    // --- Pass back the API so that the document ub service can use it
    apiLoaded?.(editorApi);

    const viewState = projectService
      .getActiveDocumentHubService()
      .getDocumentViewState(document.id);
    if (viewState) {
      ed.restoreViewState(viewState);
    }

    // --- Set the editor's options
    updateAutoComplete();
    updateInsertSpaces();
    updateRenderWhitespaces();
    updateTabSize();
    updateDetectIndentation();
    updateSelectionHighlight();
    updateOccurrencesHighlight();

    // --- Focus the editor
    ed.focus();

    // --- Dispose event handlers when the editor is about to dispose
    editor.current.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
    });

    mounted.current = true;

    // --- Start background compilation
    startBackgroundCompile(store, mainApi, allowBackgroundCompile);

    // --- Show breakpoinst and other decorations when initially displaying the editor
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
          // --- Special case: after chnaging to readonly, the editor signs
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

    // --- Start background compilation
    startBackgroundCompile(store, mainApi, allowBackgroundCompile);
  };

  // --- render the editor when monaco has been initialized
  return monacoInitialized ? (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            readOnly: document.isReadOnly || (isProjectDebugging && document.isLocked),
            glyphMargin: languageInfo?.supportsBreakpoints
          }}
          loading=""
          width={width}
          height={height}
          key={document.id}
          language={document.language}
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
    // --- Filter for source code breakpoint belonging to this resoure
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
  // --- Check if background compilation is allowed
  if (!allowCompile) {
    return false;
  }

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

  // --- Compile the build root
  store.dispatch(startBackgroundCompileAction());
  mainApi.startBackgroundCompile(fullPath, language);
  return true;
}
