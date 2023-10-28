import { useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardButtonClickArgs } from "./keyboard-common";

const NORMAL_WIDTH = 75;
const NORMAL_HEIGHT = 73;
const BUTTON_BACK = "#1c1c1c";
const BUTTON_RAISE = "#303030";
const TEXT_COLOR = "#c0c0c0";

/**
 * Component properties
 */
type Props = {
  zoom: number;
  code: number;
  secondaryCode?: number;
  main?: string;
  keyword?: string;
  symbol?: string;
  symbolWord?: string;
  above?: string;
  below?: string;
  center?: string;
  numMode?: boolean;
  centerMode?: boolean;
  glyph?: number;
  xwidth?: number;
  keyAction?: (e: KeyboardButtonClickArgs) => void;
};

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export const Sp128Key = ({
  zoom,
  code,
  secondaryCode,
  main,
  keyword,
  symbol,
  symbolWord,
  above,
  below,
  center,
  numMode,
  centerMode,
  glyph,
  xwidth,
  keyAction
}: Props) => {
  // --- State bindings
  const [mouseOverKey, setMouseOverKey] = useState(false);
  const [mouseOverSymbol, setMouseOverSymbol] = useState(false);
  const [mouseOverAbove, setMouseOverAbove] = useState(false);
  const [mouseOverBelow, setMouseOverBelow] = useState(false);
  const [mouseOverTopNum, setMouseOverTopNum] = useState(false);
  const [mouseOverGlyph, setMouseOverGlyph] = useState(false);

  // --- Invariant display properties
  const themeService = useTheme();
  const mainKeyColor = themeService.getThemeProperty("--color-key-main");
  const highlightKeyColor = themeService.getThemeProperty(
    "--color-key-highlight"
  );

  // --- State dependent display properties
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const normalHeight = NORMAL_HEIGHT;
  const currentWidth = appliedZoom * (xwidth || NORMAL_WIDTH);
  const currentHeight = appliedZoom * normalHeight;
  const mainColor = mouseOverKey ? highlightKeyColor : TEXT_COLOR;
  const symbolColor = mouseOverSymbol ? highlightKeyColor : TEXT_COLOR;
  const aboveColor = mouseOverAbove
    ? highlightKeyColor
    : numMode
    ? TEXT_COLOR
    : TEXT_COLOR;
  const aboveStrokeColor = mouseOverAbove ? highlightKeyColor : "transparent";
  const belowColor = mouseOverBelow ? highlightKeyColor : TEXT_COLOR;
  const belowStrokeColor = mouseOverBelow ? highlightKeyColor : "transparent";
  const topNumFillColor = mouseOverTopNum ? highlightKeyColor : mainKeyColor;
  const topNumStrokeColor = mouseOverTopNum ? highlightKeyColor : "transparent";
  const glyphFillColor = mouseOverGlyph ? highlightKeyColor : mainKeyColor;
  const cursor =
    mouseOverKey ||
    mouseOverSymbol ||
    mouseOverAbove ||
    mouseOverBelow ||
    mouseOverTopNum ||
    mouseOverGlyph
      ? "pointer"
      : "default";

  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${xwidth || NORMAL_WIDTH} ${normalHeight}`}
      style={{ marginRight: 4, marginBottom: 4 }}
      xmlns='http://www.w3.org/2000/svg'
    >
      {/* Button rectangle */}
      <rect
        x={0}
        y={0}
        width='100%'
        height='100%'
        fill={BUTTON_BACK}
        cursor={cursor}
      />
      {/* Button left ellipse */}
      <ellipse
        cx={NORMAL_WIDTH / 2}
        cy={NORMAL_WIDTH / 2}
        rx='32'
        ry='32'
        width='100%'
        height='100%'
        fill={BUTTON_RAISE}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={e => raiseKeyAction(e, "main", true)}
        onMouseUp={e => raiseKeyAction(e, "main", false)}
      />
      {xwidth && (
        <>
          {/* Button right ellipse */}
          <ellipse
            cx={NORMAL_WIDTH / 2 + (xwidth - NORMAL_WIDTH)}
            cy={NORMAL_WIDTH / 2}
            rx='32'
            ry='32'
            width='100%'
            height='100%'
            fill={BUTTON_RAISE}
            cursor={cursor}
            onMouseEnter={() => setMouseOverKey(true)}
            onMouseLeave={() => setMouseOverKey(false)}
            onMouseDown={e => raiseKeyAction(e, "main", true)}
            onMouseUp={e => raiseKeyAction(e, "main", false)}
          />
          {/* Button middle rect */}
          <rect
            x={NORMAL_WIDTH / 2}
            y={6}
            width={xwidth - NORMAL_WIDTH}
            height='63.5'
            fill={BUTTON_RAISE}
            cursor={cursor}
            onMouseEnter={() => setMouseOverKey(true)}
            onMouseLeave={() => setMouseOverKey(false)}
            onMouseDown={e => raiseKeyAction(e, "main", true)}
            onMouseUp={e => raiseKeyAction(e, "main", false)}
          />
        </>
      )}
      {/* Top rectangle */}
      <rect
        x='0'
        y={0}
        width='100%'
        height={24}
        fill={BUTTON_BACK}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={e => raiseKeyAction(e, "main", true)}
        onMouseUp={e => raiseKeyAction(e, "main", false)}
      />

      {/* Main text */}
      {main && (
        <text
          x='50%'
          textAnchor='middle'
          y={centerMode ? 48 : 64}
          fontSize={18}
          fill={mainColor}
          stroke={mainColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {main}
        </text>
      )}

      {/* Keyword text */}
      {keyword && (
        <text
          x='50%'
          textAnchor='middle'
          y={35}
          fontSize={10}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {keyword}
        </text>
      )}

      {/* Symbol text */}
      {symbol && (
        <text
          x={62}
          textAnchor='end'
          y={numMode ? 42 : 48}
          fontSize={numMode ? 16 : 12}
          fill={symbolColor}
          stroke={symbolColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={e => raiseKeyAction(e, "symbol", true)}
          onMouseUp={e => raiseKeyAction(e, "symbol", false)}
      >
          {symbol}
        </text>
      )}

      {/* Symbol word */}
      {symbolWord && (
        <text
          x='50%'
          textAnchor='middle'
          y={46}
          fontSize={10}
          fill={symbolColor}
          stroke={symbolColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={e => raiseKeyAction(e, "symbol", true)}
          onMouseUp={e => raiseKeyAction(e, "symbol", false)}
        >
          {symbolWord}
        </text>
      )}

      {/* Center text */}
      {center && (
        <text
          x='50%'
          textAnchor='middle'
          y={50}
          fontSize={10}
          fill={mainColor}
          stroke={mainColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {center}
        </text>
      )}

      {/* Above text */}
      {above && (
        <text
          x='50%'
          textAnchor='middle'
          y={10}
          fontSize={10}
          fill={aboveColor}
          stroke={aboveStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverAbove(true)}
          onMouseLeave={() => setMouseOverAbove(false)}
          onMouseDown={e =>
            raiseKeyAction(e, "above", true)
          }
          onMouseUp={e => raiseKeyAction(e, "above", false)}
        >
          {above}
        </text>
      )}

      {/* Above text */}
      {below && (
        <text
          x='50%'
          textAnchor='middle'
          y={20}
          fontSize={10}
          fill={belowColor}
          stroke={belowStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverBelow(true)}
          onMouseLeave={() => setMouseOverBelow(false)}
          onMouseDown={e => raiseKeyAction(e, "below", true)}
          onMouseUp={e => raiseKeyAction(e, "below", false)}
        >
          {below}
        </text>
      )}

      {glyph && (
        <rect
          x='18'
          y='30'
          width='16'
          height='16'
          strokeWidth='1'
          stroke={TEXT_COLOR}
          fill="transparent"
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x01 && (
        <rect
          x='26.5'
          y='30.5'
          width='7'
          height='7'
          stroke={TEXT_COLOR}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x02 && (
        <rect
          x='18.5'
          y='30.5'
          width='7'
          height='7'
          stroke={TEXT_COLOR}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x04 && (
        <rect
          x='26.5'
          y='38.5'
          width='7'
          height='7'
          stroke={TEXT_COLOR}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
    </svg>
  );

  function raiseKeyAction (
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ): void {
    keyAction?.({
      code,
      secondaryButton: secondaryCode,
      keyCategory,
      button: e.button,
      down
    });
  }
};
