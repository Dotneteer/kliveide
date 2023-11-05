/**
 * Represents information about a custom language
 *
 * HACK: we use "any" for the properties to avoid any dependencies from
 * the Monaco Editor (as that cannot be loaded into the main process)
 *
 */
type CustomLanguageInfo = {
  id: string;
  extensions: string[];
  icon?: string;
  allowBuildRoot: boolean;
  supportsKlive: boolean;
  options?: any;
  depensOn?: string[];
  languageDef?: any;
  lightTheme?: any;
  darkTheme?: any;
  supportsBreakpoints?: boolean;
  fullLineBreakpoints?: boolean;
  compiler?: string;
};

import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

/**
 * Represents information about a custom language that uses the
 * Monaco Editor type system
 */
export interface MonacoAwareCustomLanguageInfo extends CustomLanguageInfo {
  id: string;
  options?: monacoEditor.languages.LanguageConfiguration;
  languageDef?: monacoEditor.languages.IMonarchLanguage;
  lightTheme?: EditorThemeBody;
  darkTheme?: EditorThemeBody;
  supportsBreakpoints?: boolean;
}

/**
 * Describes the body of an code editor related theme
 */
type EditorThemeBody = {
  rules: monacoEditor.editor.ITokenThemeRule[];
  encodedTokensColors?: string[];
  colors: monacoEditor.editor.IColors;
};
