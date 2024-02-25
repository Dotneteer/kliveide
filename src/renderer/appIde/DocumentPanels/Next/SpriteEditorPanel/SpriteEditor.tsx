import styles from "./SpriteEditor.module.scss";
import { GenericFileEditorContext } from "../../helpers/GenericFileEditorPanel";
import {
  SprFileContents,
  SprFileViewState,
  SpriteTools
} from "./sprite-common";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { LabelSeparator, Value } from "@renderer/controls/Labels";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { ScrollViewer } from "@renderer/controls/ScrollViewer";
import { Text } from "@renderer/controls/generic/Text";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Column } from "@renderer/controls/generic/Column";
import { Panel } from "@renderer/controls/generic/Panel";
import { Row } from "@renderer/controls/generic/Row";
import { SpriteEditorGrid } from "./SpriteEditorGrid";
import { SpriteImage } from "./SpriteImage";
import { memo, useEffect, useRef, useState } from "react";
import { set } from "lodash";
import { actionAsyncStorage } from "next/dist/client/components/action-async-storage.external";

const defaultPalette: number[] = [];
for (let i = 0; i < 256; i++) {
  defaultPalette.push(i);
}

type Props = {
  context: GenericFileEditorContext<SprFileContents, SprFileViewState>;
};

export const SpriteEditor = ({ context }: Props) => {
  // --- Sign the view state is initialized (to avoid flickering)
  const viewStateInitialized = useRef(false);

  // --- Sprite editor state
  const [zoomFactor, setZoomFactor] = useState<number>(2);
  const [spriteImagesSeparated, setSpriteImagesSeparated] = useState<boolean>();
  const [showTrancparencyColor, setShowTrancparencyColor] = useState<boolean>();
  const [pencilColorIndex, setPencilColorIndex] = useState<number>();
  const [fillColorIndex, setFillColorIndex] = useState<number>();
  const [selectedSpriteIndex, setSelectedSpriteIndex] = useState<number>();
  const [spriteMap, setSpriteMap] = useState<Uint8Array>();
  const [currentRow, setCurrentRow] = useState<string>();
  const [currentColumn, setCurrentColumn] = useState<string>();
  const [currentColorIndex, setCurrentColorIndex] = useState<number>();
  const [currentTool, setCurrentTool] = useState<SpriteTools>();

  // --- Undo/Redo stack
  const [editStack, setEditStack] = useState<EditInfo[]>([]);
  const [editStackIndex, setEditStackIndex] = useState<number>(-1);

  // --- Constants used to render the editor
  const palette = defaultPalette.slice(0);
  const rgbParts =
    currentColorIndex >= 0
      ? getRgbPartsForPaletteCode(palette[currentColorIndex])
      : undefined;

  // --- Set the current state according to the initial view state of the context
  useEffect(() => {
    if (viewStateInitialized.current) return;
    viewStateInitialized.current = true;
    setZoomFactor(context.viewState?.zoomFactor ?? 2);
    setSpriteImagesSeparated(context.viewState?.spriteImagesSeparated ?? true);
    setShowTrancparencyColor(context.viewState?.showTrancparencyColor ?? false);
    setPencilColorIndex(context.viewState?.pencilColorIndex ?? 0x0f);
    setFillColorIndex(context.viewState?.fillColorIndex ?? 0xe3);
    const spriteIndex = context.viewState?.selectedSpriteIndex ?? 0;
    setSelectedSpriteIndex(spriteIndex);
    setSpriteMap(context.fileInfo?.sprites?.[spriteIndex]);
    setCurrentRow("-");
    setCurrentColumn("-");
    setCurrentColorIndex(context.viewState?.currentColorIndex ?? -1);
    setCurrentTool(context.viewState?.currentTool ?? "pointer");
  }, [context.viewState]);

  // --- Update the context view state whenever the internal state changes
  useEffect(() => {
    context.changeViewState(vs => {
      vs.zoomFactor = zoomFactor;
      vs.spriteImagesSeparated = spriteImagesSeparated;
      vs.showTrancparencyColor = showTrancparencyColor;
      vs.pencilColorIndex = pencilColorIndex;
      vs.fillColorIndex = fillColorIndex;
      vs.selectedSpriteIndex = selectedSpriteIndex;
      vs.currentColorIndex = currentColorIndex;
      vs.currentTool = currentTool;
    });
  }, [
    zoomFactor,
    spriteImagesSeparated,
    showTrancparencyColor,
    pencilColorIndex,
    fillColorIndex,
    selectedSpriteIndex,
    currentColorIndex,
    currentTool
  ]);

  // --- Update the sprite map whenever the current map changes
  const updateSpriteMap = async (
    newSpriteMap: Uint8Array,
    selectedIndex?: number
  ) => {
    if (selectedIndex) {
      setSelectedSpriteIndex(selectedIndex);
    }
    setSpriteMap(newSpriteMap);
    if (context.fileInfo?.sprites) {
      context.fileInfo.sprites[selectedIndex ?? selectedSpriteIndex] =
        newSpriteMap;
    }

    // --- Save the file to the project
    const sprites = new Uint8Array(16 * 16 * context.fileInfo?.sprites?.length);
    let offset = 0;
    for (const sprite of context.fileInfo?.sprites) {
      sprites.set(sprite, offset);
      offset += 16 * 16;
    }
    await context.saveToFile(sprites);
  };

  // --- Implement Undo operation
  const undo = () => {
    if (editStackIndex < 0) {
      return;
    }
    const edit = editStack[editStackIndex];
    console.log(editStackIndex, editStack.length, editStack, edit);
    if (edit.type === "SpriteListChange") {
      context.fileInfo.sprites = edit.oldSpriteList.slice(0);
      setSelectedSpriteIndex(edit.oldSpriteIndex);
      updateSpriteMap(context.fileInfo.sprites[edit.oldSpriteIndex]);
    } else {
      updateSpriteMap(edit.oldSpriteMap);
    }
    setEditStackIndex(editStackIndex - 1);
  };

  // --- Implement Redo operation
  const redo = () => {
    if (editStackIndex >= editStack.length - 1) {
      return;
    }
    const edit = editStack[editStackIndex + 1];
    console.log(editStackIndex, editStack.length, editStack, edit);
    if (edit.type === "SpriteListChange") {
      context.fileInfo.sprites = edit.newSpriteList.slice(0);
      setSelectedSpriteIndex(edit.newSpriteIndex);
      updateSpriteMap(context.fileInfo.sprites[edit.newSpriteIndex]);
    } else {
      updateSpriteMap(edit.newSpriteMap);
    }
    setEditStackIndex(editStackIndex + 1);
  };

  // --- Push an edit to the stack
  const pushEdit = (edit: EditInfo) => {
    if (editStack.length === 0) {
      setEditStack([edit]);
      setEditStackIndex(0);
    } else {
      const newStack = editStack.slice(0, editStackIndex + 1);
      newStack.push(edit);
      setEditStack(newStack);
      setEditStackIndex(newStack.length - 1);
    }
  };

  // --- Render the toolbar for sprites in the file
  const SpriteFileToolbar = () => (
    <Row>
      <SmallIconButton
        iconName='undo'
        title={"Undo"}
        enable={editStackIndex >= 0}
        clicked={() => undo()}
      />
      <SmallIconButton
        iconName='redo'
        title={"Redo"}
        enable={editStackIndex < editStack.length - 1}
        clicked={async () => redo()}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName='@duplicate'
        title={"Duplicate sprite"}
        enable={true}
        clicked={async () => {
          const sprites = context.fileInfo?.sprites;

          const editInfo: EditInfo = {
            type: "SpriteListChange",
            oldSpriteIndex: selectedSpriteIndex,
            oldSpriteList: sprites?.slice?.(0)
          };

          const sprite = sprites[selectedSpriteIndex];
          const newSprite = new Uint8Array(sprite);
          sprites.splice(selectedSpriteIndex, 0, newSprite);

          editInfo.newSpriteIndex = selectedSpriteIndex;
          editInfo.newSpriteList = sprites.slice(0);
          pushEdit(editInfo);

          await updateSpriteMap(newSprite);
        }}
      />
      <SmallIconButton
        iconName='@cut'
        title={"Cut sprite"}
        enable={context.fileInfo?.sprites?.length > 1}
        clicked={async () => {
          const sprites = context.fileInfo?.sprites;
          if (sprites.length < 2) {
            return;
          }

          const editInfo: EditInfo = {
            type: "SpriteListChange",
            oldSpriteIndex: selectedSpriteIndex,
            oldSpriteList: sprites?.slice?.(0)
          };

          let newIndex = selectedSpriteIndex;
          sprites.splice(newIndex, 1);
          if (newIndex > sprites.length - 1) {
            newIndex = sprites.length - 1;
          }

          editInfo.newSpriteIndex = newIndex;
          editInfo.newSpriteList = sprites.slice(0);
          pushEdit(editInfo);

          setSpriteMap(sprites[newIndex]);
          setSelectedSpriteIndex(newIndex);
        }}
      />
      <SmallIconButton
        iconName='@move-left'
        title={"Move sprite left"}
        enable={selectedSpriteIndex > 0}
        clicked={async () => {
          const sprites = context.fileInfo?.sprites;

          const editInfo: EditInfo = {
            type: "SpriteListChange",
            oldSpriteIndex: selectedSpriteIndex,
            oldSpriteList: sprites?.slice?.(0)
          };

          const sprite = sprites[selectedSpriteIndex];
          let newIndex = selectedSpriteIndex - 1;
          sprites[selectedSpriteIndex] = sprites[newIndex];
          sprites[newIndex] = sprite;

          editInfo.newSpriteIndex = newIndex;
          editInfo.newSpriteList = sprites.slice(0);
          pushEdit(editInfo);

          setSelectedSpriteIndex(newIndex);
          updateSpriteMap(sprite, newIndex);
        }}
      />
      <SmallIconButton
        iconName='@move-right'
        title={"Move sprite right"}
        enable={selectedSpriteIndex < context.fileInfo?.sprites?.length - 1}
        clicked={async () => {
          const sprites = context.fileInfo?.sprites;

          const editInfo: EditInfo = {
            type: "SpriteListChange",
            oldSpriteIndex: selectedSpriteIndex,
            oldSpriteList: sprites?.slice?.(0)
          };

          const sprite = sprites[selectedSpriteIndex];
          let newIndex = selectedSpriteIndex + 1;
          sprites[selectedSpriteIndex] = sprites[newIndex];
          sprites[newIndex] = sprite;

          editInfo.newSpriteIndex = newIndex;
          editInfo.newSpriteList = sprites.slice(0);
          pushEdit(editInfo);

          setSelectedSpriteIndex(newIndex);
          updateSpriteMap(sprite, newIndex);
        }}
      />
      <SmallIconButton
        iconName='@plus'
        title={"Add new sprite"}
        enable={true}
        clicked={async () => {
          const sprites = context.fileInfo?.sprites;
          const newSprite = new Uint8Array(256);
          for (let i = 0; i < 256; i++) {
            newSprite[i] = 0xe3;
          }
          sprites.splice(selectedSpriteIndex, 0, newSprite);
          await updateSpriteMap(newSprite);
        }}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName='@separate-vertical'
        title={`${
          spriteImagesSeparated ? "Merge" : "Separate"
        } sprites vertically`}
        selected={spriteImagesSeparated}
        enable={true}
        clicked={async () => setSpriteImagesSeparated(!spriteImagesSeparated)}
      />
      <SmallIconButton
        iconName='@transparent'
        title={`${showTrancparencyColor ? "Hide" : "Show"} transparency color`}
        selected={showTrancparencyColor}
        enable={true}
        clicked={async () => setShowTrancparencyColor(!showTrancparencyColor)}
      />
      {selectedSpriteIndex !== undefined &&
        context?.fileInfo?.sprites?.length > 0 && (
          <>
            <ToolbarSeparator small={true} />
            <LabelSeparator width={8} />
            <Text
              text={`Sprite #${selectedSpriteIndex + 1} of ${
                context.fileInfo.sprites.length
              }`}
            />
          </>
        )}
    </Row>
  );

  const SpriteEditorToolbar = () => (
    <Row>
      <SmallIconButton
        iconName='@zoom-in'
        title={"Zoom-in"}
        enable={zoomFactor < 3}
        clicked={() => setZoomFactor(zoomFactor + 1)}
      />
      <SmallIconButton
        iconName='@zoom-out'
        title={"Zoom-out"}
        enable={zoomFactor > 1}
        clicked={() => setZoomFactor(zoomFactor - 1)}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName='@pointer'
        title={"Pencil tool"}
        selected={currentTool === "pointer"}
        clicked={() => setCurrentTool("pointer")}
      />
      <SmallIconButton
        iconName='@pencil'
        title={"Pencil tool"}
        selected={currentTool === "pencil"}
        clicked={() => setCurrentTool("pencil")}
      />
      <SmallIconButton
        iconName='@line'
        title={"Line tool"}
        selected={currentTool === "line"}
        clicked={() => setCurrentTool("line")}
      />
      <SmallIconButton
        iconName='@rectangle'
        title={"Rectangle tool"}
        selected={currentTool === "rectangle"}
        clicked={() => setCurrentTool("rectangle")}
      />
      <SmallIconButton
        iconName='@rectangle-filled'
        title={"Filled rectangle tool"}
        selected={currentTool === "rectangle-filled"}
        clicked={() => setCurrentTool("rectangle-filled")}
      />
      <SmallIconButton
        iconName='@circle'
        title={"Circle tool"}
        selected={currentTool === "circle"}
        clicked={() => setCurrentTool("circle")}
      />
      <SmallIconButton
        iconName='@circle-filled'
        title={"Filled circle tool"}
        selected={currentTool === "circle-filled"}
        clicked={() => setCurrentTool("circle-filled")}
      />
      <SmallIconButton
        iconName='@paint'
        title={"Paint tool"}
        selected={currentTool === "paint"}
        clicked={() => setCurrentTool("paint")}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName='@rotate'
        title={"Rotate counter-clockwise"}
        clicked={async () => {
          const result = new Uint8Array(16 * 16);
          for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
              result[row * 16 + col] = spriteMap[col * 16 + 15 - row];
            }
          }
          await updateSpriteMap(result);
        }}
      />
      <SmallIconButton
        iconName='@rotate-clockwise'
        title={"Rotate clockwise"}
        clicked={async () => {
          const result = new Uint8Array(16 * 16);
          for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
              result[row * 16 + col] = spriteMap[(15 - col) * 16 + row];
            }
          }
          await updateSpriteMap(result);
        }}
      />
      <SmallIconButton
        iconName='@flip-vertical'
        title={"Flip vertically"}
        clicked={async () => {
          const result = new Uint8Array(16 * 16);
          for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
              result[row * 16 + col] = spriteMap[row * 16 + (15 - col)];
            }
          }
          await updateSpriteMap(result);
        }}
      />
      <SmallIconButton
        iconName='@flip-horizontal'
        title={"Flip horizontally"}
        clicked={async () => {
          const result = new Uint8Array(16 * 16);
          for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
              result[row * 16 + col] = spriteMap[(15 - row) * 16 + col];
            }
          }
          await updateSpriteMap(result);
        }}
      />
    </Row>
  );

  // --- Render the editor
  return viewStateInitialized.current ? (
    <>
      <SpriteFileToolbar />
      <ScrollViewer
        xclass={styles.spriteScroller}
        scrollBarWidth={4}
        allowVertical={false}
      >
        {context.fileInfo?.sprites &&
          context.fileInfo.sprites.map((spr, idx) => {
            return (
              <SpriteImage
                key={idx}
                title={`Sprite #${idx + 1} of ${
                  context.fileInfo.sprites.length
                }`}
                spriteMap={spr}
                palette={palette}
                transparencyIndex={0xe3}
                separated={spriteImagesSeparated}
                showTransparencyColor={showTrancparencyColor}
                selected={selectedSpriteIndex === idx}
                clicked={() => {
                  setSelectedSpriteIndex(idx);
                  setSpriteMap(spr);
                }}
              />
            );
          })}
      </ScrollViewer>
      <SpriteEditorToolbar />
      <Panel xclass={styles.editorPanel}>
        <Row xclass={styles.editorInfo}>
          <LabelSeparator width={8} />
          <Text text='Pencil color:' />
          <LabelSeparator width={8} />
          <ColorSample
            color={palette[pencilColorIndex]}
            isTransparency={pencilColorIndex === 0xe3}
          />
          <LabelSeparator width={8} />
          <SmallIconButton
            iconName='@swap'
            title='Swap colors'
            enable={true}
            clicked={async () => {
              setPencilColorIndex(fillColorIndex);
              setFillColorIndex(pencilColorIndex);
            }}
          />
          <LabelSeparator width={4} />
          <Text text='Fill color:' />
          <LabelSeparator width={8} />
          <ColorSample
            color={palette[fillColorIndex]}
            isTransparency={fillColorIndex === 0xe3}
          />
          <LabelSeparator width={8} />
          <ToolbarSeparator small={true} />
          <Text text='Position:' />
          <Value text={`(${currentRow}:${currentColumn})`} width={60} />
          <Text text='Color:' />
          <Value
            text={
              currentColorIndex >= 0 ? "$" + toHexa2(currentColorIndex) : "-"
            }
            width={32}
          />
          {currentColorIndex >= 0 && (
            <ColorSample
              color={palette[currentColorIndex]}
              isTransparency={currentColorIndex === 0xe3}
            />
          )}
          <LabelSeparator width={8} />
          {rgbParts && (
            <Value
              text={`(R: ${rgbParts[0]}, G: ${rgbParts[1]}, B: ${rgbParts[2]})`}
            />
          )}
        </Row>
        <Row>
          <div className={styles.editorArea}>
            <SpriteEditorGrid
              zoomFactor={zoomFactor}
              spriteMap={spriteMap}
              palette={palette}
              transparencyIndex={0xe3}
              pencilColorIndex={pencilColorIndex}
              fillColorIndex={fillColorIndex}
              tool={currentTool}
              onPositionChange={(row, col) => {
                setCurrentRow(row?.toString() ?? "-");
                setCurrentColumn(col?.toString() ?? "-");
                setCurrentColorIndex(
                  row !== undefined && col !== undefined
                    ? spriteMap[row * 16 + col]
                    : -1
                );
              }}
              onSpriteChange={(newSpriteMap: Uint8Array) => {
                updateSpriteMap(newSpriteMap);
              }}
              onSignEscape={() =>
                context.changeViewState(vs => (vs.currentTool = "pointer"))
              }
            />
            <Column>
              <NextPaletteViewer
                palette={defaultPalette}
                transparencyIndex={0xe3}
                allowSelection={true}
                smallDisplay={true}
                onSelection={idx => setPencilColorIndex(idx)}
                onRightClick={idx => setFillColorIndex(idx)}
              />
            </Column>
          </div>
        </Row>
      </Panel>
    </>
  ) : null;
};

type ColorSampleProps = {
  color: number;
  isTransparency?: boolean;
};

// --- Helper component to represent a color sample
const ColorSample = memo(({ color, isTransparency }: ColorSampleProps) => {
  const backgroundColor = getCssStringForPaletteCode(color);
  const midColor = getLuminanceForPaletteCode(color) < 3.5 ? "white" : "black";

  return (
    <div className={styles.colorSample} style={{ backgroundColor }}>
      {isTransparency && (
        <svg viewBox='0 0 16 16'>
          <circle cx={8} cy={8} r={5} fill={midColor} fillOpacity={0.5} />
        </svg>
      )}
    </div>
  );
});

type EditInfo = {
  type: "SpriteListChange" | "SpriteChange";
  oldSpriteIndex?: number;
  oldSpriteList?: Uint8Array[];
  oldSpriteMap?: Uint8Array;
  newSpriteIndex?: number;
  newSpriteList?: Uint8Array[];
  newSpriteMap?: Uint8Array;
};
