import { useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardButtonClickArgs } from "./keyboard-common";

const NORMAL_WIDTH = 75;
const NORMAL_HEIGHT = 73;

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
  cleanMode?: boolean;
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
  cleanMode,
  glyph,
  xwidth,
  keyAction
}: Props) => {
  // --- State bindings
  const [mouseOverKey, setMouseOverKey] = useState(false);
  const [mouseOverSymbol, setMouseOverSymbol] = useState(false);
  const [mouseOverAbove, setMouseOverAbove] = useState(false);
  const [mouseOverBelow, setMouseOverBelow] = useState(false);
  const [mouseOverGlyph, setMouseOverGlyph] = useState(false);

  // --- Invariant display properties
  const themeService = useTheme();
  const highlightKeyColor = themeService.getThemeProperty(
    "--color-key128-highlight"
  );
  const buttonBackColor = themeService.getThemeProperty(
    "--bgcolor-key128"
  );
  const buttonRaiseColor = themeService.getThemeProperty(
    "--bgcolor-key128-raise"
  );
  const buttonTextColor = themeService.getThemeProperty(
    "--color-key128-main"
  );

  // --- State dependent display properties
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const normalHeight = NORMAL_HEIGHT;
  const currentWidth = appliedZoom * (xwidth || NORMAL_WIDTH);
  const currentHeight = appliedZoom * normalHeight;
  const mainColor = mouseOverKey ? highlightKeyColor : buttonTextColor;
  const mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  const symbolColor = mouseOverSymbol ? highlightKeyColor : (cleanMode ? mainColor : buttonTextColor);
  const symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : (cleanMode ? mainStrokeColor : "transparent");
  const keywordColor = mouseOverKey ? highlightKeyColor : (cleanMode && mouseOverSymbol ? highlightKeyColor : buttonTextColor);
  const keywordStrokeColor = mouseOverKey ? highlightKeyColor : (cleanMode && mouseOverSymbol ? highlightKeyColor : "transparent");
  const aboveColor = mouseOverAbove
    ? highlightKeyColor
    : numMode
    ? buttonTextColor
    : buttonTextColor;
  const aboveStrokeColor = mouseOverAbove ? highlightKeyColor : "transparent";
  const belowColor = mouseOverBelow ? highlightKeyColor : buttonTextColor;
  const belowStrokeColor = mouseOverBelow ? highlightKeyColor : "transparent";
  const glyphColor = mouseOverGlyph ? highlightKeyColor : buttonTextColor;
  const cursor =
    mouseOverKey ||
    mouseOverSymbol ||
    mouseOverAbove ||
    mouseOverBelow ||
    mouseOverGlyph
      ? "pointer"
      : "default";

  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${xwidth || NORMAL_WIDTH} ${normalHeight}`}
      style={{ marginRight: 2*zoom, marginBottom: 2*zoom }}
      xmlns='http://www.w3.org/2000/svg'
    >
      {/* Button rectangle */}
      <rect
        x={0}
        y={0}
        width='100%'
        height='100%'
        fill={buttonBackColor}
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
        fill={buttonRaiseColor}
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
            fill={buttonRaiseColor}
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
            fill={buttonRaiseColor}
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
        fill={buttonBackColor}
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

      {/* Keyword text */}
      {keyword && (
        <text
          x='50%'
          textAnchor='middle'
          y={35}
          fontSize={10}
          fill={keywordColor}
          stroke={keywordStrokeColor}
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

      {/* Symbol word */}
      {symbolWord && (
        <text
          x='50%'
          textAnchor='middle'
          y={46}
          fontSize={10}
          fill={symbolColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={e => raiseKeyAction(e, cleanMode ? "main" : "symbol", true)}
          onMouseUp={e => raiseKeyAction(e, cleanMode ? "main" : "symbol", false)}
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
          stroke={glyphColor}
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
          stroke={glyphColor}
          fill={glyphColor}
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
          stroke={glyphColor}
          fill={glyphColor}
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
          stroke={glyphColor}
          fill={glyphColor}
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
