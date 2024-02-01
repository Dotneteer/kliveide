import styles from "./NextPaletteViewer.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { TooltipFactory } from "./Tooltip";
import { useRef, useState } from "react";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import { Row } from "./generic/Row";
import { Column } from "./generic/Column";

type Props = {
  palette: number[];
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  selectedIndex?: number;
};

export const NextPaletteViewer = ({
  palette,
  use8Bit = false,
  usePriority = false,
  transparencyIndex = 0xe3,
  allowSelection,
  onSelection,
  selectedIndex
}: Props) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const [selected, setSelected] = useState<number>(selectedIndex);
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
        <PaletteRow
          key={idx}
          palette={palette}
          firstIndex={idx * 0x10}
          use8Bit={use8Bit}
          usePriority={usePriority}
          transparencyIndex={transparencyIndex}
          allowSelection={allowSelection}
          onSelection={idx => {
            if (allowSelection) {
              setSelected(idx);
              onSelection?.(idx);
            }
          }}
          selectedIndex={selected}
        />
      ))}
    </Column>
  );
};

type PaletteRowProps = {
  firstIndex: number;
  palette: number[];
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  selectedIndex?: number;
};

const PaletteRow = ({
  firstIndex,
  palette,
  use8Bit,
  usePriority,
  transparencyIndex,
  allowSelection,
  onSelection,
  selectedIndex
}: PaletteRowProps) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Row>
      <div className={styles.paletteRowLabel}>{toHexa2(firstIndex)}</div>
      {indexes.map(idx => (
        <PaletteItem
          key={idx}
          index={firstIndex + idx}
          value={palette[firstIndex + idx]}
          use8Bit={use8Bit}
          usePriority={usePriority}
          transparencyIndex={transparencyIndex}
          allowSelection={allowSelection}
          onSelection={onSelection}
          selectedIndex={selectedIndex}
        />
      ))}
    </Row>
  );
};

type PaletteItemProps = {
  index: number;
  value: number;
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  selectedIndex?: number;
};

const PaletteItem = ({
  index,
  value,
  use8Bit,
  usePriority,
  transparencyIndex,
  allowSelection,
  onSelection,
  selectedIndex
}: PaletteItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState(null);
  const [g, setG] = useState(null);
  const [b, setB] = useState(null);

  useInitialize(() => {
    const [rC, gC, bC] = getRgbPartsForPaletteCode(value, use8Bit);
    setR(rC);
    setG(gC);
    setB(bC);
  });

  const color = getCssStringForPaletteCode(value, use8Bit);
  const midColor =
    0.2126 * r + 0.7152 * g + 0.0722 * b < 3.5 ? "white" : "black";
  return (
    <>
      <div
        ref={ref}
        className={styles.paletteItem}
        style={{
          borderColor: usePriority ? color : undefined,
          cursor: allowSelection ? "pointer" : undefined
        }}
        onClick={() => {
          if (allowSelection) {
            onSelection?.(index);
          }
        }}
      >
        <svg>
          <circle cx={11} cy={10} r={9} fill={color} />
          {index === transparencyIndex && (
            <circle cx={11} cy={10} r={4} fill={midColor} fillOpacity={0.5} />
          )}
          {allowSelection && index === selectedIndex && (
            <circle
              cx={11}
              cy={10}
              r={5}
              stroke={midColor}
              strokeWidth={2}
              fillOpacity={0.5}
              strokeOpacity={0.5}
            />
          )}
        </svg>
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={8}
          offsetY={32}
          showDelay={100}
        >
          <div>{`$${toHexa2(index)} - R: ${r}, G: ${g}, B: ${b}${
            usePriority ? " (priority)" : ""
          }${index === transparencyIndex ? " (transparency)" : ""}`}</div>
        </TooltipFactory>
      </div>
    </>
  );
};
