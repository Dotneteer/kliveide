import { DocumentProps } from "../../../DocumentArea/DocumentsContainer";
import {
  GenericFileEditorContext,
  GenericFileEditorPanel
} from "../../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { createElement } from "react";
import { SprFileContents, SprFileViewState } from "./sprite-common";
import { SpriteEditor } from "./SpriteEditor";

const defaultPalette: number[] = [];
for (let i = 0; i < 256; i++) {
  defaultPalette.push(i);
}

const SprFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  const validRenderer: (
    context: GenericFileEditorContext<SprFileContents, SprFileViewState>
  ) => JSX.Element = context => <SpriteEditor context={context} />;
  return createElement(
    GenericFileEditorPanel<SprFileContents, SprFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadSprFileContents,
      validRenderer
    }
  );
};

export const createSprFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  return (
    <SprFileEditorPanel
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
    />
  );
};

function loadSprFileContents (contents: Uint8Array): {
  fileInfo?: SprFileContents;
  error?: string;
} {
  const reader = new BinaryReader(contents);
  const sprites: Uint8Array[] = [];
  while (!reader.eof) {
    const sprite = reader.readBytes(16 * 16);
    sprites.push(new Uint8Array(sprite));
  }
  return { fileInfo: { sprites } };
}
