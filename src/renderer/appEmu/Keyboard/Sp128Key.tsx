import { useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardButtonClickArgs } from "./keyboard-common";

const NORMAL_WIDTH = 75;
const NORMAL_HEIGHT = 73;
const BUTTON_BACK = "#1c1c1c";
const BUTTON_RAISE = "#303030";
const TEXT_COLOR = "#c0c0c0"

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
  top?: string;
  bottom?: string;
  topNum?: string;
  glyph?: number;
  xwidth?: number;
  keyAction?: (e: KeyboardButtonClickArgs) => void;
};

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export const Sp128Key = ({
  zoom,
  code, //
  main,
  keyword,
  symbol,
  symbolWord,
  above,
  below,
  center,
  top,
  bottom,
  topNum,
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
  const keyBackground = themeService.getThemeProperty("--bgcolor-key");
  const mainKeyColor = themeService.getThemeProperty("--color-key-main");
  const symbolKeyColor = themeService.getThemeProperty("--color-key-symbol");
  const aboveKeyColor = themeService.getThemeProperty("--color-key-above");
  const belowKeyColor = themeService.getThemeProperty("--color-key-below");
  const highlightKeyColor = themeService.getThemeProperty(
    "--color-key-highlight"
  );

  // --- State dependent display properties
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const normalHeight = NORMAL_HEIGHT;
  const heightOffset = topNum ? 0 : 0;
  const currentWidth = appliedZoom * (xwidth || NORMAL_WIDTH);
  const currentHeight = appliedZoom * normalHeight;
  const mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  const mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  const symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  const symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  const aboveFillColor = mouseOverAbove
    ? highlightKeyColor
    : topNum
    ? mainKeyColor
    : aboveKeyColor;
  const aboveStrokeColor = mouseOverAbove ? highlightKeyColor : "transparent";
  const belowFillColor = mouseOverBelow ? highlightKeyColor : belowKeyColor;
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
        x='0'
        y={heightOffset}
        width='100%'
        height='100%'
        fill={BUTTON_BACK}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={e => raiseKeyAction(e, "main", true)}
        onMouseUp={e => raiseKeyAction(e, "main", false)}
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
            y={heightOffset + 6}
            width={xwidth - NORMAL_WIDTH}
            height='64'
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
        y={heightOffset}
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
          x="50%"
          textAnchor="middle"
          y={62 + heightOffset}
          fontSize={18}
          fill={TEXT_COLOR}
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
          x="50%"
          textAnchor="middle"
          y={35 + heightOffset}
          fontSize={11}
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
          textAnchor="end"
          y={46 + heightOffset}
          fontSize={11}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {symbol}
        </text>
      )}

      {/* Center text */}
      {center && (
        <text
          x="50%"
          textAnchor="middle"
          y={54 + heightOffset}
          fontSize={11}
          fill={TEXT_COLOR}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {center}
        </text>
      )}


      { /*}
      {symbol ||
        (symbolWord && (
          <rect
            x={topNum ? 36 : 44}
            y={(topNum ? 70 : 34) + heightOffset}
            width={topNum ? 58 : 54}
            height={topNum ? 28 : 40}
            fill='transparent'
            cursor={cursor}
            onMouseEnter={() => setMouseOverSymbol(true)}
            onMouseLeave={() => setMouseOverSymbol(false)}
            onMouseDown={e => raiseKeyAction(e, "symbol", true)}
            onMouseUp={e => raiseKeyAction(e, "symbol", false)}
          >
            {symbol}
          </rect>
        ))}
      {symbol && (
        <text
          x='64'
          y={(topNum ? 90 : 64) + heightOffset}
          fontSize={topNum ? 24 : 28}
          textAnchor='middle'
          fill={symbolFillColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={e => raiseKeyAction(e, "symbol", true)}
          onMouseUp={e => raiseKeyAction(e, "symbol", false)}
        >
          {symbol}
        </text>
      )}
      {symbolWord && (
        <text
          x='92'
          y={58 + heightOffset}
          fontSize='18'
          textAnchor='end'
          fill={symbolFillColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={e => raiseKeyAction(e, "symbol", true)}
          onMouseUp={e => raiseKeyAction(e, "symbol", false)}
        >
          {symbolWord}
        </text>
      )}
      {above && (
        <text
          x='0'
          y={20 + heightOffset}
          fontSize='20'
          textAnchor='start'
          fill={aboveFillColor}
          stroke={aboveStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverAbove(true)}
          onMouseLeave={() => setMouseOverAbove(false)}
          onMouseDown={e =>
            raiseKeyAction(e, topNum ? "topNum" : "above", true)
          }
          onMouseUp={e => raiseKeyAction(e, topNum ? "topNum" : "above", false)}
        >
          {above}
        </text>
      )}
      {below && (
        <text
          x='0'
          y={124 + heightOffset}
          fontSize='20'
          textAnchor='start'
          fill={belowFillColor}
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
      {center && (
        <text
          x={(xwidth || 100) / 2}
          y={(top ? 86 : 74) + heightOffset}
          fontSize='28'
          textAnchor='middle'
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {center}
        </text>
      )}
      {top && (
        <text
          x={(xwidth || 100) / 2}
          y={62 + heightOffset}
          fontSize='20'
          textAnchor='middle'
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {top}
        </text>
      )}
      {bottom && (
        <text
          x={(xwidth || 100) / 2}
          y={84 + heightOffset}
          fontSize='20'
          textAnchor='middle'
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {bottom}
        </text>
      )}
      {topNum && (
        <text
          x='0'
          y='18'
          fontSize='20'
          textAnchor='start'
          fill={topNumFillColor}
          stroke={topNumStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverTopNum(true)}
          onMouseLeave={() => setMouseOverTopNum(false)}
          onMouseDown={e => raiseKeyAction(e, "above", true)}
          onMouseUp={e => raiseKeyAction(e, "above", false)}
        >
          {topNum}
        </text>
      )}
      {glyph && (
        <rect
          x='50'
          y='62'
          width='24'
          height='24'
          strokeWidth='3'
          stroke={glyphFillColor}
          fill={glyphFillColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x01 && (
        <rect
          x='61'
          y='62'
          width='12'
          height='12'
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x02 && (
        <rect
          x='50'
          y='62'
          width='12'
          height='12'
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {glyph && glyph & 0x04 && (
        <rect
          x='61'
          y='73'
          width='12'
          height='12'
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={e => raiseKeyAction(e, "glyph", true)}
          onMouseUp={e => raiseKeyAction(e, "glyph", false)}
        />
      )} */}
    </svg>
  );

  function raiseKeyAction (
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ): void {
    keyAction?.({
      code,
      keyCategory,
      button: e.button,
      down
    });
  }
};
