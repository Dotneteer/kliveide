import styles from "./PaletteEditor.module.scss";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Dropdown } from "@renderer/controls/Dropdown";
import { useEffect, useState } from "react";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode
} from "@emu/machines/zxNext/palette";
import { Label } from "@renderer/controls/generic/Label";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import classnames from "@renderer/utils/classnames";

const paletteTypeIds = [
  { value: "9", label: "9-bit (RRR-GGG-BBB)" },
  { value: "8", label: "8-bit (RRR-GGG-BB)" }
];

type Props = {
  palette: number[];
  transparencyIndex?: number;
  initialIndex?: number;
  onChange?: (index: number) => void;
};

const levels9 = [0, 1, 2, 3, 4, 5, 6, 7];
const levels8 = [0, 2, 4, 6];

export const PaletteEditor = ({
  palette,
  transparencyIndex,
  initialIndex,
  onChange
}: Props) => {
  const [use8Bit, setUse8Bit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);
  const [selectedColor, setSelectedColor] = useState<string>(null);
  const [selectedR, setSelectedR] = useState<number>(null);
  const [selectedG, setSelectedG] = useState<number>(null);
  const [selectedB, setSelectedB] = useState<number>(null);
  const [midColor, setMidColor] = useState<string>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [priority, setPriority] = useState<boolean>(false);
  const [version, setVersion] = useState(1);

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
      console.log("priority", !!(colorCode & 0x8000));
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
  useInitialize(() => refreshContents());

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
    const colorValue =
      (priority ? 0x8000 : 0x0000) |
      (r << 5) |
      (g << 2) |
      ((b >> 1) & 0x03) |
      ((b & 0x01) << 8);
    palette[selectedIndex] = colorValue;
    setVersion(version + 1);
  };

  return ready ? (
    <>
      <Row xclass={styles.editorPanel}>
        <div className={styles.editorArea}>
          <div className={styles.dropdownWrapper}>
            <Dropdown
              placeholder='Select...'
              options={paletteTypeIds}
              value={"9"}
              width={240}
              onSelectionChanged={option => {
                setUse8Bit(option === "8");
              }}
            />
          </div>
          <Row>
            <div
              className={styles.colorBar}
              style={{ backgroundColor: selectedColor }}
            >
              {selectedIndex != undefined && (
                <span style={{ color: midColor }}>{`Color $${toHexa2(
                  selectedIndex
                )} (${selectedIndex.toString(
                  10
                )}): RGB(${selectedR}, ${selectedG}, ${selectedB})`}</span>
              )}
              {selectedIndex == undefined && <Label text='No color selected' />}
            </div>
          </Row>
          <Row xclass={styles.colorRow}>
            <ColorScale>
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
            <ColorScale>
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
            <ColorScale>
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
                  selected={selectedB === level}
                  onSelected={() =>
                    updateColorValue(selectedR, selectedG, level, priority)
                  }
                />
              ))}
            </ColorScale>
          </Row>
          <Row xclass={styles.trIndex}>
            <LabeledText
              label='Transparency Color:'
              value={
                typeof transparencyIndex === "number"
                  ? `$${toHexa2(transparencyIndex)} (${transparencyIndex})`
                  : "(none)"
              }
            />
          </Row>
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
          onPriority={index => {
            setPriority(!priority);
            updateColorValue(selectedR, selectedG, selectedB, !priority);
          }}
        />
      </Row>
    </>
  ) : null;
};

const ColorScale = ({ children }: { children?: React.ReactNode }) => {
  return <div className={styles.colorScale}>{children}</div>;
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
