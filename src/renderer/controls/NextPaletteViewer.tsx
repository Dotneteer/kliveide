import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { Column, Label, Row } from "./GeneralControls";
import styles from "./NextPaletteViewer.module.scss";
import {
  getCssStringForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { TooltipFactory } from "./Tooltip";
import { useRef, useState } from "react";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";

const ROW_LABEL_WIDTH = 20;
const PAL_ENTRY_WIDTH = 22;

type Props = {
  palette: number[];
};

export const NextPaletteViewer = ({ palette }: Props) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Column>
      <Row>
        <div className={styles.paletteRowLabel} />
        {indexes.map(idx => (
          <div key={idx} className={styles.paletteColumnLabel}>
            {toHexa2(idx)}
          </div>
        ))}
      </Row>
      {indexes.map(idx => (
        <PaletteRow key={idx} palette={palette} firstIndex={idx * 0x10} />
      ))}
    </Column>
  );
};

type PaletteRowProps = {
  firstIndex: number;
  palette: number[];
};

const PaletteRow = ({ firstIndex, palette }: PaletteRowProps) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Row>
      <div className={styles.paletteRowLabel}>{toHexa2(firstIndex)}</div>
      {indexes.map(idx => (
        <PaletteItem
          key={idx}
          index={firstIndex + idx}
          value={palette[firstIndex + idx]}
        />
      ))}
    </Row>
  );
};

type PaletteItemProps = {
  index: number;
  value: number;
};

const PaletteItem = ({ index, value }: PaletteItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState(null);
  const [g, setG] = useState(null);
  const [b, setB] = useState(null);

  useInitializeAsync(async () => {
    const [rC, gC, bC] = getRgbPartsForPaletteCode(value);
    setR(rC);
    setG(gC); 
    setB(bC);
  });

  return (
    <>
      <div
        ref={ref}
        className={styles.paletteItem}
        style={{ backgroundColor: getCssStringForPaletteCode(value) }}
      >
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={8}
          offsetY={32}
          showDelay={100}
        >
          <div>{`R: ${r}, G: ${g}, B: ${b}`}</div>
        </TooltipFactory>
      </div>
    </>
  );
};