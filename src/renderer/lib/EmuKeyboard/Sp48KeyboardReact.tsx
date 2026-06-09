import { memo, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  SP48_KEY_EVENT,
  dispatchSp48KeyStatus,
  type Sp48KeyEventDetail
} from "../../../emu/sp48/sp48-keyboard";

type KeyCategory = "main" | "symbol" | "above" | "below" | "topNum";
type ArrowIcon = "left" | "right" | "up" | "down";

type KeyboardButtonClickArgs = {
  code: number;
  keyCategory: KeyCategory;
  button: number;
  down: boolean;
};

type Sp48KeyDef = {
  code: number;
  main?: string;
  keyword?: string;
  symbol?: string;
  symbolWord?: string;
  above?: string;
  aboveIcon?: ArrowIcon;
  below?: string;
  center?: string;
  top?: string;
  bottom?: string;
  topNum?: string;
  topNumColor?: string;
  useSymColor?: boolean;
  width?: number;
};

type Props = {
  width: number;
  height: number;
};

const DEFAULT_WIDTH = 10 * 104 + 130;
const DEFAULT_HEIGHT = 4 * (128 + 16);

const keyRows: Sp48KeyDef[][] = [
  [
    { code: 15, topNum: "BLUE", topNumColor: "#0030ff", main: "1", symbol: "  !  ", above: "EDIT", below: "DEF FN" },
    { code: 16, topNum: "RED", topNumColor: "#ff0000", main: "2", symbol: " @ ", above: "CAPS LCK", below: "FN" },
    { code: 17, topNum: "MAGENTA", topNumColor: "#e000e0", main: "3", symbol: " # ", above: "TRUE VID", below: "LINE" },
    { code: 18, topNum: "GREEN", topNumColor: "#00c000", main: "4", symbol: " $ ", above: "INV.VIDEO", below: "OPEN" },
    { code: 19, topNum: "CYAN", topNumColor: "#00c0c0", main: "5", symbol: " % ", aboveIcon: "left", below: "CLOSE" },
    { code: 24, topNum: "YELLOW", topNumColor: "#fff000", main: "6", symbol: " & ", aboveIcon: "down", below: "MOVE" },
    { code: 23, topNum: "WHITE", topNumColor: "#ffffff", main: "7", symbol: "  '  ", aboveIcon: "up", below: "ERASE" },
    { code: 22, topNum: "UNBRIGHT", topNumColor: "#a0a0a0", main: "8", symbol: "  (  ", aboveIcon: "right", below: "POINT" },
    { code: 21, topNum: "BRIGHT", main: "9", symbol: "  )  ", above: "GRAPHICS", below: "CAT" },
    { code: 20, topNum: "BLACK", topNumColor: "#505050", main: "0", symbol: "_", above: "DELETE", below: "FORMAT" }
  ],
  [
    { code: 10, main: "Q", keyword: "PLOT", symbol: "<=", above: "SIN", below: "ASN" },
    { code: 11, main: "W", keyword: "DRAW", symbol: "<>", above: "COS", below: "ACS" },
    { code: 12, main: "E", keyword: "REM", symbol: ">=", above: "TAN", below: "ATN" },
    { code: 13, main: "R", keyword: "RUN", symbol: " < ", above: "INT", below: "VERIFY" },
    { code: 14, main: "T", keyword: "RAND", symbol: " > ", above: "RND", below: "MERGE" },
    { code: 29, main: "Y", keyword: "RETURN", symbolWord: "AND", above: "STR$", below: "[" },
    { code: 28, main: "U", keyword: "IF", symbolWord: "OR", above: "CHR$", below: "]" },
    { code: 27, main: "I", keyword: "INPUT", symbolWord: "AT", above: "CODE", below: "IN" },
    { code: 26, main: "O", keyword: "POKE", symbol: "  ;  ", above: "PEEK", below: "OUT" },
    { code: 25, main: "P", keyword: "PRINT", symbol: "  \"  ", above: "TAB", below: "(C)" }
  ],
  [
    { code: 5, main: "A", keyword: "NEW", symbolWord: "STOP", above: "READ", below: "  ~  " },
    { code: 6, main: "S", keyword: "SAVE", symbolWord: "NOT", above: "RESTORE", below: "  |  " },
    { code: 7, main: "D", keyword: "DIM", symbolWord: "STEP", above: "DATA", below: "  \\  " },
    { code: 8, main: "F", keyword: "FOR", symbolWord: "TO", above: "SGN", below: "  {  " },
    { code: 9, main: "G", keyword: "GOTO", symbolWord: "THEN", above: "ABS", below: "  }  " },
    { code: 34, main: "H", keyword: "GOSUB", symbol: " ^ ", above: "SQR", below: "CIRCLE" },
    { code: 33, main: "J", keyword: "LOAD", symbol: " - ", above: "VAL", below: "VAL$" },
    { code: 32, main: "K", keyword: "LIST", symbol: " + ", above: "LEN", below: "SCREEN$" },
    { code: 31, main: "L", keyword: "LET", symbol: " = ", above: "USR", below: "ATTR" },
    { code: 30, center: "ENTER" }
  ],
  [
    { code: 0, width: 130, top: "CAPS", bottom: "SHIFT" },
    { code: 1, main: "Z", keyword: "COPY", symbol: "  :  ", above: "LN", below: "BEEP" },
    { code: 2, main: "X", keyword: "CLEAR", symbol: " £ ", above: "EXP", below: "INK" },
    { code: 3, main: "C", keyword: "CONT", symbol: " ? ", above: "LPRINT", below: "PAPER" },
    { code: 4, main: "V", keyword: "CLS", symbol: " / ", above: "LLIST", below: "FLASH" },
    { code: 39, main: "B", keyword: "BORDER", symbol: " * ", above: "BIN", below: "BRIGHT" },
    { code: 38, main: "N", keyword: "NEXT", symbol: "  ,  ", above: "INKEY$", below: "OVER" },
    { code: 37, main: "M", keyword: "PAUSE", symbol: "  .  ", above: "INVERSE", below: "PI" },
    { code: 36, top: "SYMBOL", bottom: "SHIFT", useSymColor: true },
    { code: 35, width: 180, top: "BREAK", center: "SPACE" }
  ]
];

export function Sp48KeyboardReact({ width, height }: Props) {
  const zoom = calculateZoom(width, height);
  const [pressedKeys, setPressedKeys] = useState(() => new Set<number>());
  const rowShifts = [0, 80 * zoom, 110 * zoom, 0];

  useEffect(() => {
    const handleKeyStatus = (event: Event) => {
      const detail = (event as CustomEvent<Sp48KeyEventDetail>).detail;
      if (!detail) {
        return;
      }
      updatePressedKeys(detail.key, detail.down);
    };

    window.addEventListener(SP48_KEY_EVENT, handleKeyStatus);
    return () => {
      window.removeEventListener(SP48_KEY_EVENT, handleKeyStatus);
    };
  }, []);

  const handleKeyAction = ({ code, down }: KeyboardButtonClickArgs) => {
    updatePressedKeys(code, down);
    dispatchSp48KeyStatus(code, down, "virtual");
  };

  const updatePressedKeys = (code: number, down: boolean) => {
    setPressedKeys((current) => {
      const next = new Set(current);
      if (down) {
        next.add(code);
      } else {
        next.delete(code);
      }
      return next;
    });
  };

  return (
    <div style={rootStyle}>
      {keyRows.map((row, index) => (
        <div key={index} style={{ ...rowStyle, marginLeft: rowShifts[index] }}>
          {row.map((key) => (
            <Sp48Key
              key={key.code}
              zoom={zoom}
              pressed={pressedKeys.has(key.code)}
              keyAction={handleKeyAction}
              {...key}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function calculateZoom(width: number, height: number): number {
  const widthZoom = width / DEFAULT_WIDTH;
  const heightZoom = height / DEFAULT_HEIGHT;
  const zoom = Math.min(widthZoom, heightZoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 0.05;
}

const rootStyle = {
  display: "flex",
  flexDirection: "column",
  height: "auto",
  overflow: "visible",
  width: "auto"
} as const;

const rowStyle = {
  display: "flex",
  flex: "0 0 auto",
  height: "auto",
  overflow: "visible",
  width: "auto"
} as const;

type Sp48KeyProps = Sp48KeyDef & {
  zoom: number;
  pressed?: boolean;
  keyAction?: (e: KeyboardButtonClickArgs) => void;
};

const Sp48Key = memo(function Sp48Key({
  zoom,
  code,
  main,
  keyword,
  symbol,
  symbolWord,
  above,
  aboveIcon,
  below,
  center,
  top,
  bottom,
  topNum,
  topNumColor,
  useSymColor,
  width,
  pressed,
  keyAction
}: Sp48KeyProps) {
  const [hot, setHot] = useState<KeyCategory | undefined>();
  const normalWidth = width ?? 100;
  const normalHeight = topNum ? 148 : 128;
  const heightOffset = topNum ? 20 : 0;
  const currentWidth = zoom * normalWidth;
  const currentHeight = zoom * normalHeight;
  const colors = useMemo(getKeyboardThemeVars, []);
  const fonts = useMemo(getKeyboardFontThemeVars, []);
  const isHot = (category: KeyCategory) => hot === category;
  const cursor = hot ? "pointer" : "default";
  const mainColor = isHot("main") ? colors.highlight : colors.main;
  const symbolColor = isHot("symbol") ? colors.highlight : colors.symbol;
  const aboveColor = isHot("above") || isHot("topNum") ? colors.highlight : topNum ? colors.main : colors.above;
  const belowColor = isHot("below") ? colors.highlight : colors.below;
  const shiftColor = useSymColor ? symbolColor : mainColor;

  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${normalWidth} ${normalHeight}`}
      style={{ marginRight: "4px", flex: "0 0 auto" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0"
        y={30 + heightOffset}
        rx="8"
        ry="8"
        width="100%"
        height="70"
        fill={pressed ? colors.highlightBackground : colors.keyBackground}
        cursor={cursor}
        {...mouseHandlers("main")}
      />
      {main ? (
        <text x="12" y={70 + heightOffset} fontFamily={fonts.family} fontSize={fonts.main} textAnchor="start" fill={mainColor} cursor={cursor} {...mouseHandlers("main")}>
          {main}
        </text>
      ) : null}
      {keyword ? (
        <text x="88" y={92 + heightOffset} fontFamily={fonts.family} fontSize={fonts.keyword} textAnchor="end" fill={mainColor} cursor={cursor} {...mouseHandlers("main")}>
          {keyword}
        </text>
      ) : null}
      {symbol ? (
        <text x="64" y={(topNum ? 90 : 64) + heightOffset} fontFamily={fonts.family} fontSize={topNum ? fonts.topSymbol : fonts.symbol} textAnchor="middle" fill={symbolColor} cursor={cursor} {...mouseHandlers("symbol")}>
          {symbol}
        </text>
      ) : null}
      {symbolWord ? (
        <text x="92" y={58 + heightOffset} fontFamily={fonts.family} fontSize={fonts.symbolWord} textAnchor="end" fill={symbolColor} cursor={cursor} {...mouseHandlers("symbol")}>
          {symbolWord}
        </text>
      ) : null}
      {above ? (
        <text x="0" y={20 + heightOffset} fontFamily={fonts.family} fontSize={fonts.above} textAnchor="start" fill={aboveColor} cursor={cursor} {...mouseHandlers(topNum ? "topNum" : "above")}>
          {above}
        </text>
      ) : null}
      {aboveIcon ? (
        <ArrowIconGlyph
          direction={aboveIcon}
          y={heightOffset}
          color={aboveColor}
          cursor={cursor}
          {...mouseHandlers(topNum ? "topNum" : "above")}
        />
      ) : null}
      {below ? (
        <text x="0" y={124 + heightOffset} fontFamily={fonts.family} fontSize={fonts.below} textAnchor="start" fill={belowColor} cursor={cursor} {...mouseHandlers("below")}>
          {below}
        </text>
      ) : null}
      {center ? (
        <text x={normalWidth / 2} y={(top ? 86 : 74) + heightOffset} fontFamily={fonts.family} fontSize={fonts.center} textAnchor="middle" fill={mainColor} cursor={cursor} {...mouseHandlers("main")}>
          {center}
        </text>
      ) : null}
      {top ? (
        <text x={normalWidth / 2} y={62 + heightOffset} fontFamily={fonts.family} fontSize={fonts.shift} textAnchor="middle" fill={shiftColor} cursor={cursor} {...mouseHandlers("main")}>
          {top}
        </text>
      ) : null}
      {bottom ? (
        <text x={normalWidth / 2} y={84 + heightOffset} fontFamily={fonts.family} fontSize={fonts.shift} textAnchor="middle" fill={shiftColor} cursor={cursor} {...mouseHandlers("main")}>
          {bottom}
        </text>
      ) : null}
      {topNum ? (
        <text x="0" y="18" fontFamily={fonts.family} fontSize={fonts.topNumber} textAnchor="start" fill={isHot("topNum") ? colors.highlight : topNumColor ?? colors.main} cursor={cursor} {...mouseHandlers("topNum")}>
          {topNum}
        </text>
      ) : null}
    </svg>
  );

  function mouseHandlers(category: KeyCategory) {
    return {
      onMouseEnter: () => setHot(category),
      onMouseLeave: () => setHot(undefined),
      onMouseDown: (event: MouseEvent) => raiseKeyAction(event, category, true),
      onMouseUp: (event: MouseEvent) => raiseKeyAction(event, category, false)
    };
  }

  function raiseKeyAction(event: MouseEvent, keyCategory: KeyCategory, down: boolean): void {
    keyAction?.({
      code,
      keyCategory,
      button: event.button,
      down
    });
  }
});

function getKeyboardThemeVars() {
  return {
    keyBackground: "var(--xmlui-backgroundColor-key-EmuKeyboard, #707070)",
    main: "var(--xmlui-color-mainKey-EmuKeyboard, #e0e0e0)",
    symbol: "var(--xmlui-color-symbolKey-EmuKeyboard, #c00000)",
    above: "var(--xmlui-color-aboveKey-EmuKeyboard, #00a000)",
    below: "var(--xmlui-color-belowKey-EmuKeyboard, #d02000)",
    highlight: "var(--xmlui-color-highlightKey-EmuKeyboard, #0048c0)",
    highlightBackground: "var(--xmlui-backgroundColor-highlightedKey-EmuKeyboard, #0B486B)"
  };
}

function getKeyboardFontThemeVars() {
  return {
    family:
      "var(--xmlui-fontFamily-EmuKeyboard, -apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif)",
    main: "var(--xmlui-fontSize-mainKey-EmuKeyboard, 36px)",
    keyword: "var(--xmlui-fontSize-keywordKey-EmuKeyboard, 22px)",
    symbol: "var(--xmlui-fontSize-symbolKey-EmuKeyboard, 28px)",
    topSymbol: "var(--xmlui-fontSize-topSymbolKey-EmuKeyboard, 24px)",
    symbolWord: "var(--xmlui-fontSize-symbolWordKey-EmuKeyboard, 18px)",
    above: "var(--xmlui-fontSize-aboveKey-EmuKeyboard, 20px)",
    below: "var(--xmlui-fontSize-belowKey-EmuKeyboard, 20px)",
    center: "var(--xmlui-fontSize-centerKey-EmuKeyboard, 28px)",
    shift: "var(--xmlui-fontSize-shiftKey-EmuKeyboard, 20px)",
    topNumber: "var(--xmlui-fontSize-topNumberKey-EmuKeyboard, 20px)"
  };
}

function ArrowIconGlyph({
  direction,
  y,
  color,
  cursor,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp
}: {
  direction: ArrowIcon;
  y: number;
  color: string;
  cursor: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
}) {
  const rotation = {
    left: 180,
    right: 0,
    up: 270,
    down: 90
  }[direction];

  return (
    <g
      transform={`translate(2 ${y + 2}) rotate(${rotation} 14 14)`}
      cursor={cursor}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <path
        d="M4 14h18M15 7l7 7-7 7"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </g>
  );
}
