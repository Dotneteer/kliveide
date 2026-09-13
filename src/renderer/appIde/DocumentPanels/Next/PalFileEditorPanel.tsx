import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  GenericFileContext,
  GenericFilePanel
} from "../helpers/GenericFilePanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { PaletteEditor } from "./PaletteEditor";
import { createElement } from "react";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { NPL_EDITOR } from "@state/common-ids";

type PalFileViewState = {
  scrollPosition?: number;
  selectedIndex?: number;
};

const PalFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  const validRenderer: (
    context: GenericFileContext<PalFileContents, PalFileViewState>
  ) => JSX.Element = context => {
    return (
      <PaletteEditor
        palette={context.fileInfo?.palette}
        initialTransparencyIndex={context.fileInfo?.transparencyIndex}
        /*
         * `.npl` files carry a transparency index; `.pal` files do not.
         *
         * This asked `document.id.endsWith(".npl")` — a string-sniff on the document *id*, which is
         * a path and need not end in the extension at all. The registry already draws this
         * distinction: `PAL_EDITOR` and `NPL_EDITOR` are two entries pointing at one factory
         * (`registry.ts`), and the id it chose arrives here as `document.type`. Ask the field that
         * was set on purpose.
         */
        allowTransparencySelection={document.type === NPL_EDITOR}
        initialIndex={viewState?.selectedIndex}
        onChange={index =>
          context.changeViewState(vs => (vs.selectedIndex = index))
        }
        onUpdated={async (palette, transparencyIndex) => {
          await context.saveToFile(savePalFileContents(palette, transparencyIndex));
        }}
      />
    );
  };
  return createElement(
    GenericFilePanel<PalFileContents, PalFileViewState>,
    {
      document,
      contents,
      viewState,
      fileLoader: loadPalFileContents,
      validRenderer
    }
  );
};

export const createPalFileEditorPanel = ({
  document,
  contents,
  viewState
}: DocumentProps) => {
  return (
    <PalFileEditorPanel
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
    />
  );
};

function loadPalFileContents (contents: Uint8Array): {
  fileInfo?: PalFileContents;
  error?: string;
} {
  const palette = [];
  let transparencyIndex: number | undefined;
  const reader = new BinaryReader(contents);
  try {
    for (let i = 0; i < 256; i++) {
      palette.push(reader.readUint16());
    }
    if (!reader.eof) {
      transparencyIndex = reader.readByte();
    }
  } catch (err) {
    return { error: err.message };
  }
  return { fileInfo: { palette, transparencyIndex } };
}

function savePalFileContents (palette: number[], transparencyIndex?: number): Uint8Array {
  const writer = new BinaryWriter();
  for (let i = 0; i < 256; i++) {
    writer.writeUint16(palette[i]);
  }
  if (transparencyIndex !== undefined && transparencyIndex !== null) {
    writer.writeByte(transparencyIndex);
  }
  return new Uint8Array(writer.buffer);
}

type PalFileContents = {
  palette: number[];
  transparencyIndex?: number;
};
