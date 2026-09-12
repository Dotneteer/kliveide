import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  GenericFileContext,
  GenericFilePanel
} from "@renderer/appIde/DocumentPanels/helpers/GenericFilePanel";
import { createElement } from "react";
import { SprFileContents, SprFileViewState } from "./sprite-common";
import { SpriteEditor } from "./SpriteEditor";
import { parseSprFile } from "./sprite-file";

const SprFileEditorPanel = ({ document, contents, viewState }: DocumentProps) => {
  const validRenderer: (
    context: GenericFileContext<SprFileContents, SprFileViewState>
  ) => JSX.Element = (context) => <SpriteEditor context={context} />;
  return createElement(
    GenericFilePanel<SprFileContents, SprFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadSprFileContents,
      validRenderer
    }
  );
};

export const createSprFileEditorPanel = ({ document, contents, viewState }: DocumentProps) => {
  return (
    <SprFileEditorPanel
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
    />
  );
};

/**
 * Parsing lives in `sprite-file.ts`; this is only the adaptor to `GenericFilePanel`'s contract.
 *
 * It no longer returns an `error` for anything: a partial tail and an empty file are both
 * recoverable, and reporting either as an error is what used to throw the whole file away.
 */
function loadSprFileContents(contents: Uint8Array): {
  fileInfo?: SprFileContents;
  error?: string;
} {
  const { sprites, trailing, warning } = parseSprFile(contents);
  return { fileInfo: { sprites, trailing, warning } };
}
