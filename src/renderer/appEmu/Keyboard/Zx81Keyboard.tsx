import { Zx81Key, type Zx81KeyDef } from "./Zx81Key";
import { Column, Row, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";

/*
 * The ZX81 virtual keyboard (`.plans/ZX8081_WASM_PLAN.md` §8.1), built to the approved mockup
 * `.plans/zx8081/zx81-keyboard-mockup.html`: geometry measured from the reference photo, legends from
 * the ROM's key tables (K-UNSHIFT $007E, K-SHIFT $00A5, K-FUNCT $00CC, K-GRAPH $00F3).
 */

/** The whole keyboard in key units (the photo's 629 x 228 px at 100 units per key) */
const DEFAULT_WIDTH = 1382;
const DEFAULT_HEIGHT = 501;

/** Row stagger against the first row, and the outer margin, in key units (§8.1.3) */
const ROW_OFFSETS = [0, 68.1, 98.9, 37.4];
const OUTER_MARGIN = 15.4;

/** The ZX81's SHIFT, NEW LINE and 9 (GRAPHICS) key codes */
const SHIFT = 0;
const NEW_LINE = 30;
const KEY_9 = 21;

/**
 * Queued keystrokes: held 4 frames, 10 frames apart. The ROM ignores a key that follows the last one
 * by fewer than 4 key-free frames (its DEBOUNCE), so the 48K keyboard's 0/3/10 offsets would lose
 * keys here.
 */
const HOLD = 4;
const STEP = 10;

/** The key table: the mockup's `R` array (§8.1.4) */
export const ZX81_KEY_ROWS: Zx81KeyDef[][] = [
  [
    { c: 15, m: "1", s: "EDIT", g: 0x01 },
    { c: 16, m: "2", s: "AND", g: 0x02 },
    { c: 17, m: "3", s: "THEN", g: 0x87 },
    { c: 18, m: "4", s: "TO", g: 0x04 },
    { c: 19, m: "5", arrow: "l", g: 0x05 },
    { c: 24, m: "6", arrow: "d", g: 0x83 },
    { c: 23, m: "7", arrow: "u", g: 0x03 },
    { c: 22, m: "8", arrow: "r", g: 0x85 },
    { c: 21, m: "9", s: "GRAPHICS" },
    { c: 20, m: "Ø", s: "RUBOUT" }
  ],
  [
    { c: 10, m: "Q", s: '""', sym: true, k: "PLOT", f: "SIN", g: 0x81 },
    { c: 11, m: "W", s: "OR", k: "UNPLOT", f: "COS", g: 0x82 },
    { c: 12, m: "E", s: "STEP", k: "REM", f: "TAN", g: 0x07 },
    { c: 13, m: "R", s: "<=", sym: true, k: "RUN", f: "INT", g: 0x84 },
    { c: 14, m: "T", s: "<>", sym: true, k: "RAND", f: "RND", g: 0x06 },
    { c: 29, m: "Y", s: ">=", sym: true, k: "RETURN", f: "STR$", g: 0x86 },
    { c: 28, m: "U", s: "$", sym: true, k: "IF", f: "CHR$" },
    { c: 27, m: "I", s: "(", sym: true, k: "INPUT", f: "CODE" },
    { c: 26, m: "O", s: ")", sym: true, k: "POKE", f: "PEEK" },
    { c: 25, m: "P", s: '"', sym: true, k: "PRINT", f: "TAB" }
  ],
  [
    { c: 5, m: "A", s: "STOP", k: "NEW", f: "ARCSIN", g: 0x08 },
    { c: 6, m: "S", s: "LPRINT", k: "SAVE", f: "ARCCOS", g: 0x0a },
    { c: 7, m: "D", s: "SLOW", k: "DIM", f: "ARCTAN", g: 0x09 },
    { c: 8, m: "F", s: "FAST", k: "FOR", f: "SGN", g: 0x8a },
    { c: 9, m: "G", s: "LLIST", k: "GOTO", f: "ABS", g: 0x89 },
    { c: 34, m: "H", s: "**", sym: true, k: "GOSUB", f: "SQR", g: 0x88 },
    { c: 33, m: "J", s: "−", sym: true, k: "LOAD", f: "VAL" },
    { c: 32, m: "K", s: "+", sym: true, k: "LIST", f: "LEN" },
    { c: 31, m: "L", s: "=", sym: true, k: "LET", f: "USR" },
    { c: 30, nl: true, s: "FUNCTION" }
  ],
  [
    { c: 0, shift: true },
    { c: 1, m: "Z", s: ":", sym: true, k: "COPY", f: "LN" },
    { c: 2, m: "X", s: ";", sym: true, k: "CLEAR", f: "EXP" },
    { c: 3, m: "C", s: "?", sym: true, k: "CONT", f: "AT" },
    { c: 4, m: "V", s: "/", sym: true, k: "CLS" },
    { c: 39, m: "B", s: "*", sym: true, k: "SCROLL", f: "INKEY$" },
    { c: 38, m: "N", s: "<", sym: true, k: "NEXT", f: "NOT" },
    { c: 37, m: "M", s: ">", sym: true, k: "PAUSE", f: "π" },
    { c: 36, m: ".", s: ",", sym: true },
    { c: 35, space: true, s: "£", sym: true, k: "BREAK" }
  ]
];

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Zx81Keyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, DEFAULT_WIDTH, DEFAULT_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);

  return (
    <Column
      width="auto"
      style={{
        ...keyboardRootStyle,
        backgroundColor: theme.getThemeProperty("--bgcolor-keyboardzx81"),
        padding: OUTER_MARGIN * zoom,
        borderRadius: 6 * zoom
      }}
    >
      {ZX81_KEY_ROWS.map((row, ri) => (
        <Row key={ri} height="auto" style={{ marginLeft: ROW_OFFSETS[ri] * zoom }}>
          {row.map((def) => (
            <Zx81Key
              key={def.c}
              zoom={zoom}
              def={def}
              pressed={isPressed(def.c)}
              keyAction={handleClick}
            />
          ))}
        </Row>
      ))}
    </Column>
  );

  /**
   * A click on a zone (§8.1.5): the key face or keyword holds the key (with SHIFT on the right
   * button), the red legend holds SHIFT with the key, the function types FUNCTION mode then the key,
   * the graphic types GRAPHICS on, SHIFT + the key, GRAPHICS off.
   */
  function handleClick(e: KeyboardButtonClickArgs): void {
    const machine = machineService.getMachineController()?.machine;
    if (!machine || machine.getKeyQueueLength() > 0) return;

    const setKeys = (down: boolean, ...codes: number[]) => codes.forEach((c) => machine.setKeyStatus(c, down));
    switch (e.keyCategory) {
      case "main":
        if (e.code === SHIFT || e.button === 0) {
          setKeys(e.down, e.code);
        } else {
          setKeys(e.down, e.code, SHIFT);
        }
        break;
      case "shift":
        setKeys(e.down, e.code, SHIFT);
        break;
      case "below":
        if (e.down) {
          machine.queueKeystroke(0, HOLD, NEW_LINE, SHIFT);
          machine.queueKeystroke(STEP, HOLD, e.code);
        }
        break;
      case "glyph":
        if (e.down) {
          machine.queueKeystroke(0, HOLD, KEY_9, SHIFT);
          machine.queueKeystroke(STEP, HOLD, e.code, SHIFT);
          machine.queueKeystroke(2 * STEP, HOLD, KEY_9, SHIFT);
        }
        break;
    }
  }
};
