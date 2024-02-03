import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import {
  GenericFileEditorContext,
  GenericFileEditorPanel
} from "../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { PaletteEditor } from "./PaletteEditor";
import { createElement, useState } from "react";

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
    context: GenericFileEditorContext<PalFileContents, PalFileViewState>
  ) => JSX.Element = context => {
    const projectService = context.appServices.projectService;
    const documentSource = document.node.projectPath;
    return (
      <PaletteEditor
        palette={context.fileInfo?.palette}
        transparencyIndex={context.fileInfo?.transparencyIndex}
        initialIndex={viewState?.selectedIndex}
        onChange={index =>
          context.changeViewState(vs => (vs.selectedIndex = index))
        }
      />
    );
  };
  return createElement(
    GenericFileEditorPanel<PalFileContents, PalFileViewState>,
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

type PalFileContents = {
  palette: number[];
  transparencyIndex?: number;
};
