import Editor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";
import AutoSizer from "@/lib/react-virtualized-auto-sizer";
import { useTheme } from "@/renderer/theming/ThemeProvider";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRendererContext, useSelector } from "@/renderer/core/RendererProvider";
import { CodeDocumentState } from "../services/DocumentService";
import { useAppServices } from "../services/AppServicesProvider";
import { DocumentState } from "@abstractions/DocumentState";
import { customLanguagesRegistry } from "@/renderer/registry";
import { delay } from "@/renderer/utils/timing";

// --- Wait 1000 ms before saving the document being edited
const SAVE_DEBOUNCE = 1000;

let monacoInitialized = false;

export async function initializeMonaco (appPath: string) {
  loader.config({
    paths: {
      vs: `${appPath}/node_modules/monaco-editor/min/vs`
    }
  });
  const monaco = await loader.init();
  customLanguagesRegistry.forEach(entry => ensureLanguage(monaco, entry.id));
  monacoInitialized = true;

  function ensureLanguage (monaco: typeof monacoEditor, language: string) {
    if (!monaco.languages.getLanguages().some(({ id }) => id === language)) {
      // --- Do we support that custom language?
      const languageInfo = customLanguagesRegistry.find(l => l.id === language);
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

export interface EditorApi {
  setPosition(lineNo: number, column: number): void;
}

type EditorProps = {
  document: DocumentState;
  value: string;
  viewState?: monacoEditor.editor.ICodeEditorViewState;
  apiLoaded?: (api: EditorApi) => void;
};

export const MonacoEditor = ({ document, value, viewState, apiLoaded }: EditorProps) => {
  const { theme } = useTheme();
  const { messenger } = useRendererContext();
  const { documentService } = useAppServices();
  const [vsTheme, setVsTheme] = useState("");
  const editor = useRef<monacoEditor.editor.IStandaloneCodeEditor>(null);
  const monaco = useRef<typeof monacoEditor>(null);
  const docActivationVersion = useSelector(
    s => s.ideView?.documentActivationVersion
  );
  const previousContent = useRef<string>();
  const unsavedChangeCounter = useRef(0);
  const editorFontSize = useSelector(
    s => s.ideViewOptions?.editorFontSize ?? 12
  );

  // --- Set the editor focus, whenever the activation version changes
  useLayoutEffect(() => {
    (async () => {
      await delay(50);
      editor.current?.focus();
    })()
  }, [docActivationVersion]);

  // --- Respond to theme changes
  useEffect(() => {
    // --- Set the theme according to the document language
    const languageInfo = customLanguagesRegistry.find(
      l => l.id === document.language
    );
    let themeName = theme.tone === "light" ? "vs" : "vs-dark";
    if (
      (languageInfo?.lightTheme && theme.tone === "light") ||
      (languageInfo?.darkTheme && theme.tone === "dark")
    ) {
      themeName = `${languageInfo.id}-${theme.tone}`;
    }
    setVsTheme(themeName);
  }, [theme, document.language]);

  // --- Respond to editor font size changes
  useEffect(() => {
    editor.current;
  }, [editorFontSize]);

  // --- Initializes the editor when mounted
  const onMount = (
    ed: monacoEditor.editor.IStandaloneCodeEditor,
    mon: typeof monacoEditor
  ): void => {
    editor.current = ed;
    monaco.current = mon;
    if (viewState) {
      ed.restoreViewState(viewState);
    }

    // --- Mount events to save the view state
    const disposables: monacoEditor.IDisposable[] = [];
    disposables.push(
      ed.onDidBlurEditorText(saveDocumentState),
      ed.onDidBlurEditorWidget(saveDocumentState),
      ed.onDidChangeCursorPosition(saveDocumentState),
      ed.onDidChangeCursorSelection(saveDocumentState),
      ed.onDidChangeHiddenAreas(saveDocumentState),
      ed.onDidFocusEditorText(saveDocumentState),
      ed.onDidFocusEditorWidget(saveDocumentState)
    );

    // --- Create the API
    const editorApi: EditorApi = {
      setPosition: (lineNumber: number, column: number) => {
        ed.revealPositionInCenter({ lineNumber, column });
        ed.setPosition({ lineNumber, column });
        window.requestAnimationFrame(() => ed.focus());
      },
    }
    apiLoaded?.(editorApi);

    // --- Dispose event handlers
    editor.current.onDidDispose(() => {
      disposables.forEach(d => d.dispose());
    });
  };

  // --- Saves the document state
  const saveDocumentState = () => {
    const data: CodeDocumentState = {
      value: editor.current.getValue(),
      viewState: editor.current.saveViewState()
    };
    documentService.setDocumentData(document.id, data);
  };

  // Saves the document to its file
  const saveDocumentToFile = async (documentText: string): Promise<void> => {
    const result = await messenger.sendMessage({
      type: "MainSaveTextFile",
      path: document.id,
      data: documentText
    });
    if (result.type === "ErrorResponse") {
      console.error("Error");
    }
  };

  // --- Handle document changes
  const onValueChanged = async (val: any) => {
    // --- Save the current value as the previous one
    previousContent.current = editor.current.getValue();

    // --- Save document after the change (with delay)
    unsavedChangeCounter.current++;
    await new Promise(r => setTimeout(r, SAVE_DEBOUNCE));
    if (unsavedChangeCounter.current === 1 && previousContent.current) {
      await saveDocumentToFile(editor.current.getModel().getValue());
    }
    unsavedChangeCounter.current--;
  };
  
  return monacoInitialized ? (
    <AutoSizer>
      {({ width, height }) => (
        <Editor
          options={{
            fontSize: editorFontSize,
            readOnly: document.isReadOnly
          }}
          loading=''
          width={width}
          height={height}
          key={document.id}
          language={document.language}
          theme={vsTheme}
          value={value}
          onMount={onMount}
          onChange={onValueChanged}
        />
      )}
    </AutoSizer>
  ) : null;
};
