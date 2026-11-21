import { useState } from "react";
import { Column, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";

/*
 * The SAM Coupé virtual keyboard (`dev/plans/SAM_COUPE_PLAN.md` §9.1), drawn from a photo of a SAM Coupé
 * (https://www.homecomputermuseum.nl/wp-content/uploads/2024/08/20250220_104928.png) and the layout the
 * project author approved from a mockup: beige character, function and cursor keys, darker taupe control
 * keys, the inverted-L RETURN, and the F-key and cursor cluster on the right. The case's SAM coupé and MGT
 * branding is left out (the project author's review: it costs screen space).
 *
 * Every matrix key is on it once except SHIFT and SYMBOL (two caps each, one key) and the full stop, which
 * the cluster repeats. The caps print what the photographed machine prints: the shifted symbol at the
 * top-left of the number and punctuation keys, the SYMBOL character above some letters. Zones: the cap
 * presses the key (the right button adds SHIFT); a small shifted legend presses SHIFT with the key; a small
 * SYMBOL legend presses SYMBOL with the key.
 */

/** One key unit in the drawing */
const U = 100;
/** The key well's padding around the keys; the case shows only as a hairline (the project author's review) */
const MARGIN = 0.12;
/** The gap between two keys, in drawing units */
const GAP = 7;
/** The cap's inset on the key's base: a narrow shaded side, as in the photo (the project author's review) */
const CAP_INSET = 4;
/** The cluster's first column */
const CLUSTER_X = 15;
/** The whole keyboard in drawing units */
export const SAM_KEYBOARD_WIDTH = (CLUSTER_X + 3 + MARGIN * 2) * U;
export const SAM_KEYBOARD_HEIGHT = (5 + MARGIN * 2) * U;

/** A key's colour, as on the machine: beige character keys (function and cursor keys too), taupe control keys */
export type SamKeyKind = "char" | "control" | "cluster";

/** What a key's small legend presses with it */
export type SamTopKind = "shift" | "symbol";

/** One key: its matrix code name, the cap's legends, its place (x, and y as the row) and size in key units */
export type SamKeyDef = {
  name: string;
  main: string;
  top?: string;
  topKind?: SamTopKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: SamKeyKind;
  /** RETURN: its lower half starts here (key units), left of its upper half */
  lowerX?: number;
};

const key = (name: string, main: string, x: number, y: number, w = 1, top?: string, topKind?: SamTopKind): SamKeyDef => ({
  name,
  main,
  x,
  y,
  w,
  top: top || undefined,
  topKind: top ? topKind : undefined
});
const ctl = (name: string, main: string, x: number, y: number, w = 1): SamKeyDef => ({ name, main, x, y, w, kind: "control" });

/** The number row: matrix key, legend, shifted legend */
const NUMBER_ROW: [string, string, string][] = [
  ["N1", "1", "!"],
  ["N2", "2", "@"],
  ["N3", "3", "#"],
  ["N4", "4", "$"],
  ["N5", "5", "%"],
  ["N6", "6", "&"],
  ["N7", "7", "'"],
  ["N8", "8", "("],
  ["N9", "9", ")"],
  ["N0", "0", "~"]
];

/** The letter rows: the letter and the SYMBOL character printed above it */
const TOP_ROW: [string, string][] = [
  ["Q", "<"],
  ["W", ">"],
  ["E", ""],
  ["R", "["],
  ["T", "]"],
  ["Y", ""],
  ["U", ""],
  ["I", ""],
  ["O", ""],
  ["P", ""]
];
const MIDDLE_ROW: [string, string][] = [
  ["A", ""],
  ["S", ""],
  ["D", ""],
  ["F", "{"],
  ["G", "}"],
  ["H", "↑"],
  ["J", ""],
  ["K", ""],
  ["L", "£"]
];
const BOTTOM_ROW: [string, string][] = [
  ["Z", ""],
  ["X", "?"],
  ["C", ""],
  ["V", ""],
  ["B", ""],
  ["N", ""],
  ["M", ""]
];

/** The cluster on the right, row by row: matrix key and legend */
const CLUSTER: [string, string][][] = [
  [
    ["F7", "F7"],
    ["F8", "F8"],
    ["F9", "F9"]
  ],
  [
    ["F4", "F4"],
    ["F5", "F5"],
    ["F6", "F6"]
  ],
  [
    ["F1", "F1"],
    ["F2", "F2"],
    ["F3", "F3"]
  ],
  [
    ["F0", "F0"],
    ["Up", "⌃"],
    ["Period", "·"]
  ],
  [
    ["Left", "‹"],
    ["Down", "⌄"],
    ["Right", "›"]
  ]
];

/** Every key, row by row as the photo shows them */
export const SAM_KEYS: SamKeyDef[] = [
  // --- Row 0: ESC, the number row, - and +, DELETE
  ctl("Esc", "ESC", 0, 0),
  ...NUMBER_ROW.map(([name, main, top], i) => key(name, main, 1 + i, 0, 1, top, "shift")),
  key("Minus", "−", 11, 0, 1, "/", "shift"),
  key("Plus", "+", 12, 0, 1, "*", "shift"),
  ctl("Delete", "DELETE", 13, 0, 1.6),
  // --- Row 1: TAB, QWERTYUIOP, = and ", RETURN's upper half (over rows 1-2)
  ctl("Tab", "TAB", 0, 1, 1.5),
  ...TOP_ROW.map(([name, top], i) => key(name, name, 1.5 + i, 1, 1, top, "symbol")),
  key("Equals", "=", 11.5, 1, 1, "_", "shift"),
  key("Quote", "”", 12.5, 1, 1, "©", "shift"),
  { name: "Enter", main: "RETURN", x: 13.5, y: 1, w: 1.1, h: 2, kind: "control", lowerX: 12.75 },
  // --- Row 2: CAPS, ASDFGHJKL, ; and :
  ctl("Caps", "CAPS", 0, 2, 1.75),
  ...MIDDLE_ROW.map(([name, top], i) => key(name, name, 1.75 + i, 2, 1, top, "symbol")),
  key("Semicolon", ";", 10.75, 2),
  key("Colon", ":", 11.75, 2),
  // --- Row 3: SHIFT, ZXCVBNM, comma, full stop, INV, SHIFT
  ctl("Shift", "SHIFT", 0, 3, 2.25),
  ...BOTTOM_ROW.map(([name, top], i) => key(name, name, 2.25 + i, 3, 1, top, "symbol")),
  key("Comma", ",", 9.25, 3),
  key("Period", ".", 10.25, 3),
  key("Inv", "INV", 11.25, 3, 1, "\\", "shift"),
  ctl("Shift", "SHIFT", 12.25, 3, 2.35),
  // --- Row 4: SYMBOL, CNTRL, the space bar, EDIT, SYMBOL
  ctl("Symbol", "SYMBOL", 0, 4, 1.75),
  ctl("Cntrl", "CNTRL", 1.75, 4, 1.5),
  key("Space", "", 3.25, 4, 8),
  ctl("Edit", "EDIT", 11.25, 4, 1.5),
  ctl("Symbol", "SYMBOL", 12.75, 4, 1.85),
  // --- The cluster: the function keys and the cursor keys
  ...CLUSTER.flatMap((row, r) => row.map(([name, main], c): SamKeyDef => ({ name, main, x: CLUSTER_X + c, y: r, kind: "cluster" })))
];

const FONT = "Helvetica, Arial, sans-serif";

type Zone = "main" | "shift" | "symbol";

/** A key's outline at `inset`: a rounded rectangle, or RETURN's inverted L */
function outline(def: SamKeyDef, w: number, h: number, inset: number): JSX.Element {
  const r = inset ? 12 : 16;
  if (def.lowerX === undefined) return <rect x={inset} y={inset} width={w - 2 * inset} height={h - 2 * inset} rx={r} />;
  const l = inset;
  const right = w - inset;
  const top = inset;
  const bottom = h - inset;
  // --- The lower half's left edge, relative to the key's own left edge, and the step's height
  const lx = (def.lowerX - def.x) * U + inset;
  const mid = U - GAP / 2 + inset;
  return (
    <path
      d={`M ${l + r} ${top} H ${right - r} Q ${right} ${top} ${right} ${top + r} V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom}
          H ${lx + r} Q ${lx} ${bottom} ${lx} ${bottom - r} V ${mid + r} Q ${lx} ${mid} ${lx + r} ${mid}
          H ${l - r} Q ${l} ${mid} ${l} ${mid - r} V ${top + r} Q ${l} ${top} ${l + r} ${top} Z`}
    />
  );
}

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const SamKeyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, SAM_KEYBOARD_WIDTH, SAM_KEYBOARD_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);
  const [hover, setHover] = useState<string | undefined>();

  const color = (token: string) => theme.getThemeProperty(token);
  const caseColor = color("--bgcolor-keyboardsam");
  const well = color("--bgcolor-keyboardsam-well");
  const light = { face: color("--bgcolor-keysam"), edge: color("--color-keysam-edge"), pressed: color("--bgcolor-hilitedsam") };
  const faces: Record<SamKeyKind, { face: string; edge: string; pressed: string }> = {
    char: light,
    cluster: light,
    control: {
      face: color("--bgcolor-keysam-ctl"),
      edge: color("--color-keysam-ctl-edge"),
      pressed: color("--bgcolor-hilitedsam-ctl")
    }
  };
  const ink = color("--color-keysam-main");
  const highlight = color("--color-keysam-highlight");

  const machine = () => machineService.getMachineController()?.machine;
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const X = (u: number) => (MARGIN + u) * U;
  const Y = (u: number) => (MARGIN + u) * U;

  /** Mouse handlers of a zone that presses `code` */
  const zoneProps = (id: string, code: number, zone: Zone) => ({
    "data-zone": zone,
    style: { cursor: "pointer" },
    onMouseEnter: () => setHover(`${id}:${zone}`),
    onMouseLeave: () => setHover(undefined),
    onMouseDown: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: true }),
    onMouseUp: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: false })
  });

  const keys = SAM_KEYS.map((def) => {
    const kind = def.kind ?? "char";
    const w = (def.w ?? 1) * U - GAP;
    const h = (def.h ?? 1) * U - GAP;
    const code = SamKeyCode[def.name];
    const id = `${def.name}-${def.x}-${def.y}`;
    const down = code !== undefined && isPressed(code);
    const legend = (z: Zone) => (hover === `${id}:${z}` ? highlight : ink);
    const { face, edge, pressed } = faces[kind];
    let label: JSX.Element | null = null;
    if (kind === "control") {
      const tx = def.lowerX !== undefined ? ((def.lowerX - def.x) * U + w) / 2 : w / 2;
      const ty = def.lowerX !== undefined ? U + 48 : h / 2 + 7;
      label = (
        <text x={tx} y={ty} fontSize={19} textAnchor="middle" letterSpacing={0.5} fill={legend("main")}>
          {def.main}
        </text>
      );
    } else if (def.main) {
      const letter = /^[A-Z]$/.test(def.main);
      const size = kind === "cluster" ? (def.main.length > 1 ? 24 : 36) : letter ? 34 : def.main === "INV" ? 17 : 30;
      label = (
        <text x={kind === "cluster" ? 28 : 22} y={def.top ? 72 : 60} fontSize={size} fontWeight={letter ? 500 : 400} fill={legend("main")}>
          {def.main}
        </text>
      );
    }
    return (
      <g key={id} transform={`translate(${(X(def.x) + GAP / 2).toFixed(1)} ${(Y(def.y) + GAP / 2).toFixed(1)})`} data-sam-key={def.name}>
        <g {...zoneProps(id, code, "main")}>
          <g fill={edge}>{outline(def, w, h, 0)}</g>
          <g fill={down ? pressed : face}>{outline(def, w, h, CAP_INSET)}</g>
          {label}
        </g>
        {def.top && (
          <g {...zoneProps(id, code, def.topKind ?? "shift")}>
            <rect x={12} y={10} width={38} height={30} fill="transparent" />
            <text x={24} y={36} fontSize={20} fill={legend(def.topKind ?? "shift")}>
              {def.top}
            </text>
          </g>
        )}
      </g>
    );
  });

  const VW = SAM_KEYBOARD_WIDTH;
  const VH = SAM_KEYBOARD_HEIGHT;
  return (
    <Column width="auto" style={keyboardRootStyle}>
      <svg
        width={VW * appliedZoom}
        height={VH * appliedZoom}
        viewBox={`0 0 ${VW.toFixed(0)} ${VH.toFixed(0)}`}
        fontFamily={FONT}
        onContextMenu={(e) => e.preventDefault()}
        style={{ flexShrink: 0 }}
      >
        <rect width="100%" height="100%" rx={12} fill={well} stroke={caseColor} strokeWidth={4} />
        {keys}
      </svg>
    </Column>
  );

  /**
   * A click on a zone: the cap holds the key (and SHIFT on the right button), a shifted legend holds SHIFT
   * with it, a SYMBOL legend holds SYMBOL with it
   */
  function handleClick(e: KeyboardButtonClickArgs): void {
    const m = machine();
    if (!m || m.getKeyQueueLength() > 0) return;
    const setKeys = (down: boolean, ...codes: number[]) => codes.forEach((c) => m.setKeyStatus(c, down));
    const zone = e.keyCategory as Zone;
    if (zone === "shift") setKeys(e.down, e.code, SamKeyCode.Shift);
    else if (zone === "symbol") setKeys(e.down, e.code, SamKeyCode.Symbol);
    else if (e.code === SamKeyCode.Shift || e.button === 0) setKeys(e.down, e.code);
    else setKeys(e.down, e.code, SamKeyCode.Shift);
  }
};
