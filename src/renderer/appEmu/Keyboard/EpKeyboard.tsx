import { useState } from "react";
import { Column, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";
import { EpKeyCode } from "@emu/machines/enterprise/EpKeyCode";

/*
 * The Enterprise 64/128 virtual keyboard (`.plans/ENTERPRISE_PLAN.md` §9.1), drawn from a photo of an
 * Enterprise 128 (https://frescho.hu/wp-content/gallery/enterprise-128/IMG_2033.JPG) and the layout the
 * project author approved from a mockup: dark grey character keys, green control keys, eight blue
 * function keys under the word processor's label strip, a red STOP, the L-shaped ENTER and the built-in
 * joystick. One SVG holds it all, because the rows are not a grid of equal keys.
 *
 * The caps print exactly what the photographed (German-layout) machine prints: QWERTZ, Ü Ö Ä ß §, and
 * so on. Each key is the matrix key at that place, so the legend is the cap's, not what the UK EXOS
 * Klive runs types there (the cap printed Z is the matrix's Y). PAUSE is HOLD in EXOS's documents.
 *
 * Every key but ENTER is one unit high: a flat base in the key's edge colour with a raised cap centred
 * on it. Zones: the cap presses the key (the right button adds SHIFT); the printed shifted legend
 * presses SHIFT with the key. The joystick's four directions are the cursor keys of matrix row 7, and
 * its knob is SPACE, the built-in stick's fire (the EXOS book); the arrows on it are Klive's.
 */

/** One key unit in the drawing */
const U = 100;
const MARGIN = 0.35;
/** The label strip's height above the function keys, in key units */
const STRIP = 0.78;
/** The gap between two keys, in drawing units */
const GAP = 6;
/** The joystick's centre (key units, from the function row's top) and the radius of its rings */
const JOY_X = 16.15;
const JOY_Y = 3.75;
const JOY_R = 1.0;
/** The function keys' width and the first one's place */
const FKEY_W = 1.7;
const FKEY_X = 1;
/** The whole keyboard in drawing units */
export const EP_KEYBOARD_WIDTH = (17.3 + MARGIN * 2) * U;
export const EP_KEYBOARD_HEIGHT = (STRIP + 6 + MARGIN * 2) * U;

/** A key's colour, as on the machine */
export type EpKeyKind = "char" | "control" | "function" | "stop";

/** One key: its matrix code name, the cap's legends, its place (x, and y as the row) and size in key units */
export type EpKeyDef = {
  name: string;
  main: string;
  shifted?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: EpKeyKind;
  /** ENTER's notch: its lower part starts this much further right */
  notch?: number;
  /** The small symbol printed with the legend: ERASE's ⌫ before it, DEL's ⌦ after it */
  icon?: "erase" | "del";
};

const ch = (name: string, main: string, x: number, y: number, shifted?: string): EpKeyDef => ({ name, main, shifted, x, y });
const ctl = (name: string, main: string, x: number, y: number, w = 1, icon?: EpKeyDef["icon"]): EpKeyDef => ({
  name,
  main,
  x,
  y,
  w,
  kind: "control",
  icon
});

/** The number row as printed: matrix key, legend, shifted legend */
const NUMBER_ROW: [string, string, string][] = [
  ["N1", "1", "!"],
  ["N2", "2", '"'],
  ["N3", "3", "§"],
  ["N4", "4", "$"],
  ["N5", "5", "%"],
  ["N6", "6", "&"],
  ["N7", "7", "/"],
  ["N8", "8", "("],
  ["N9", "9", ")"],
  ["N0", "Ø", "="],
  ["Minus", "ß", "?"],
  ["Caret", "´", "`"]
];

/** The letter rows as printed: matrix key and legend */
const TOP_ROW: [string, string][] = [
  ["Q", "Q"],
  ["W", "W"],
  ["E", "E"],
  ["R", "R"],
  ["T", "T"],
  ["Y", "Z"],
  ["U", "U"],
  ["I", "I"],
  ["O", "O"],
  ["P", "P"],
  ["At", "Ü"]
];
const MIDDLE_ROW: [string, string][] = [..."ASDFGHJKL"].map((c): [string, string] => [c, c]).concat([
  ["Semicolon", "Ö"],
  ["Colon", "Ä"]
]);
const BOTTOM_ROW: [string, string][] = [
  ["Z", "Y"],
  ["X", "X"],
  ["C", "C"],
  ["V", "V"],
  ["B", "B"],
  ["N", "N"],
  ["M", "M"]
];

/** Every key, row by row as the photo shows them */
export const EP_KEYS: EpKeyDef[] = [
  // --- Row 0: the function keys under the label strip, a gap, PAUSE and STOP
  ...Array.from({ length: 8 }, (_, i): EpKeyDef => ({
    name: `F${i + 1}`,
    main: `F${i + 1}`,
    x: FKEY_X + i * FKEY_W,
    y: 0,
    w: FKEY_W,
    kind: "function"
  })),
  ctl("Hold", "PAUSE", 14.9, 0),
  { name: "Stop", main: "STOP", x: 15.9, y: 0, w: 1.4, kind: "stop" },
  // --- Row 1: ESC, the number row, ERASE, DEL and INS
  ctl("Esc", "ESC", 0, 1),
  ...NUMBER_ROW.map(([name, main, shifted], i) => ch(name, main, 1 + i, 1, shifted)),
  ctl("Erase", "ERASE", 13, 1, 1.7, "erase"),
  ctl("Del", "DEL", 14.7, 1, 1.6, "del"),
  ctl("Ins", "INS", 16.3, 1),
  // --- Row 2: TAB, QWERTZUIOPÜ, +, and ENTER over rows 2-3
  ctl("Tab", "TAB", 0, 2, 1.5),
  ...TOP_ROW.map(([name, main], i) => ch(name, main, 1.5 + i, 2)),
  ch("LBracket", "+", 12.5, 2, "*"),
  { name: "Enter", main: "ENTER", x: 13.5, y: 2, w: 1.5, h: 2, kind: "control", notch: 0.5 },
  // --- Row 3: CTRL, LOCK, ASDFGHJKLÖÄ, #
  ctl("Ctrl", "CTRL", 0, 3),
  ctl("Lock", "LOCK", 1, 3),
  ...MIDDLE_ROW.map(([name, main], i) => ch(name, main, 2 + i, 3)),
  ch("RBracket", "#", 13, 3, "^"),
  // --- Row 4: SHIFT, the < > key, YXCVBNM, the punctuation, SHIFT, ALT
  ctl("LShift", "SHIFT", 0, 4, 1.5),
  ch("Backslash", ">", 1.5, 4, "<"),
  ...BOTTOM_ROW.map(([name, main], i) => ch(name, main, 2.5 + i, 4)),
  ch("Comma", ",", 9.5, 4, ";"),
  ch("Period", ".", 10.5, 4, ":"),
  ch("Slash", "-", 11.5, 4, "_"),
  ctl("RShift", "SHIFT", 12.5, 4, 1.5),
  ctl("Alt", "ALT", 14, 4),
  // --- Row 5: the space bar
  { name: "Space", main: "", x: 2.5, y: 5, w: 9 }
];

/** The word processor's labels on the strip above each function key (two lines; F8 has none) */
export const EP_STRIP_LABELS: [string, string][] = [
  ["REFORM", "JUSTIFY"],
  ["CENTRE", "CLEAR TABS"],
  ["TAB SET/CLEAR", "RULER LINE"],
  ["LEFT MARGIN", "RIGHT MARGIN"],
  ["MARGIN RELEASE", "RESET MARGINS"],
  ["MOVE UP", "MOVE DOWN"],
  ["LINE COLOUR", "PARA COLOUR"],
  ["", ""]
];

/** The joystick: a direction's key and the arrow's angle (0 = up, clockwise) */
export const EP_JOYSTICK: { name: string; angle: number }[] = [
  { name: "Up", angle: 0 },
  { name: "Right", angle: 90 },
  { name: "Down", angle: 180 },
  { name: "Left", angle: 270 }
];

const FONT = "Helvetica, Arial, sans-serif";
const SHIFT = EpKeyCode.LShift;

type Inset = [number, number, number, number];
type Zone = "main" | "shift";

/** The cap's inset on its base (left, top, right, bottom): even, so the cap stands in the middle */
const CAP: Inset = [9, 11, 9, 11];
const BASE: Inset = [0, 0, 0, 0];

/** A key's outline: a rounded rectangle, or ENTER's L with its lower-left notch */
function outline(w: number, h: number, notch: number | undefined, inset: Inset): JSX.Element {
  const [l, t, r, b] = inset;
  const rad = l ? 15 : 18;
  if (!notch) return <rect x={l} y={t} width={w - l - r} height={h - t - b} rx={rad} />;
  const n = notch * U;
  const x1 = w - r;
  const y1 = h - b;
  const mid = U - GAP - b;
  return (
    <path
      d={`M ${l + rad} ${t} H ${x1 - rad} Q ${x1} ${t} ${x1} ${t + rad} V ${y1 - rad} Q ${x1} ${y1} ${x1 - rad} ${y1}
          H ${n + l + rad} Q ${n + l} ${y1} ${n + l} ${y1 - rad} V ${mid + rad} Q ${n + l} ${mid} ${n + l - rad} ${mid}
          H ${l + rad} Q ${l} ${mid} ${l} ${mid - rad} V ${t + rad} Q ${l} ${t} ${l + rad} ${t} Z`}
    />
  );
}

/** ERASE's left-pointing ⌫ and DEL's right-pointing ⌦; (x, y) is the icon's left end and centre line */
function keyIcon(kind: "erase" | "del", x: number, y: number, ink: string): JSX.Element {
  const d =
    kind === "erase"
      ? `M ${x} ${y} l 8 -8 h 18 v 16 h -18 z M ${x + 12} ${y - 4} l 8 8 M ${x + 20} ${y - 4} l -8 8`
      : `M ${x + 26} ${y} l -8 -8 h -18 v 16 h 18 z M ${x + 6} ${y - 4} l 8 8 M ${x + 14} ${y - 4} l -8 8`;
  return <path d={d} fill="none" stroke={ink} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />;
}

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const EpKeyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, EP_KEYBOARD_WIDTH, EP_KEYBOARD_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);
  const [hover, setHover] = useState<string | undefined>();

  const color = (token: string) => theme.getThemeProperty(token);
  const caseColor = color("--bgcolor-keyboardep");
  const well = color("--bgcolor-keyboardep-well");
  const faces: Record<EpKeyKind, { face: string; edge: string; pressed: string }> = {
    char: { face: color("--bgcolor-keyep"), edge: color("--color-keyep-edge"), pressed: color("--bgcolor-hilitedep") },
    control: { face: color("--bgcolor-keyep-fn"), edge: color("--color-keyep-fn-edge"), pressed: color("--bgcolor-hilitedep-fn") },
    function: { face: color("--bgcolor-keyep-f"), edge: color("--color-keyep-f-edge"), pressed: color("--bgcolor-hilitedep-f") },
    stop: { face: color("--bgcolor-keyep-stop"), edge: color("--color-keyep-stop-edge"), pressed: color("--bgcolor-hilitedep-stop") }
  };
  const ink = color("--color-keyep-main");
  const highlight = color("--color-keyep-highlight");
  const strip = color("--bgcolor-keyep-strip");
  const stripRule = color("--color-keyep-strip-rule");
  const stripInk = color("--color-keyep-strip");
  const knob = color("--bgcolor-keyep-knob");

  const machine = () => machineService.getMachineController()?.machine;
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  /** Key units to drawing units: x from the left margin, y from the function row's top */
  const X = (u: number) => (MARGIN + u) * U;
  const Y = (u: number) => (MARGIN + STRIP + u) * U;

  /** Mouse handlers of a zone that presses `code` */
  const zoneProps = (id: string, code: number, zone: Zone) => ({
    "data-zone": zone,
    style: { cursor: "pointer" },
    onMouseEnter: () => setHover(`${id}:${zone}`),
    onMouseLeave: () => setHover(undefined),
    onMouseDown: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: true }),
    onMouseUp: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: false })
  });

  const keys = EP_KEYS.map((def) => {
    const kind = def.kind ?? "char";
    const w = (def.w ?? 1) * U - GAP;
    const h = (def.h ?? 1) * U - GAP;
    const code = EpKeyCode[def.name];
    const id = `${def.name}-${def.x}`;
    const down = code !== undefined && isPressed(code);
    const hot = (z: Zone) => hover === `${id}:${z}`;
    const { face, edge, pressed } = faces[kind];
    const legend = (z: Zone) => (hot(z) ? highlight : ink);
    let label: JSX.Element | null = null;
    if (kind === "function") {
      label = (
        <text x={20} y={56} fontSize={25} fill={legend("main")}>
          {def.main}
        </text>
      );
    } else if (kind !== "char") {
      label = (
        <>
          {def.icon === "erase" && keyIcon("erase", 18, 36, legend("main"))}
          <text x={def.icon === "erase" ? 54 : 20} y={42} fontSize={18} letterSpacing={0.6} fill={legend("main")}>
            {def.main}
          </text>
          {def.icon === "del" && keyIcon("del", 70, 36, legend("main"))}
        </>
      );
    } else if (def.main) {
      label = (
        <text x={24} y={def.shifted ? 72 : 56} fontSize={def.shifted ? 27 : 29} fill={legend("main")}>
          {def.main}
        </text>
      );
    }
    return (
      <g key={id} transform={`translate(${(X(def.x) + GAP / 2).toFixed(1)} ${(Y(def.y) + GAP / 2).toFixed(1)})`} data-ep-key={def.name}>
        <g {...zoneProps(id, code, "main")}>
          <g fill={edge}>{outline(w, h, def.notch, BASE)}</g>
          <g fill={down ? pressed : face}>{outline(w, h, def.notch, CAP)}</g>
          {label}
        </g>
        {def.shifted && (
          <g {...zoneProps(id, code, "shift")}>
            <rect x={14} y={14} width={40} height={34} fill="transparent" />
            <text x={24} y={42} fontSize={25} fill={legend("shift")}>
              {def.shifted}
            </text>
          </g>
        )}
      </g>
    );
  });

  // --- The label strip above the function keys: two printed lines per key
  const sx = X(FKEY_X) - 2;
  const sy = MARGIN * U + 4;
  const sw = 8 * FKEY_W * U;
  const sh = STRIP * U - 22;
  const labels = (
    <g data-ep-strip="">
      <rect x={sx} y={sy} width={sw} height={sh} rx={6} fill={strip} />
      <line x1={sx} y1={sy + sh / 2} x2={sx + sw} y2={sy + sh / 2} stroke={stripRule} strokeWidth={2} />
      {EP_STRIP_LABELS.map(([top, bottom], i) => {
        const left = X(FKEY_X + i * FKEY_W);
        const cx = left + (FKEY_W * U) / 2;
        return (
          <g key={i} fontSize={19} fontWeight={700} letterSpacing={0.4} fill={stripInk} textAnchor="middle">
            {i > 0 && <line x1={left} y1={sy} x2={left} y2={sy + sh} stroke={stripRule} strokeWidth={2} />}
            <text x={cx} y={sy + sh / 2 - 8}>
              {top}
            </text>
            <text x={cx} y={sy + sh - 8}>
              {bottom}
            </text>
          </g>
        );
      })}
    </g>
  );

  // --- The recesses the keys sit in
  const wellRect = (x0: number, y0: number, x1: number, y1: number) => (
    <rect key={`${x0}-${y0}`} x={X(x0) - 8} y={Y(y0) - 8} width={(x1 - x0) * U + 10} height={(y1 - y0) * U + 10} rx={14} fill={well} />
  );
  const wells = [
    wellRect(FKEY_X, 0, FKEY_X + 8 * FKEY_W, 1),
    wellRect(14.9, 0, 17.3, 1),
    wellRect(0, 1, 17.3, 2),
    wellRect(0, 2, 15, 5),
    wellRect(2.5, 5, 11.5, 6)
  ];

  // --- The joystick: rings on the case, four direction zones, and the knob, which is SPACE
  const cx = X(JOY_X);
  const cy = Y(JOY_Y);
  const jr = JOY_R * U;
  const joystick = (
    <g data-ep-joystick="">
      <circle cx={cx} cy={cy} r={jr + 10} fill={well} />
      {[0.88, 0.7, 0.52].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={jr * f} fill="none" stroke={knob} strokeWidth={9} />
      ))}
      {EP_JOYSTICK.map(({ name, angle }) => {
        const code = EpKeyCode[name];
        const id = `joy-${name}`;
        const lit = isPressed(code) || hover === `${id}:main`;
        return (
          <g key={name} transform={`rotate(${angle} ${cx} ${cy})`} data-ep-key={name} {...zoneProps(id, code, "main")}>
            <rect x={cx - 32} y={cy - jr + 2} width={64} height={50} fill="transparent" />
            <path d={`M ${cx} ${cy - jr + 6} l 15 20 h -30 z`} fill={lit ? highlight : ink} opacity={lit ? 1 : 0.7} />
          </g>
        );
      })}
      <g data-ep-key="Space" {...zoneProps("joy-fire", EpKeyCode.Space, "main")}>
        <circle
          cx={cx}
          cy={cy}
          r={26}
          fill={isPressed(EpKeyCode.Space) ? faces.char.pressed : knob}
          stroke={hover === "joy-fire:main" ? highlight : faces.char.edge}
          strokeWidth={5}
        />
      </g>
    </g>
  );

  const VW = EP_KEYBOARD_WIDTH;
  const VH = EP_KEYBOARD_HEIGHT;
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
        <rect width="100%" height="100%" rx={40} fill={caseColor} />
        {wells}
        {labels}
        {keys}
        {joystick}
      </svg>
    </Column>
  );

  /** A click on a zone: the cap holds the key (and SHIFT on the right button), the shifted legend holds SHIFT with it */
  function handleClick(e: KeyboardButtonClickArgs): void {
    const m = machine();
    if (!m || m.getKeyQueueLength() > 0) return;
    const setKeys = (down: boolean, ...codes: number[]) => codes.forEach((c) => m.setKeyStatus(c, down));
    const isShift = e.code === EpKeyCode.LShift || e.code === EpKeyCode.RShift;
    if (e.keyCategory === "shift") setKeys(e.down, e.code, SHIFT);
    else if (isShift || e.button === 0) setKeys(e.down, e.code);
    else setKeys(e.down, e.code, SHIFT);
  }
};
