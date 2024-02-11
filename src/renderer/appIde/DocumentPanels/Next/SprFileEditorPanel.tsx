import styles from "./SprFileEditorPanel.module.scss";
import { DocumentProps } from "../../DocumentArea/DocumentsContainer";
import {
  GenericFileEditorContext,
  GenericFileEditorPanel
} from "../helpers/GenericFileEditorPanel";
import { BinaryReader } from "@common/utils/BinaryReader";
import { createElement } from "react";
import { Label } from "@renderer/controls/generic/Label";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Panel } from "@renderer/controls/generic/Panel";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { KeyHandler } from "@renderer/controls/generic/KeyHandler";
import { LabeledText } from "@renderer/controls/generic/LabeledText";

type SprFileViewState = {
  scrollPosition?: number;
};

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
  ) => JSX.Element = context => {
    // --- Handle common keys
    const handleCommonKeys = (key: string) => {
      // TODO: Implement
    };

    return (
      <>
        <Row>
          <KeyHandler
            xclass={styles.headerRow}
            onKey={handleCommonKeys}
            autofocus={true}
          >
            <SmallIconButton
              iconName='undo'
              title={"Undo"}
              enable={true}
              clicked={() => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='redo'
              title={"Redo"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <ToolbarSeparator small={true} />
            <SmallIconButton
              iconName='@pencil'
              title={"Pencil tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@line'
              title={"Line tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@rectangle'
              title={"Rectangle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@rectangle-filled'
              title={"Filled rectangle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@circle'
              title={"Circle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@circle-filled'
              title={"Filled circle tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@paint'
              title={"Paint tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@select'
              title={"Select area tool"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
            <SmallIconButton
              iconName='@copy'
              title={"Copy selected area"}
              enable={true}
              clicked={async () => {
                // TODO: Implement
              }}
            />
          </KeyHandler>
        </Row>
        <Panel xclass={styles.editorPanel}>
          <Row>
            <NextPaletteViewer
              palette={defaultPalette}
              transparencyIndex={0xe3}
              allowSelection={true}
              smallDisplay={true}
            />
          </Row>
        </Panel>
      </>
    );
  };
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

function saveSprFileContents (): Uint8Array {
  return new Uint8Array(0);
}

type SprFileContents = {
  sprites: Uint8Array[];
};
