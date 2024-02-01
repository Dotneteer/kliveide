import { Panel } from "@renderer/controls/generic/Panel";
import styles from "./PaletteEditor.module.scss";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Dropdown } from "@renderer/controls/Dropdown";
import { useState } from "react";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode
} from "@emu/machines/zxNext/palette";
import classnames from "@renderer/utils/classnames";
import { set } from "lodash";

const paletteTypeIds = [
  { value: "9", label: "9-bit (RRR-GGG-BBB)" },
  { value: "8", label: "8-bit (RRR-GGG-BB)" }
];

type Props = {
  palette: number[];
  transparencyIndex?: number;
  onChange?: (palette: number[]) => void;
};

const levels9 = [0, 1, 2, 3, 4, 5, 6, 7];
const levels8 = [0, 2, 4, 6];

export const PaletteEditor = ({ palette, transparencyIndex }: Props) => {
  const [use8Bit, setUse8Bit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedColor, setSelectedColor] = useState<string>(null);
  const [selectedR, setSelectedR] = useState<number>(null);
  const [selectedG, setSelectedG] = useState<number>(null);
  const [selectedB, setSelectedB] = useState<number>(null);
  const midColor =
    selectedIndex !== null
      ? getLuminanceForPaletteCode(palette[selectedIndex]) < 3.5
        ? "white"
        : "black"
      : "transparent";
  return (
    <Panel>
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
            <LabeledText
              label='Selected Index: '
              value={
                selectedIndex !== null
                  ? `$${toHexa2(selectedIndex)} (${selectedIndex.toString(10)})`
                  : "(none)"
              }
            />
          </Row>
          <Row>
            <div
              className={styles.colorBar}
              style={{ backgroundColor: selectedColor }}
            >
              <span style={{color: midColor}}>{`R: ${selectedR}, G: ${selectedG}, B: ${selectedB}`}</span>
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
                  use8Bit={use8Bit}
                  selected={selectedR === level}
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
                  use8Bit={use8Bit}
                  selected={selectedG === level}
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
                  use8Bit={use8Bit}
                  selected={selectedB === level}
                />
              ))}
            </ColorScale>
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
            setSelectedColor(getCssStringForPaletteCode(palette[index]));
            setSelectedR((palette[index] >> 5) & 0x07);
            setSelectedG((palette[index] >> 2) & 0x07);
            setSelectedB(
              ((palette[index] & 0x03) << 1) |
                (use8Bit ? 0x00 : (palette[index] & 0x100) >> 8)
            );
            console.log(
              (palette[index] >> 5) & 0x07,
              (palette[index] >> 2) & 0x07
            );
          }}
        />
      </Row>
    </Panel>
  );
};

const ColorScale = ({ children }: { children?: React.ReactNode }) => {
  return <div className={styles.colorScale}>{children}</div>;
};

type ColorItemProps = {
  component: "R" | "G" | "B";
  level: number;
  use8Bit: boolean;
  selected?: boolean;
  onSelected?: () => void;
};

const ColorItem = ({
  component,
  level,
  use8Bit,
  selected,
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
      className={styles.colorItem}
      style={{
        borderColor: selected ? "var(--color-text-hilite)" : undefined
      }}
    >
      <div className={styles.colorTag} style={{ backgroundColor: color }}>
        <span style={{ color: midColor }}>{level}</span>
      </div>
    </div>
  );
};
