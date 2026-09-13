import { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";

import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/language/css/monaco.contribution";
import "monaco-editor/esm/vs/language/html/monaco.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/_.contribution";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import { customLanguagesRegistry } from "@renderer/registry";
import { loadCustomTokenColors } from "@renderer/appIde/project/customTokenLoader";
import { languageIntelSingleton } from "@renderer/appIde/services/LanguageIntelService";
import { registerZ80Providers } from "@renderer/appIde/services/z80-providers";
import {
  applyMonacoExternalEdits,
  getMonacoProjectFolder,
  navigateMonacoToFile
} from "./monacoGlobals";
import { editorColors, syntaxRules } from "@renderer/theming/tokens/syntax";
import type { AccentId } from "@common/theming/accents";

let monacoInitialized = false;

type MonacoResource = {
  fsPath?: string;
  path?: string;
  toString(): string;
};

type MonacoSelectionOrPosition = {
  startLineNumber?: unknown;
  lineNumber?: unknown;
} | null | undefined;

type MonacoEnvironmentHost = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker(_: unknown, label: string): Worker;
  };
};

/**
 * Configures Monaco workers, custom languages, providers, and Klive navigation
 * integration once for the renderer process.
 */
export async function initializeMonaco(): Promise<void> {
  if (monacoInitialized) return;
  monacoInitialized = true;

  configureMonacoWorkers();
  loader.config({ monaco: monacoEditor });
  await loadCustomTokenColors(customLanguagesRegistry);

  const monaco = await loader.init();
  customLanguagesRegistry.forEach((entry) => ensureLanguage(monaco, entry.id));

  registerZ80Providers(
    monaco,
    () => languageIntelSingleton,
    () => 0,
    applyMonacoExternalEdits,
    getMonacoProjectFolder,
    navigateMonacoToFile
  );

  monacoEditor.editor.registerEditorOpener({
    openCodeEditor(
      _source: unknown,
      resource: MonacoResource,
      selectionOrPosition: MonacoSelectionOrPosition
    ): boolean {
      const filePath: string = resource.fsPath ?? resource.path ?? resource.toString();
      return navigateMonacoToFile(filePath, getNavigationLine(selectionOrPosition));
    }
  });
}

export function isMonacoInitialized(): boolean {
  return monacoInitialized;
}

export function resetMonacoBootstrapForTests(): void {
  monacoInitialized = false;
}

function configureMonacoWorkers(): void {
  (globalThis as MonacoEnvironmentHost).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === "json") {
        return new jsonWorker();
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new cssWorker();
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new htmlWorker();
      }
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      return new editorWorker();
    }
  };
}

function ensureLanguage(monaco: typeof monacoEditor, language: string): void {
  if (monaco.languages.getLanguages().some(({ id }) => id === language)) return;

  const languageInfo = customLanguagesRegistry.find((l) => l.id === language);
  if (!languageInfo) return;

  monaco.languages.register({ id: languageInfo.id });
  monaco.languages.setMonarchTokensProvider(languageInfo.id, languageInfo.languageDef);
  monaco.languages.setLanguageConfiguration(languageInfo.id, languageInfo.options);

  if (languageInfo.depensOn) {
    for (const dependOn of languageInfo.depensOn) {
      ensureLanguage(monaco, dependOn);
    }
  }
}

/**
 * (Re)define the editor themes for every custom language.
 *
 * This used to sit inside `ensureLanguage`, which returns early once a language is registered, so
 * each theme was defined exactly once for the lifetime of the window. That was survivable while the
 * colours were literals and only the tone could change — the light and dark themes were both defined
 * up front and switching tone just switched which name was applied. It cannot work now that the
 * palette follows the accent, because the *contents* of a theme change while its name does not.
 *
 * `defineTheme` is idempotent by name, so calling it again updates the theme in place; the caller
 * re-applies it with `setTheme`.
 */
export function defineLanguageThemes(
  monaco: typeof monacoEditor,
  tone: "light" | "dark",
  accent: AccentId
): void {
  const generatedRules = syntaxRules(tone, accent);
  const generatedColors = editorColors(tone);
  for (const languageInfo of customLanguagesRegistry) {
    /*
     * A provider's own theme block is now an *override slot*, not a palette.
     *
     * It starts empty and is filled by `customTokenLoader` from the user's
     * `<languageId>.tokens.json`. Merging it after the generated rules keeps that feature working —
     * Monaco takes the last rule for a given token — while the 146 hand-copied colour literals that
     * used to live in these blocks are gone.
     */
    const overrides = tone === "light" ? languageInfo.lightTheme : languageInfo.darkTheme;
    monaco.editor.defineTheme(`${languageInfo.id}-${tone}`, {
      base: tone === "light" ? "vs" : "vs-dark",
      inherit: true,
      rules: [...generatedRules, ...(overrides?.rules ?? [])],
      colors: { ...generatedColors, ...(overrides?.colors ?? {}) }
    });
  }
}

function getNavigationLine(selectionOrPosition: MonacoSelectionOrPosition): number {
  if (selectionOrPosition) {
    if (typeof selectionOrPosition.startLineNumber === "number") {
      return selectionOrPosition.startLineNumber;
    }
    if (typeof selectionOrPosition.lineNumber === "number") {
      return selectionOrPosition.lineNumber;
    }
  }
  return 1;
}
