import { createElement } from "react";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  GenericFilePanel,
  type GenericFileContext
} from "@renderer/appIde/DocumentPanels/helpers/GenericFilePanel";
import type { SprFileContents, SprFileViewState } from "@renderer/features/sprite-editor/sprite-common";
import { SpriteEditor } from "@renderer/features/sprite-editor/SpriteEditor";
import { parseSprFile } from "@renderer/features/sprite-editor/sprite-file";
import type { PatternSnapshotViewState } from "./patternSnapshot";

/*
 * A sprite pattern snapshot (`patternSnapshot.ts`): the sprite editor, read-only, over bytes held by
 * the document rather than a file. Nothing is ever saved; the tab is not restored with the workspace.
 */

type SnapshotViewState = SprFileViewState & Partial<PatternSnapshotViewState>;

function loadSnapshot(contents: Uint8Array): { fileInfo?: SprFileContents; error?: string } {
  const { sprites } = parseSprFile(contents);
  return { fileInfo: { sprites } };
}

const PatternSnapshotPanel = ({ document, contents, viewState }: DocumentProps<SnapshotViewState>) =>
  createElement(GenericFilePanel<SprFileContents, SnapshotViewState>, {
    document,
    contents,
    viewState,
    fileLoader: loadSnapshot,
    validRenderer: (context: GenericFileContext<SprFileContents, SnapshotViewState>) => (
      <SpriteEditor
        context={context}
        readOnly={{
          title: context.viewState?.snapshotTitle ?? document.name,
          detail: context.viewState?.snapshotDetail
        }}
      />
    )
  });

export const createPatternSnapshotPanel = ({ document, contents, viewState }: DocumentProps) => (
  <PatternSnapshotPanel document={document} contents={contents} viewState={viewState} />
);
