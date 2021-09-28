import * as React from "react";
import { useState } from "react";
import { getThemeService } from "../../shared/services/store-helpers";
import { Sp48ButtonClickArgs } from "./ui-core-types";

const NORMAL_WIDTH = 100;

/**
 * Component properties
 */
interface Props {
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
}

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export default function Sp48Key(props: Props) {
  // --- State bindings
  const [mouseOverKey, setMouseOverKey] = useState(false);
  const [mouseOverSymbol, setMouseOverSymbol] = useState(false);
  const [mouseOverAbove, setMouseOverAbove] = useState(false);
  const [mouseOverBelow, setMouseOverBelow] = useState(false);
  const [mouseOverTopNum, setMouseOverTopNum] = useState(false);
  const [mouseOverGlyph, setMouseOverGlyph] = useState(false);

  // --- Invariant display properties
  const themeService = getThemeService();
  const keyBackground = themeService.getProperty("--key-background-color");
  const mainKeyColor = themeService.getProperty("--key-main-color");
  const symbolKeyColor = themeService.getProperty("--key-symbol-color");
  const aboveKeyColor = themeService.getProperty("--key-above-color");
  const belowKeyColor = themeService.getProperty("--key-below-color");
  const highlightKeyColor = themeService.getProperty("--key-highlight-color");

  // --- State dependent display properties
  const zoom = props.zoom <= 0 ? 0.05 : props.zoom;
  const normalHeight = props.topNum ? 148 : 128;
  const heightOffset = props.topNum ? 20 : 0;
  const currentWidth = zoom * (props.xwidth || NORMAL_WIDTH);
  const currentHeight = zoom * normalHeight;
  const mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  const mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  const symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  const symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  const aboveFillColor = mouseOverAbove
    ? highlightKeyColor
    : props.topNum
    ? mainKeyColor
    : aboveKeyColor;
  const aboveStrokeColor = mouseOverAbove ? highlightKeyColor : "transparent";
  const belowFillColor = mouseOverBelow ? highlightKeyColor : belowKeyColor;
  const belowStrokeColor = mouseOverBelow ? highlightKeyColor : "transparent";
  const topNumFillColor = mouseOverTopNum
    ? highlightKeyColor
    : props.topNumColor || mainKeyColor;
  const topNumStrokeColor = mouseOverTopNum ? highlightKeyColor : "transparent";
  const glyphFillColor = mouseOverGlyph ? highlightKeyColor : mainKeyColor;
  const cursor =
    mouseOverKey ||
    mouseOverSymbol ||
    mouseOverAbove ||
    mouseOverBelow ||
    mouseOverTopNum
      ? "pointer"
      : "default";

  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${props.xwidth || NORMAL_WIDTH} ${normalHeight}`}
      style={{ marginRight: "4px" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0"
        y={30 + heightOffset}
        rx="8"
        ry="8"
        width="100%"
        height="70"
        fill={keyBackground}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={(e) => raiseKeyAction(e, "main", true)}
        onMouseUp={(e) => raiseKeyAction(e, "main", false)}
      />
      {props.main && (
        <text
          x="12"
          y={70 + heightOffset}
          fontSize="36"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {props.main}
        </text>
      )}
      {props.keyword && (
        <text
          x="88"
          y={92 + heightOffset}
          fontSize="22"
          textAnchor="end"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {props.keyword}
        </text>
      )}
      {props.symbol ||
        (props.symbolWord && (
          <rect
            x={props.topNum ? 36 : 44}
            y={(props.topNum ? 70 : 34) + heightOffset}
            width={props.topNum ? 58 : 54}
            height={props.topNum ? 28 : 40}
            fill="transparent"
            cursor={cursor}
            onMouseEnter={() => setMouseOverSymbol(true)}
            onMouseLeave={() => setMouseOverSymbol(false)}
            onMouseDown={(e) => raiseKeyAction(e, "symbol", true)}
            onMouseUp={(e) => raiseKeyAction(e, "symbol", false)}
          >
            {props.symbol}
          </rect>
        ))}
      {props.symbol && (
        <text
          x="64"
          y={(props.topNum ? 90 : 64) + heightOffset}
          fontSize={props.topNum ? 24 : 28}
          textAnchor="middle"
          fill={symbolFillColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={(e) => raiseKeyAction(e, "symbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "symbol", false)}
        >
          {props.symbol}
        </text>
      )}
      {props.symbolWord && (
        <text
          x="92"
          y={58 + heightOffset}
          fontSize="18"
          textAnchor="end"
          fill={symbolFillColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={(e) => raiseKeyAction(e, "symbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "symbol", false)}
        >
          {props.symbolWord}
        </text>
      )}
      {props.above && (
        <text
          x="0"
          y={20 + heightOffset}
          fontSize="20"
          textAnchor="start"
          fill={aboveFillColor}
          stroke={aboveStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverAbove(true)}
          onMouseLeave={() => setMouseOverAbove(false)}
          onMouseDown={(e) =>
            raiseKeyAction(e, props.topNum ? "topNum" : "above", true)
          }
          onMouseUp={(e) =>
            raiseKeyAction(e, props.topNum ? "topNum" : "above", false)
          }
        >
          {props.above}
        </text>
      )}
      {props.below && (
        <text
          x="0"
          y={124 + heightOffset}
          fontSize="20"
          textAnchor="start"
          fill={belowFillColor}
          stroke={belowStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverBelow(true)}
          onMouseLeave={() => setMouseOverBelow(false)}
          onMouseDown={(e) => raiseKeyAction(e, "below", true)}
          onMouseUp={(e) => raiseKeyAction(e, "below", false)}
        >
          {props.below}
        </text>
      )}
      {props.center && (
        <text
          x={(props.xwidth || 100) / 2}
          y={(props.top ? 86 : 74) + heightOffset}
          fontSize="28"
          textAnchor="middle"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {props.center}
        </text>
      )}
      {props.top && (
        <text
          x={(props.xwidth || 100) / 2}
          y={62 + heightOffset}
          fontSize="20"
          textAnchor="middle"
          fill={
            props.useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolFillColor
              : mainFillColor
          }
          stroke={
            props.useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolStrokeColor
              : mainStrokeColor
          }
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {props.top}
        </text>
      )}
      {props.bottom && (
        <text
          x={(props.xwidth || 100) / 2}
          y={84 + heightOffset}
          fontSize="20"
          textAnchor="middle"
          fill={
            props.useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolFillColor
              : mainFillColor
          }
          stroke={
            props.useSymColor
              ? mouseOverKey
                ? highlightKeyColor
                : symbolStrokeColor
              : mainStrokeColor
          }
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {props.bottom}
        </text>
      )}
      {props.topNum && (
        <text
          x="0"
          y="18"
          fontSize="20"
          textAnchor="start"
          fill={topNumFillColor}
          stroke={topNumStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverTopNum(true)}
          onMouseLeave={() => setMouseOverTopNum(false)}
          onMouseDown={(e) => raiseKeyAction(e, "above", true)}
          onMouseUp={(e) => raiseKeyAction(e, "above", false)}
        >
          {props.topNum}
        </text>
      )}
      {props.glyph && (
        <rect
          x="50"
          y="62"
          width="24"
          height="24"
          strokeWidth="3"
          stroke={glyphFillColor}
          fill={glyphFillColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={(e) => raiseKeyAction(e, "glyph", true)}
          onMouseUp={(e) => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {props.glyph && props.glyph & 0x01 && (
        <rect
          x="61"
          y="62"
          width="12"
          height="12"
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={(e) => raiseKeyAction(e, "glyph", true)}
          onMouseUp={(e) => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {props.glyph && props.glyph & 0x02 && (
        <rect
          x="50"
          y="62"
          width="12"
          height="12"
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={(e) => raiseKeyAction(e, "glyph", true)}
          onMouseUp={(e) => raiseKeyAction(e, "glyph", false)}
        />
      )}
      {props.glyph && props.glyph & 0x04 && (
        <rect
          x="61"
          y="73"
          width="12"
          height="12"
          fill={keyBackground}
          cursor={cursor}
          onMouseEnter={() => setMouseOverGlyph(true)}
          onMouseLeave={() => setMouseOverGlyph(false)}
          onMouseDown={(e) => raiseKeyAction(e, "glyph", true)}
          onMouseUp={(e) => raiseKeyAction(e, "glyph", false)}
        />
      )}
    </svg>
  );

  function raiseKeyAction(
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ): void {
    props.keyAction?.({
      code: props.code,
      keyCategory,
      button: e.button,
      down,
    });
  }
}
