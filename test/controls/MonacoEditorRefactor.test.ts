import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("Monaco external rename edits", () => {
  it("applies 1-based Monaco columns bottom-up within each file", async () => {
    const { applyRenameEditsToText } = await import(
      "@renderer/features/editor/monaco/monacoExternalEdits"
    );

    expect(
      applyRenameEditsToText("alpha beta gamma\nkeep beta", [
        { filePath: "/p/a.asm", line: 1, startColumn: 12, endColumn: 17, newText: "delta" },
        { filePath: "/p/a.asm", line: 1, startColumn: 7, endColumn: 11, newText: "omega" },
        { filePath: "/p/a.asm", line: 2, startColumn: 6, endColumn: 10, newText: "sigma" }
      ])
    ).toBe("alpha omega delta\nkeep sigma");
  });

  it("saves each changed file and reloads open documents for those files", async () => {
    const { applyExternalRenameEdits } = await import(
      "@renderer/features/editor/monaco/monacoExternalEdits"
    );
    const reloadDocument = vi.fn(() => Promise.resolve());
    const mainApi = {
      readTextFile: vi.fn((filePath: string) =>
        Promise.resolve(filePath.endsWith("a.asm") ? "foo bar" : "foo baz")
      )
    };
    const projectService = {
      saveFileContent: vi.fn(() => Promise.resolve()),
      getDocumentHubServiceInstances: vi.fn(() => [
        {
          getOpenDocuments: () => [
            { id: "/p/a.asm" },
            { id: "doc-b", path: "/p/b.asm" },
            { id: "/p/c.asm" }
          ],
          reloadDocument
        }
      ])
    };

    await applyExternalRenameEdits(mainApi as any, projectService as any, [
      { filePath: "/p/a.asm", line: 1, startColumn: 5, endColumn: 8, newText: "qux" },
      { filePath: "/p/b.asm", line: 1, startColumn: 5, endColumn: 8, newText: "quux" }
    ]);

    expect(projectService.saveFileContent).toHaveBeenCalledWith("/p/a.asm", "foo qux");
    expect(projectService.saveFileContent).toHaveBeenCalledWith("/p/b.asm", "foo quux");
    expect(reloadDocument).toHaveBeenCalledWith("/p/a.asm");
    expect(reloadDocument).toHaveBeenCalledWith("doc-b");
  });
});

describe("Monaco globals", () => {
  it("uses scoped cleanup for navigation, external edit, and provider store callbacks", async () => {
    const globals = await import("@renderer/features/editor/monaco/monacoGlobals");
    globals.resetMonacoGlobalsForTests();

    const firstNavigate = vi.fn();
    const secondNavigate = vi.fn();
    const cleanupFirstNavigate = globals.setMonacoNavigationHandler(firstNavigate);
    const cleanupSecondNavigate = globals.setMonacoNavigationHandler(secondNavigate);

    cleanupFirstNavigate();
    expect(globals.navigateMonacoToFile("/p/a.asm", 12)).toBe(true);
    expect(firstNavigate).not.toHaveBeenCalled();
    expect(secondNavigate).toHaveBeenCalledWith("/p/a.asm", 12);

    cleanupSecondNavigate();
    expect(globals.navigateMonacoToFile("/p/a.asm", 12)).toBe(false);

    const applyEdits = vi.fn();
    const cleanupEdits = globals.setMonacoExternalEditHandler(applyEdits);
    globals.applyMonacoExternalEdits([{ filePath: "/p/a.asm", line: 1, startColumn: 1, endColumn: 2, newText: "x" }]);
    expect(applyEdits).toHaveBeenCalledTimes(1);
    cleanupEdits();
    globals.applyMonacoExternalEdits([]);
    expect(applyEdits).toHaveBeenCalledTimes(1);

    const store = { getState: () => ({ project: { folderPath: "/project" } }) };
    const cleanupStore = globals.setMonacoProviderStore(store as any);
    expect(globals.getMonacoProjectFolder()).toBe("/project");
    cleanupStore();
    expect(globals.getMonacoProjectFolder()).toBeUndefined();
  });
});

describe("Monaco editor adapters", () => {
  it("applies user option changes in one editor update", async () => {
    const { applyMonacoUserOptions } = await import(
      "@renderer/features/editor/monaco/monacoEditorOptions"
    );
    const editor = { updateOptions: vi.fn() };

    applyMonacoUserOptions(editor as any, {
      enableAutoComplete: true,
      insertSpaces: false,
      renderWhitespaces: "all",
      tabSize: 2,
      detectIndentation: false,
      enableSelectionHighlight: true,
      enableOccurrencesHighlight: false,
      quickSuggestionDelay: 250
    });

    expect(editor.updateOptions).toHaveBeenCalledWith({
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      insertSpaces: false,
      renderWhitespace: "all",
      tabSize: 2,
      detectIndentation: false,
      selectionHighlight: true,
      occurrencesHighlight: false,
      quickSuggestionsDelay: 250
    });
  });

  it("binds debug shortcuts and only executes them while paused", async () => {
    const { MachineControllerState } = await import("@abstractions/MachineControllerState");
    const { registerMonacoDebugShortcuts } = await import(
      "@renderer/features/editor/monaco/monacoDebugShortcuts"
    );
    const commands = new Map<number, () => Promise<void>>();
    const editor = {
      addCommand: vi.fn((key: number, command: () => Promise<void>) => {
        commands.set(key, command);
      })
    };
    let paused = true;
    const store = {
      getState: () => ({
        compilation: { inProgress: false },
        emulatorState: {
          machineState: paused ? MachineControllerState.Paused : MachineControllerState.Running
        }
      })
    };
    const emuApi = { issueMachineCommand: vi.fn(() => Promise.resolve()) };

    await registerMonacoDebugShortcuts(
      editor as any,
      { getUserSettings: vi.fn(() => Promise.resolve({ shortcuts: { stepInto: "F7" } })) },
      emuApi as any,
      store as any,
      [{ key: 7, shortCut: "F7" }]
    );

    await commands.get(7)?.();
    paused = false;
    await commands.get(7)?.();

    expect(editor.addCommand).toHaveBeenCalledTimes(1);
    expect(emuApi.issueMachineCommand).toHaveBeenCalledTimes(1);
    expect(emuApi.issueMachineCommand).toHaveBeenCalledWith("stepInto");
  });
});

describe("Monaco bootstrap", () => {
  it("initializes Monaco only once and wires providers to globals", async () => {
    const config = vi.fn();
    const register = vi.fn();
    const setMonarchTokensProvider = vi.fn();
    const setLanguageConfiguration = vi.fn();
    const defineTheme = vi.fn();
    const registerEditorOpener = vi.fn();
    const registerZ80Providers = vi.fn();
    const loadCustomTokenColors = vi.fn(() => Promise.resolve());
    const monaco = {
      languages: {
        getLanguages: vi.fn(() => []),
        register,
        setMonarchTokensProvider,
        setLanguageConfiguration
      },
      editor: { defineTheme }
    };

    vi.stubGlobal("self", {});
    vi.doMock("@monaco-editor/react", () => ({
      loader: {
        config,
        init: vi.fn(() => Promise.resolve(monaco))
      }
    }));
    vi.doMock("monaco-editor", () => ({
      editor: { registerEditorOpener },
      Range: class Range {
        constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number
        ) {}
      }
    }));
    vi.doMock("monaco-editor/esm/vs/language/json/monaco.contribution", () => ({}));
    vi.doMock("monaco-editor/esm/vs/language/css/monaco.contribution", () => ({}));
    vi.doMock("monaco-editor/esm/vs/language/html/monaco.contribution", () => ({}));
    vi.doMock("monaco-editor/esm/vs/language/typescript/monaco.contribution", () => ({}));
    vi.doMock("monaco-editor/esm/vs/basic-languages/_.contribution", () => ({}));
    vi.doMock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({ default: class EditorWorker {} }));
    vi.doMock("monaco-editor/esm/vs/language/json/json.worker?worker", () => ({ default: class JsonWorker {} }));
    vi.doMock("monaco-editor/esm/vs/language/css/css.worker?worker", () => ({ default: class CssWorker {} }));
    vi.doMock("monaco-editor/esm/vs/language/html/html.worker?worker", () => ({ default: class HtmlWorker {} }));
    vi.doMock("monaco-editor/esm/vs/language/typescript/ts.worker?worker", () => ({ default: class TsWorker {} }));
    vi.doMock("@renderer/registry", () => ({
      customLanguagesRegistry: [
        {
          id: "klive-z80",
          languageDef: {},
          options: {},
          lightTheme: { rules: [], colors: {}, encodedTokensColors: [] }
        }
      ]
    }));
    vi.doMock("@renderer/appIde/project/customTokenLoader", () => ({ loadCustomTokenColors }));
    vi.doMock("@renderer/appIde/services/LanguageIntelService", () => ({
      languageIntelSingleton: {}
    }));
    vi.doMock("@renderer/appIde/services/z80-providers", () => ({
      registerZ80Providers
    }));

    const { initializeMonaco, isMonacoInitialized, resetMonacoBootstrapForTests } = await import(
      "@renderer/features/editor/monaco/monacoBootstrap"
    );

    resetMonacoBootstrapForTests();
    await initializeMonaco();
    await initializeMonaco();

    expect(isMonacoInitialized()).toBe(true);
    expect(config).toHaveBeenCalledTimes(1);
    expect(loadCustomTokenColors).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({ id: "klive-z80" });
    expect(defineTheme).toHaveBeenCalledWith("klive-z80-light", expect.any(Object));
    expect(registerZ80Providers).toHaveBeenCalledTimes(1);
    expect(registerEditorOpener).toHaveBeenCalledTimes(1);
  });
});
