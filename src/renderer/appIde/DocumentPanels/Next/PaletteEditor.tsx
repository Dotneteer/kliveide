import styles from "./PaletteEditor.module.scss";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { useEffect, useState } from "react";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode
} from "@emu/machines/zxNext/palette";
import { Label } from "@renderer/controls/generic/Label";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import classnames from "classnames";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { KeyHandler } from "@renderer/controls/generic/KeyHandler";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Column } from "@renderer/controls/generic/Column";
import { Panel } from "@renderer/controls/generic/Panel";

type Props = {
  palette: number[];
  initialTransparencyIndex?: number;
  initialIndex?: number;
  onChange?: (index: number) => void;
  onUpdated?: (palette: number[], transparencyIndex?: number) => void;
  allowTransparencySelection?: boolean;
};

const levels9 = [0, 1, 2, 3, 4, 5, 6, 7];
const levels8 = [0, 2, 4, 6];

export const PaletteEditor = ({
  palette,
  initialTransparencyIndex,
  initialIndex,
  onChange,
  onUpdated,
  allowTransparencySelection = true
}: Props) => {
  const [use8Bit, setUse8Bit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);
  const [transparencyIndex, setTransparencyIndex] = useState<number>(null);
  const [selectedColor, setSelectedColor] = useState<string>(null);
  const [selectedR, setSelectedR] = useState<number>(null);
  const [selectedG, setSelectedG] = useState<number>(null);
  const [selectedB, setSelectedB] = useState<number>(null);
  const [midColor, setMidColor] = useState<string>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [priority, setPriority] = useState<boolean>(false);
  const [version, setVersion] = useState(1);

  const [editStack, setEditStack] = useState<EditInfo[]>([]);
  const [editStackIndex, setEditStackIndex] = useState<number>(-1);

  // --- Refresht the UI contents
  const refreshContents = () => {
    if (selectedIndex !== undefined) {
      const colorCode = palette[selectedIndex];
      setSelectedColor(getCssStringForPaletteCode(colorCode));
      setSelectedR((colorCode >> 5) & 0x07);
      setSelectedG((colorCode >> 2) & 0x07);
      setSelectedB(
        ((colorCode & 0x03) << 1) | (use8Bit ? 0x00 : (colorCode & 0x100) >> 8)
      );
      setPriority(!!(colorCode & 0x8000));
      setMidColor(
        selectedIndex !== null
          ? getLuminanceForPaletteCode(palette[selectedIndex]) < 3.5
            ? "white"
            : "black"
          : "transparent"
      );
    } else {
      setSelectedColor(null);
      setSelectedR(null);
      setSelectedG(null);
      setSelectedB(null);
      setMidColor(null);
      setPriority(null);
    }
    setReady(true);
  };

  // --- Set the initial UI state
  useInitialize(() => {
    refreshContents();
    setTransparencyIndex(initialTransparencyIndex);
  });

  // --- Refresh the UI when the selected index changes
  useEffect(() => {
    refreshContents();
  }, [version, selectedIndex, palette, transparencyIndex]);

  // --- Update the color value of the selected index
  const updateColorValue = (
    r: number,
    g: number,
    b: number,
    priority: boolean
  ) => {
    const oldColorValue = palette[selectedIndex];

    const colorValue =
      (priority ? 0x8000 : 0x0000) |
      (r << 5) |
      (g << 2) |
      ((b >> 1) & 0x03) |
      ((b & 0x01) << 8);
    palette[selectedIndex] = colorValue;
    setVersion(version + 1);

    if (oldColorValue === colorValue) {
      return;
    }
    // --- Add the edit step to the stack
    if (editStack.length === 0) {
      setEditStack([
        { type: "color", index: selectedIndex, oldValue: oldColorValue, newValue: colorValue }
      ]);
      setEditStackIndex(0);
    } else {
      const clonedStack = editStack.slice(0);
      clonedStack.push({
        type: "color",
        index: selectedIndex,
        oldValue: oldColorValue,
        newValue: colorValue
      });
      setEditStack(clonedStack);
      setEditStackIndex(clonedStack.length - 1);
    }
    onUpdated?.(palette, transparencyIndex);
  };

  const updateTransparencyIndex = (index: number | null) => {
    if (index === transparencyIndex) {
      return;
    }

    // --- Add the edit step to the stack
    if (editStack.length === 0) {
      setEditStack([
        {
          type: "transparency",
          index: index,
          oldValue: transparencyIndex,
          newValue: index
        }
      ]);
      setEditStackIndex(0);
    } else {
      const clonedStack = editStack.slice(0);
      clonedStack.push({
        type: "transparency",
        index: index,
        oldValue: transparencyIndex,
        newValue: index
      });
      setEditStack(clonedStack);
      setEditStackIndex(clonedStack.length - 1);
    }
    setTransparencyIndex(index);
    onUpdated?.(palette, index);
  };

  // --- Implement Undo operation
  const undo = () => {
    if (editStackIndex < 0) {
      return;
    }
    const edit = editStack[editStackIndex];
    if (edit.type === "transparency") {
      setTransparencyIndex(edit.oldValue);
    } else {
      palette[edit.index] = edit.oldValue;
    }
    setEditStackIndex(editStackIndex - 1);
    setSelectedIndex(edit.index);
    setVersion(version + 1);
  };

  // --- Implement Redo operation
  const redo = () => {
    if (editStackIndex >= editStack.length - 1) {
      return;
    }
    const edit = editStack[editStackIndex + 1];
    if (edit.type === "transparency") {
      setTransparencyIndex(edit.newValue);
    } else {
      palette[edit.index] = edit.newValue;
    }
    setEditStackIndex(editStackIndex + 1);
    setSelectedIndex(edit.index);
    setVersion(version + 1);
  };

  // --- Handle common keys
  const handleCommonKeys = (key: string) => {
    switch (key) {
      case "Digit8":
        setUse8Bit(true);
        break;
      case "Digit9":
        setUse8Bit(false);
        break;
      case "KeyT":
        if (allowTransparencySelection && selectedIndex !== undefined) {
          updateTransparencyIndex(selectedIndex);
        }
        break;
      case "KeyC":
        if (allowTransparencySelection) {
          updateTransparencyIndex(null);
        }
        break;
    }
  };

  return ready ? (
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
            enable={editStackIndex >= 0}
            clicked={async () => {
              undo();
            }}
          />
          <SmallIconButton
            iconName='redo'
            title={"Redo"}
            enable={editStackIndex < editStack.length - 1}
            clicked={async () => {
              redo();
            }}
          />
          <ToolbarSeparator small={true} />
          <LabeledSwitch
            value={use8Bit}
            label='Use 8-Bit Palette:'
            title='Use an 8-bit palette instead of a 9-bit palette'
            clicked={setUse8Bit}
          />
          {allowTransparencySelection && (
            <>
              <ToolbarSeparator small={true} />
              <LabeledText
                label='Transparency Color:'
                value={
                  typeof transparencyIndex === "number"
                    ? `$${toHexa2(transparencyIndex)} (${transparencyIndex})`
                    : "(none)"
                }
              />
            </>
          )}
        </KeyHandler>
      </Row>
      <Panel xclass={styles.editorPanel}>
        <Row>
        <div className={styles.editorArea}>
          <Row>
            <div
              className={styles.colorBar}
              style={{ backgroundColor: selectedColor }}
            >
              {selectedIndex != undefined && (
                <span style={{ color: midColor }}>{`Color $${toHexa2(
                  selectedIndex
                )} (${selectedIndex.toString(10)})`}</span>
              )}
              {selectedIndex == undefined && <Label text='No color selected' />}
            </div>
          </Row>
          <Row xclass={styles.colorRow}>
            <ColorScale
              useIncrement2={false}
              level={selectedR}
              onLevelChanged={level => {
                setSelectedR(level);
                updateColorValue(level, selectedG, selectedB, priority);
              }}
              onOtherKey={handleCommonKeys}
            >
              <div
                className={styles.colorScaleLabel}
                style={{ color: "var(--console-ansi-bright-red)" }}
              >
                Red
              </div>
              {levels9.map(level => (
                <ColorItem
                  key={level}
                  component='R'
                  level={level}
                  allowSelection={selectedIndex !== undefined}
                  selected={selectedR === level}
                  onSelected={() =>
                    updateColorValue(level, selectedG, selectedB, priority)
                  }
                />
              ))}
            </ColorScale>
            <ColorScale
              useIncrement2={false}
              level={selectedG}
              onLevelChanged={level => {
                setSelectedG(level);
                updateColorValue(selectedR, level, selectedB, priority);
              }}
              onOtherKey={handleCommonKeys}
            >
              <div
                className={styles.colorScaleLabel}
                style={{ color: "var(--console-ansi-bright-green)" }}
              >
                Green
              </div>
              {levels9.map(level => (
                <ColorItem
                  key={level}
                  component='G'
                  level={level}
                  allowSelection={selectedIndex !== undefined}
                  selected={selectedG === level}
                  onSelected={() =>
                    updateColorValue(selectedR, level, selectedB, priority)
                  }
                />
              ))}
            </ColorScale>
            <ColorScale
              useIncrement2={use8Bit}
              level={selectedB}
              onLevelChanged={level => {
                setSelectedB(level);
                updateColorValue(selectedR, selectedG, level, priority);
              }}
              onOtherKey={handleCommonKeys}
            >
              <div
                className={styles.colorScaleLabel}
                style={{ color: "var(--console-ansi-bright-blue)" }}
              >
                Blue
              </div>
              {(use8Bit ? levels8 : levels9).map(level => (
                <ColorItem
                  key={level}
                  component='B'
                  level={level}
                  allowSelection={selectedIndex !== undefined}
                  selected={
                    use8Bit && selectedIndex !== undefined
                      ? (selectedB & 0x06) === level
                      : selectedB === level
                  }
                  onSelected={() =>
                    updateColorValue(selectedR, selectedG, level, priority)
                  }
                />
              ))}
            </ColorScale>
          </Row>
          <Column xclass={styles.trIndex}>
            <Row>
              <LabeledText label='Click palette:' value='Select color' />
            </Row>
            <Row>
              <LabeledText label='Click R, G, B:' value='Select channel' />
            </Row>
            <Row>
              <LabeledText label='Arrows:' value='Change selection' />
            </Row>
            <Row>
              <LabeledText label='Key 8:' value='Use 8-bit palette' />
            </Row>
            <Row>
              <LabeledText label='Key 9:' value='Use 8-bit palette' />
            </Row>
            <Row>
              <LabeledText label='Space/Enter:' value='Toggle priority' />
            </Row>
            {allowTransparencySelection && (
              <Row>
                <LabeledText label='Key T, C:' value='Set/reset transp.' />
              </Row>
            )}
            <Row>
              <LabeledText label='(Shift +) TAB:' value='Move focus' />
            </Row>
          </Column>
        </div>
        <NextPaletteViewer
          palette={palette}
          transparencyIndex={transparencyIndex}
          use8Bit={use8Bit}
          usePriority={true}
          allowSelection={true}
          onSelection={index => {
            setSelectedIndex(index);
            onChange?.(index);
          }}
          onPriority={() => {
            setPriority(!priority);
            updateColorValue(selectedR, selectedG, selectedB, !priority);
          }}
          selectedIndex={selectedIndex}
          onOtherKey={handleCommonKeys}
        />
        </Row>
      </Panel>
    </>
  ) : null;
};

type ColorScaleProps = {
  children: React.ReactNode;
  useIncrement2: boolean;
  level?: number;
  onOtherKey?: (key: string) => void;
  onLevelChanged: (level: number) => void;
};

const ColorScale = ({
  children,
  useIncrement2,
  level,
  onOtherKey,
  onLevelChanged
}: ColorScaleProps) => {
  return (
    <KeyHandler
      xclass={styles.colorScale}
      onKey={key => {
        switch (key) {
          case "ArrowUp":
            if (typeof level === "number") {
              onLevelChanged(
                useIncrement2 ? ((level & 0x06) - 2) & 0x07 : (level - 1) & 0x07
              );
            }
            break;
          case "ArrowDown":
            if (typeof level === "number") {
              onLevelChanged(
                useIncrement2 ? ((level & 0x06) + 2) & 0x07 : (level + 1) & 0x07
              );
            }
            break;
          default:
            onOtherKey?.(key);
            break;
        }
      }}
    >
      {children}
    </KeyHandler>
  );
};

type ColorItemProps = {
  component: "R" | "G" | "B";
  level: number;
  selected?: boolean;
  allowSelection: boolean;
  onSelected?: () => void;
};

const ColorItem = ({
  component,
  level,
  selected,
  allowSelection,
  onSelected
}: ColorItemProps) => {
  const colorValue =
    component === "R"
      ? level << 5
      : component === "G"
      ? level << 2
      : (level >> 1) | ((level & 0x01) << 8);

  const color = getCssStringForPaletteCode(colorValue);
  const midColor =
    getLuminanceForPaletteCode(colorValue) < 3.5 ? "white" : "black";
  return (
    <div
      className={classnames(styles.colorItem, {
        [styles.allowSelect]: allowSelection
      })}
      style={{
        borderColor: selected ? "var(--color-text-hilite)" : undefined
      }}
      onClick={() => {
        if (allowSelection) {
          onSelected?.();
        }
      }}
    >
      <div className={styles.colorTag} style={{ backgroundColor: color }}>
        <span style={{ color: midColor }}>{level}</span>
      </div>
    </div>
  );
};

// --- Represents an edit step
type EditInfo = {
  type: "color" | "transparency";
  index: number;
  oldValue?: number;
  newValue?: number;
};
