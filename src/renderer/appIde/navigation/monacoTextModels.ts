import { loader } from "@monaco-editor/react";
import type * as monacoEditor from "monaco-editor";
import type { TrackableTextModel } from "./textNavigationAdapter";

/**
 * The live Monaco model of a document, by document id.
 *
 * The editor opens each document as `path={document.id}`, and `@monaco-editor/react` names that
 * model `Uri.parse(path)` — so the same parse finds it.
 *
 * Monaco is taken from the loader the editor bootstrap configures (`monacoBootstrap.ts`) rather than
 * imported: the panel registry imports this module, and a static `monaco-editor` import would load
 * the whole editor wherever the registry is loaded, including jsdom tests, which cannot. Before the
 * editor has initialised there are no models to find, so `undefined` is the right answer then too.
 */
export function getMonacoTextModel(documentId: string): TrackableTextModel | undefined {
  try {
    const monaco = loader.__getMonacoInstance() as typeof monacoEditor | null;
    return monaco?.editor.getModel(monaco.Uri.parse(documentId)) ?? undefined;
  } catch {
    return undefined;
  }
}
