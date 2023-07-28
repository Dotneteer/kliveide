import { useState } from "react";
import { useTheme } from "@/renderer/theming/ThemeProvider";

const NORMAL_WIDTH = 100;

/**
 * Event arguments when pressing a key on the ZX Spectrum 48 virtual keyboard
 */
export interface Sp48ButtonClickArgs {
  code: number;
  keyCategory: string;
  button: number;
  down: boolean;
}

/**
 * Component properties
 */
type Props = {
  zoom: number;
  code: number;
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
  topNumColor?: string;
  glyph?: number;
  useSymColor?: boolean;
  xwidth?: number;
  keyAction?: (e: Sp48ButtonClickArgs) => void;
};

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export const Sp48Key = ({
  zoom,
  code,
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
  topNumColor,
  glyph,
  useSymColor,
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
  const normalHeight = topNum ? 148 : 128;
  const heightOffset = topNum ? 20 : 0;
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
  const topNumFillColor = mouseOverTopNum
    ? highlightKeyColor
    : topNumColor || mainKeyColor;
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
      style={{ marginRight: "4px" }}
      xmlns='http://www.w3.org/2000/svg'
    >
      <rect
        x='0'
        y={30 + heightOffset}
        rx='8'
        ry='8'
        width='100%'
        height='70'
        fill={keyBackground}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={e => raiseKeyAction(e, "main", true)}
        onMouseUp={e => raiseKeyAction(e, "main", false)}
      />
      {main && (
        <text
          x='12'
          y={70 + heightOffset}
          fontSize='36'
          textAnchor='left'
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {main}
        </text>
      )}
      {keyword && (
        <text
          x='88'
          y={92 + heightOffset}
          fontSize='22'
          textAnchor='end'
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={e => raiseKeyAction(e, "main", true)}
          onMouseUp={e => raiseKeyAction(e, "main", false)}
        >
          {keyword}
        </text>
      )}
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
          fill={
            useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolFillColor
              : mainFillColor
          }
          stroke={
            useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolStrokeColor
              : mainStrokeColor
          }
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
          fill={
            useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolFillColor
              : mainFillColor
          }
          stroke={
            useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolStrokeColor
              : mainStrokeColor
          }
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
      keyCategory,
      button: e.button,
      down
    });
  }
};
