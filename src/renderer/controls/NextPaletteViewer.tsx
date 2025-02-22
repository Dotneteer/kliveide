import styles from "./NextPaletteViewer.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import { useEffect, useState } from "react";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import { Row } from "./generic/Row";
import { Column } from "./generic/Column";
import { KeyHandler } from "./generic/KeyHandler";
import classnames from "classnames";

type Props = {
  palette: number[];
  smallDisplay?: boolean;
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  onRightClick?: (index: number) => void;
  selectedIndex?: number;
  onPriority?: (index: number) => void;
  onOtherKey?: (code: string) => void;
};

export const NextPaletteViewer = ({
  palette,
  smallDisplay = false,
  use8Bit = false,
  usePriority = false,
  transparencyIndex,
  allowSelection,
  onSelection,
  onRightClick,
  onPriority,
  onOtherKey,
  selectedIndex
}: Props) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const [selected, setSelected] = useState<number>();

  useEffect(() => {
    setSelected(selectedIndex);
  }, [selectedIndex]);

  return (
    <KeyHandler
      tabIndex={0}
      xclass={styles.paletteWrapper}
      onKey={code => {
        if (selected == undefined) return;
        let newSelected = selected;
        switch (code) {
          case "ArrowUp":
            newSelected = selected - 16;
            if (newSelected < 0) newSelected += 256;
            break;
          case "ArrowDown":
            newSelected = selected + 16;
            if (newSelected > 256) newSelected -= 256;
            break;
          case "ArrowLeft":
            newSelected = (selected & 0xf0) + ((selected - 1) & 0x0f);
            break;
          case "ArrowRight":
            newSelected = (selected & 0xf0) + ((selected + 1) & 0x0f);
            break;
          case "Enter":
          case "Space":
            onPriority?.(selected);
            break;
          default:
            onOtherKey?.(code);
            break;
        }
        setSelected(newSelected);
        onSelection?.(newSelected);
      }}
    >
      <Column width={smallDisplay ? 324 : 480}>
        <Row>
          {!smallDisplay && (
            <div
              className={classnames(styles.paletteRowLabel, {
                [styles.small]: smallDisplay
              })}
            />
          )}
          {!smallDisplay &&
            indexes.map(idx => (
              <div
                key={idx}
                className={classnames(styles.paletteColumnLabel, {
                  [styles.small]: smallDisplay
                })}
              >
                {toHexa2(idx)}
              </div>
            ))}
        </Row>
        {indexes.map(idx => (
          <PaletteRow
            key={idx}
            palette={palette}
            smallDisplay={smallDisplay}
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
            onRightClick={idx => {
              if (allowSelection) {
                onRightClick?.(idx);
              }
            }}
            onPriority={(idx: number) => {
              if (allowSelection) {
                setSelected(idx);
                onPriority?.(idx);
              }
            }}
            selectedIndex={selected}
          />
        ))}
      </Column>
    </KeyHandler>
  );
};

type PaletteRowProps = {
  firstIndex: number;
  palette: number[];
  smallDisplay?: boolean;
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  onRightClick?: (index: number) => void;
  onPriority?: (index: number) => void;
  selectedIndex?: number;
};

const PaletteRow = ({
  firstIndex,
  palette,
  smallDisplay,
  use8Bit,
  usePriority,
  transparencyIndex,
  allowSelection,
  onSelection,
  onRightClick,
  onPriority,
  selectedIndex
}: PaletteRowProps) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Row
      xclass={classnames(styles.paletteRow, { [styles.small]: smallDisplay })}
    >
      {!smallDisplay && (
        <div
          className={classnames(styles.paletteRowLabel, {
            [styles.small]: smallDisplay
          })}
        >
          {toHexa2(firstIndex)}
        </div>
      )}
      {indexes.map(idx => (
        <PaletteItem
          key={idx}
          index={firstIndex + idx}
          value={palette[firstIndex + idx]}
          smallDisplay={smallDisplay}
          use8Bit={use8Bit}
          usePriority={usePriority}
          transparencyIndex={transparencyIndex}
          allowSelection={allowSelection}
          onSelection={onSelection}
          onRightClick={onRightClick}
          onPriority={onPriority}
          selectedIndex={selectedIndex}
        />
      ))}
    </Row>
  );
};

type PaletteItemProps = {
  index: number;
  value: number;
  smallDisplay?: boolean;
  use8Bit?: boolean;
  usePriority?: boolean;
  transparencyIndex?: number;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  onRightClick?: (index: number) => void;
  onPriority?: (index: number) => void;
  selectedIndex?: number;
};

const PaletteItem = ({
  index,
  value,
  smallDisplay,
  use8Bit,
  usePriority,
  transparencyIndex,
  allowSelection,
  onSelection,
  onRightClick,
  onPriority,
  selectedIndex
}: PaletteItemProps) => {
  const ref = useTooltipRef();
  const [r, setR] = useState(null);
  const [g, setG] = useState(null);
  const [b, setB] = useState(null);

  const colorRect = smallDisplay
    ? { x: 4, y: 2, width: 16, height: 12 }
    : { x: 2, y: 2, width: 20, height: 18 };
  const transpCircle = smallDisplay
    ? { cx: 11, cy: 8, r: 4.5 }
    : { cx: 12, cy: 11, r: 5.5 };
  const selectionRect = smallDisplay
    ? { x: 7, y: 4, width: 8, height: 8 }
    : { x: 7, y: 6, width: 10, height: 10 };

  useInitialize(() => {
    const [rC, gC, bC] = getRgbPartsForPaletteCode(value, use8Bit);
    setR(rC);
    setG(gC);
    setB(bC);
  });

  const color = getCssStringForPaletteCode(value, use8Bit);
  const midColor = getLuminanceForPaletteCode(value) < 3.5 ? "white" : "black";
  const hasPriority = usePriority && !!(value & 0x8000);
  return (
    <>
      <div
        ref={ref}
        className={classnames(styles.paletteItem, {
          [styles.small]: smallDisplay
        })}
        style={{
          borderColor: hasPriority ? color : undefined,
          cursor: allowSelection ? "pointer" : undefined
        }}
        onClick={() => {
          if (allowSelection) {
            onSelection?.(index);
          }
        }}
        onContextMenu={() => {
          if (allowSelection) {
            onRightClick?.(index);
          }
        }}
        onDoubleClick={() => {
          if (allowSelection) {
            onPriority?.(index);
          }
        }}
      >
        <svg>
          <rect
            x={colorRect.x}
            y={colorRect.y}
            width={colorRect.width}
            height={colorRect.height}
            fill={color}
          />
          {index === transparencyIndex && (
            <circle
              cx={transpCircle.cx}
              cy={transpCircle.cy}
              r={transpCircle.r}
              fill={midColor}
              fillOpacity={0.5}
            />
          )}
          {allowSelection && index === selectedIndex && (
            <rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              stroke={midColor}
              strokeWidth={2}
              fillOpacity={0.25}
              fill={midColor}
              strokeOpacity={0.75}
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
            hasPriority ? " (priority)" : ""
          }${index === transparencyIndex ? " (transparency)" : ""}`}</div>
        </TooltipFactory>
      </div>
    </>
  );
};
