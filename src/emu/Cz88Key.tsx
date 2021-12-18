import * as React from "react";
import { useState } from "react";

import { getThemeService } from "@core/service-registry";
import { Cz88KeyView } from "@modules/vm-z88/cz88-keys";
import { Z88ButtonClickArgs } from "./ui-core-types";

const NORMAL_WIDTH = 100;
const NORMAL_HEIGHT = 100;

/**
 * Component properties
 */
type Props = {
  zoom: number;
  code: number;
  layoutInfo?: Cz88KeyView;
  top?: string;
  bottom?: string;
  xwidth?: number;
  xheight?: number;
  vshift?: number;
  fontSize?: number;
  isEnter?: boolean;
  keyAction?: (e: Z88ButtonClickArgs, down: boolean) => void;
}

/**
 * Represents a key of the Cambridge Z88 keyboard
 */
export const Cz88Key: React.VFC<Props> = ({
  zoom,
  code,
  layoutInfo,
  top,
  bottom,
  xwidth,
  xheight,
  vshift,
  fontSize,
  isEnter,
  keyAction,
})  => {
  // --- Component states
  const [mouseOverKey, setMouseOverKey] = useState(false);
  const [mouseOverSymbol, setMouseOverSymbol] = useState(false);
  const [mouseOverSecondSymbol, setMouseOverSecondSymbol] = useState(false);

  // --- Number of icons on the key
  let currentIconCount = 0;

  // --- Invariant display properties
  const themeService = getThemeService();
  const keyBackground = themeService.getProperty("--key-cz88-background-color");
  const mainKeyColor = themeService.getProperty("--key-cz88-main-color");
  const keyStrokeColor = themeService.getProperty("--key-cz88-stroke-color");
  const symbolKeyColor = themeService.getProperty("--key-cz88-main-color");
  const highlightKeyColor = themeService.getProperty(
    "--key-cz88-highlight-color"
  );

  // --- Prepare rendering
  let main = "";
  let keyword = "";
  let symbol = "";
  let secondSymbol;
  if (layoutInfo) {
    keyword = layoutInfo.keyword;
    main = layoutInfo.key;
    symbol = layoutInfo.symbol;
    secondSymbol = layoutInfo.secondSymbol;
  }
  currentIconCount = 0;
  if (main) currentIconCount++;
  if (symbol) currentIconCount++;
  if (secondSymbol) currentIconCount++;

  const currentWidth = zoom * (xwidth || NORMAL_WIDTH);
  const currentHeight = zoom * (xheight || NORMAL_HEIGHT);
  const mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  const mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  const symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  const symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  const secondSymbolFillColor = mouseOverSecondSymbol
    ? highlightKeyColor
    : symbolKeyColor;
  const secondSymbolStrokeColor = mouseOverSecondSymbol
    ? highlightKeyColor
    : "transparent";
  const cursor = mouseOverKey || mouseOverSymbol ? "pointer" : "default";

  // --- Render
  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${(xwidth || NORMAL_WIDTH) + 20} ${
        (xheight || NORMAL_HEIGHT) + 20
      }`}
      style={{ margin: 0 }}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="2"
        rx="12"
        ry="12"
        width={xwidth || NORMAL_WIDTH}
        height={xheight || NORMAL_HEIGHT}
        fill={keyBackground}
        stroke={keyStrokeColor}
        strokeWidth="4"
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={(e) => raiseKeyAction(e, "main", true)}
        onMouseUp={(e) => raiseKeyAction(e, "main", false)}
      />
      {main && (
        <text
          x="14"
          y="88"
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
          {main}
        </text>
      )}
      {symbol && (
        <rect
          x="48"
          y="16"
          width={54}
          height={40}
          fill="transparent"
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={(e) => raiseKeyAction(e, "symbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "symbol", false)}
        >
          {symbol}
        </rect>
      )}
      {symbol && (
        <text
          x="68"
          y="36"
          fontSize={32}
          textAnchor="middle"
          fill={symbolFillColor}
          stroke={symbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSymbol(true)}
          onMouseLeave={() => setMouseOverSymbol(false)}
          onMouseDown={(e) => raiseKeyAction(e, "symbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "symbol", false)}
        >
          {symbol}
        </text>
      )}
      {secondSymbol && (
        <rect
          x="48"
          y="68"
          width={54}
          height={40}
          fill="transparent"
          cursor={cursor}
          onMouseEnter={() => setMouseOverSecondSymbol(true)}
          onMouseLeave={() => setMouseOverSecondSymbol(true)}
          onMouseDown={(e) => raiseKeyAction(e, "secondsymbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "secondsymbol", false)}
        ></rect>
      )}
      {secondSymbol && (
        <text
          x="68"
          y="88"
          fontSize={32}
          textAnchor="middle"
          fill={secondSymbolFillColor}
          stroke={secondSymbolStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverSecondSymbol(true)}
          onMouseLeave={() => setMouseOverSecondSymbol(true)}
          onMouseDown={(e) => raiseKeyAction(e, "secondsymbol", true)}
          onMouseUp={(e) => raiseKeyAction(e, "secondsymbol", false)}
        >
          {secondSymbol}
        </text>
      )}
      {keyword && (
        <text
          x={(xwidth || 100) / 2}
          y={62 + (vshift || 0)}
          fontSize={fontSize ?? 28}
          textAnchor="middle"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          {keyword}
        </text>
      )}
      {top && (
        <text
          x={(xwidth || 100) / 2}
          y={48}
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
          {top}
        </text>
      )}
      {bottom && (
        <text
          x={(xwidth || 100) / 2}
          y={76}
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
          {bottom}
        </text>
      )}
      {isEnter && (
        <text
          x={(xwidth || 100) / 2 - 6}
          y={54}
          fontSize="28"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          E
        </text>
      )}
      {isEnter && (
        <text
          x={(xwidth || 100) / 2 - 6}
          y={84}
          fontSize="28"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          N
        </text>
      )}
      {isEnter && (
        <text
          x={(xwidth || 100) / 2 - 6}
          y={114}
          fontSize="28"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          T
        </text>
      )}
      {isEnter && (
        <text
          x={(xwidth || 100) / 2 - 6}
          y={144}
          fontSize="28"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          E
        </text>
      )}
      {isEnter && (
        <text
          x={(xwidth || 100) / 2 - 6}
          y={174}
          fontSize="28"
          textAnchor="left"
          fill={mainFillColor}
          stroke={mainStrokeColor}
          cursor={cursor}
          onMouseEnter={() => setMouseOverKey(true)}
          onMouseLeave={() => setMouseOverKey(false)}
          onMouseDown={(e) => raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => raiseKeyAction(e, "main", false)}
        >
          R
        </text>
      )}
    </svg>
  );

  function raiseKeyAction(
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ) {
    keyAction?.(
      {
        code: code,
        keyCategory,
        down,
        isLeft: e.button === 0,
        iconCount: currentIconCount,
        special: layoutInfo ? layoutInfo.special : undefined,
      },
      down
    );
  }
}
