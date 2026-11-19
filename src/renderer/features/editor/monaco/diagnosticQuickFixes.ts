import { t } from "@common/i18n/i18n";
import { closestSymbol, UNDEFINED_SYMBOL_CODE, undefinedSymbolsOnLine } from "./editorDiagnostics";

/** A label defined in the source with a trailing colon (`Loop:`), the name in group 1 */
const LABEL_DEF_RE = /^\s*([A-Za-z_][\w.]*)\s*:/;

/**
 * Registers the "did you mean" quick fix for an undefined symbol (`Z0605`) in a language: Monaco's
 * error hover offers it under "Quick Fix...", and Ctrl+. on the line offers it too. The candidates
 * are the symbols of the last successful build (`getSymbolNames`) and the labels the open file
 * defines now, so a label typed since that build counts too.
 *
 * `monaco` is the editor API (typed loosely, as the language providers take it).
 */
export function registerUndefinedSymbolQuickFix(
  monaco: any,
  languageId: string,
  getSymbolNames: () => Iterable<string>
): void {
  monaco.languages.registerCodeActionProvider(languageId, {
    provideCodeActions(model: any, _range: any, context: any) {
      const actions: any[] = [];
      for (const marker of context.markers ?? []) {
        const code = typeof marker.code === "string" ? marker.code : marker.code?.value;
        if (code !== UNDEFINED_SYMBOL_CODE) continue;
        for (const r of undefinedSymbolsOnLine(model, marker.startLineNumber)) {
          const range = {
            startLineNumber: r.lineNo,
            startColumn: r.startColumn,
            endLineNumber: r.lineNo,
            endColumn: r.endColumn
          };
          const name = model.getValueInRange(range);
          const fix = closestSymbol(name, symbolCandidates(model, getSymbolNames));
          if (!fix) continue;
          actions.push({
            title: t("panels.feature.editor.quickFix.changeTo", { name: fix }),
            kind: "quickfix",
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  textEdit: { range, text: fix },
                  versionId: model.getVersionId()
                }
              ]
            }
          });
        }
      }
      return { actions, dispose: () => {} };
    }
  });
}

/** The build's symbols and the file's own labels, each name once */
function symbolCandidates(model: any, getSymbolNames: () => Iterable<string>): Set<string> {
  const names = new Set<string>(getSymbolNames());
  const lineCount: number = model.getLineCount();
  for (let i = 1; i <= lineCount; i++) {
    const m = LABEL_DEF_RE.exec(model.getLineContent(i));
    if (m) names.add(m[1]);
  }
  return names;
}
