import { Panel } from "@renderer/controls/generic/Panel";
import styles from "./PaletteEditor.module.scss";
import { Row } from "@renderer/controls/generic/Row";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { Dropdown } from "@renderer/controls/Dropdown";
import { useState } from "react";
import { LabeledText } from "@renderer/controls/generic/LabeledText";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { getCssStringForPaletteCode } from "@emu/machines/zxNext/palette";

const paletteTypeIds = [
  { value: "9", label: "9-bit (RRR-GGG-BBB)" },
  { value: "8", label: "8-bit (RRR-GGG-BB)" }
];

type Props = {
  palette: number[];
  transparencyIndex?: number;
  onChange?: (palette: number[]) => void;
};

export const PaletteEditor = ({ palette, transparencyIndex }: Props) => {
  const [use8Bit, setUse8Bit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedColor, setSelectedColor] = useState<string>(null);
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
            <div className={styles.colorBar} style={{backgroundColor: selectedColor}}></div>
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
          }}
        />
      </Row>
    </Panel>
  );
};
