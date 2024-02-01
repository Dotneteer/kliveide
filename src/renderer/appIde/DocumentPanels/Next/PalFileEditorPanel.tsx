import styles from "./PalFileEditorPanel.module.scss";
import { Label } from "@renderer/controls/Labels";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import { Panel } from "@renderer/controls/generic/Panel";
import { Column } from "@renderer/controls/generic/Column";
import { HeaderRow } from "@renderer/controls/generic/Row";
import { GenericFileEditorPanel } from "../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { PaletteEditor } from "./PaletteEditor";

type PalFileViewState = {
  scrollPosition?: number;
};

const PalFileEditorPanel = ({ document, contents, viewState }: DocumentProps) => {
  return GenericFileEditorPanel<PalFileContents, PalFileViewState>({
    document,
    contents,
    viewState,
    fileLoader: loadPalFileContents,
    validRenderer: context => {
      const projectService = context.appServices.projectService;
      const documentSource = document.node.projectPath;
      const palette = context.fileInfo?.palette;
      const transparencyIndex = context.fileInfo?.transparencyIndex;
      return (
        <PaletteEditor palette={palette} transparencyIndex={transparencyIndex}  />
      );
    }
  });

};

export const createPalFileEditorPanel = ({
  document,
  contents
}: DocumentProps) => (
  <PalFileEditorPanel
    document={document}
    contents={contents}
    apiLoaded={() => {}}
  />
);

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
