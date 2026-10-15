import { Zx80Key, type Zx80KeyDef, ZX80_CELL_HEIGHT } from "./Zx80Key";
import { ZX81_KEY_HEIGHT } from "./Zx81Key";
import { Column, Row, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";

/*
 * The ZX80 virtual keyboard (`.plans/ZX8081_WASM_PLAN.md` §8.1.9): the ZX81's key geometry (§8.1.3)
 * with the 4K-ROM ZX80's legends. The legends come from the ROM's key tables - unshifted at $006C,
 * shifted at $0093 (tokens from $00BA), keywords by K-mode letter - and their placement from a photo
 * of an original machine.
 *
 * Every legend on this keyboard is the key itself or SHIFT + the key: keywords appear in K mode,
 * graphics are shifted letters, and there is no FUNCTION or GRAPHICS mode. So unlike the ZX81 nothing
 * is queued, and a click is a plain press held for as long as the mouse button is.
 */

/** Row stagger against the first row and the outer margin, in key units: the ZX81's (§8.1.3) */
const ROW_OFFSETS = [0, 68.1, 98.9, 37.4];
const OUTER_MARGIN = 15.4;

/** The visible keyboard in key units: the widest row's last face, the last row's face bottom */
const DEFAULT_WIDTH = Math.ceil(ROW_OFFSETS[2] + 9 * 128.1 + 100 + 2 * OUTER_MARGIN);
const DEFAULT_HEIGHT = Math.ceil(3 * ZX80_CELL_HEIGHT + 24 + ZX81_KEY_HEIGHT + 2 * OUTER_MARGIN);

/** The ZX80's SHIFT key code */
const SHIFT = 0;

/** The key table, read from the 4K ROM and checked against the photo */
export const ZX80_KEY_ROWS: Zx80KeyDef[][] = [
  [
    { c: 15, m: "1", sa: "NOT" },
    { c: 16, m: "2", sa: "AND" },
    { c: 17, m: "3", sa: "THEN" },
    { c: 18, m: "4", sa: "TO" },
    { c: 19, m: "5", arrow: "l" },
    { c: 24, m: "6", arrow: "d" },
    { c: 23, m: "7", arrow: "u" },
    { c: 22, m: "8", arrow: "r" },
    { c: 21, m: "9", sa: "HOME" },
    { c: 20, m: "0", sa: "RUBOUT" }
  ],
  [
    { c: 10, m: "Q", k: "NEW", g: 0x02 },
    { c: 11, m: "W", k: "LOAD", g: 0x03 },
    { c: 12, m: "E", k: "SAVE", g: 0x04 },
    { c: 13, m: "R", k: "RUN", g: 0x05 },
    { c: 14, m: "T", k: "CONT", g: 0x0a },
    { c: 29, m: "Y", k: "REM", s: '"' },
    { c: 28, m: "U", k: "IF", s: "$" },
    { c: 27, m: "I", k: "INPUT", s: "(" },
    { c: 26, m: "O", k: "PRINT", s: ")" },
    { c: 25, m: "P", s: "*" }
  ],
  [
    { c: 5, m: "A", k: "LIST", g: 0x09 },
    { c: 6, m: "S", k: "STOP", g: 0x08 },
    { c: 7, m: "D", k: "DIM", g: 0x06 },
    { c: 8, m: "F", k: "FOR", g: 0x07 },
    { c: 9, m: "G", k: "GOTO", g: 0x0b },
    { c: 34, m: "H", k: "POKE", s: "**" },
    { c: 33, m: "J", k: "RAND", s: "−" },
    { c: 32, m: "K", k: "LET", s: "+" },
    { c: 31, m: "L", s: "=" },
    { c: 30, nl: true, sa: "EDIT" }
  ],
  [
    { c: 0, shift: true },
    { c: 1, m: "Z", s: ":" },
    { c: 2, m: "X", k: "CLEAR", s: ";" },
    { c: 3, m: "C", k: "CLS", s: "?" },
    { c: 4, m: "V", k: "GOSUB", s: "/" },
    { c: 39, m: "B", k: "RET", s: "OR" },
    { c: 38, m: "N", k: "NEXT", s: "<" },
    { c: 37, m: "M", s: ">" },
    { c: 36, m: ".", s: "," },
    { c: 35, space: true, s: "£", dim: "BREAK" }
  ]
];

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Zx80Keyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, DEFAULT_WIDTH, DEFAULT_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);

  return (
    <Column
      width="auto"
      style={{
        ...keyboardRootStyle,
        backgroundColor: theme.getThemeProperty("--bgcolor-keyboardzx80"),
        padding: OUTER_MARGIN * zoom,
        borderRadius: 6 * zoom
      }}
    >
      {ZX80_KEY_ROWS.map((row, ri) => (
        <Row key={ri} height="auto" style={{ marginLeft: ROW_OFFSETS[ri] * zoom }}>
          {row.map((def) => (
            <Zx80Key key={def.c} zoom={zoom} def={def} pressed={isPressed(def.c)} keyAction={handleClick} />
          ))}
        </Row>
      ))}
    </Column>
  );

  /**
   * A click on a zone: the key face or the keyword above it holds the key (with SHIFT on the right
   * button); an amber legend or graphic holds SHIFT with the key.
   */
  function handleClick(e: KeyboardButtonClickArgs): void {
    const machine = machineService.getMachineController()?.machine;
    if (!machine || machine.getKeyQueueLength() > 0) return;

    const withShift = e.keyCategory === "shift" || (e.code !== SHIFT && e.button !== 0);
    machine.setKeyStatus(e.code, e.down);
    if (withShift) machine.setKeyStatus(SHIFT, e.down);
  }
};
