import { useState } from "react";
import { Column, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";
import { TvcKeyCode } from "@emu/machines/tvc/TvcKeyCode";

/*
 * The Videoton TVC virtual keyboard (`.plans/VIDEOTON_TVC_PLAN.md` §8), drawn from a photo of a TVC
 * 64K (https://frescho.hu/wp-content/gallery/tvc-adatlap/IMG_2349.JPG): five rows stepped to the
 * right towards the back, cream keys with the shifted legend above the plain one, dark grey function
 * keys, and the built-in joystick to the right. One SVG holds it all, because the rows are not a
 * grid of equal keys.
 *
 * Zones: the key face presses the key (the right button adds SHIFT); the printed shifted legend
 * presses SHIFT with the key. The joystick's four directions are the cursor keys of matrix row 8 and
 * its knob is FIRE (Tab), which is what BASIC's `JOY` reads; the arrows on it are Klive's, the
 * machine printed none.
 */

/** One key unit in the drawing */
const U = 100;
const MARGIN = 0.4;
/** The joystick's centre and the radius of its base, in key units */
const JOY_X = 20.1;
const JOY_Y = 1.75;
const JOY_R = 1.2;
/** The whole keyboard in drawing units */
export const TVC_KEYBOARD_WIDTH = (JOY_X + JOY_R + MARGIN * 2) * U;
export const TVC_KEYBOARD_HEIGHT = (5 + MARGIN * 2) * U;

/** One key: its matrix code name, printed legends, x (key units) and width when not on the row's pitch */
type KeyDef = { name: string; main: string; shifted?: string; x?: number; w?: number; fn?: boolean };
type RowDef = { x: number; keys: KeyDef[] };

const k = (name: string, main: string, shifted?: string): KeyDef => ({ name, main, shifted });
const fn = (name: string, main: string, x?: number, w?: number): KeyDef => ({ name, main, x, w, fn: true });

/** The rows from the back, as on the photo; a row's keys follow each other from its `x` */
export const TVC_KEY_ROWS: RowDef[] = [
  {
    x: 0,
    keys: [
      k("IAcute", "Í"),
      k("N0", "0", "&"),
      k("N1", "1", "'"),
      k("N2", "2", '"'),
      k("N3", "3", "+"),
      k("N4", "4", "!"),
      k("N5", "5", "%"),
      k("N6", "6", "/"),
      k("N7", "7", "="),
      k("N8", "8", "("),
      k("N9", "9", ")"),
      k("OUml", "Ö"),
      k("UUml", "Ü"),
      k("OAcute", "Ó"),
      k("Asterisk", "*", "#"),
      k("Caret", "^", "~"),
      fn("Ins", "INS"),
      fn("Esc", "ESC")
    ]
  },
  {
    x: 0.5,
    keys: [
      k("At", "@", "`"),
      k("Semicolon", ";", "$"),
      ..."QWERTZUIOP".split("").map((c) => k(c, c)),
      k("ODblAcute", "Ő"),
      k("UAcute", "Ú"),
      k("LBracket", "[", "{"),
      k("RBracket", "]", "}"),
      fn("Del", "DEL")
    ]
  },
  {
    x: 0.75,
    keys: [
      k("Less", "<", ">"),
      k("Backslash", "\\", "|"),
      ..."ASDFGHJKL".split("").map((c) => k(c, c)),
      k("EAcute", "É"),
      k("AAcute", "Á"),
      k("UDblAcute", "Ű"),
      fn("Return", "RETURN", undefined, 1.75)
    ]
  },
  {
    x: 1,
    keys: [
      fn("Lock", "LOCK"),
      fn("Shift", "SHIFT", undefined, 1.5),
      ..."YXCVBNM".split("").map((c) => k(c, c)),
      k("Comma", ",", "?"),
      k("Period", ".", ":"),
      k("Minus", "-", "_"),
      fn("Shift", "SHIFT", undefined, 1.75)
    ]
  },
  {
    x: 3.25,
    keys: [fn("Ctrl", "CTRL", undefined, 1.5), { name: "Space", main: "", w: 8 }, fn("Alt", "ALT", undefined, 1.5)]
  }
];

/** The joystick: a direction's key and the arrow's angle (0 = up, clockwise) */
export const TVC_JOYSTICK: { name: string; angle: number }[] = [
  { name: "Up", angle: 0 },
  { name: "Right", angle: 90 },
  { name: "Down", angle: 180 },
  { name: "Left", angle: 270 }
];

const FONT = "Helvetica, Arial, sans-serif";
const SHIFT = TvcKeyCode.Shift;

type Zone = "main" | "shift";

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const TvcKeyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, TVC_KEYBOARD_WIDTH, TVC_KEYBOARD_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);
  const [hover, setHover] = useState<string | undefined>();

  const color = (token: string) => theme.getThemeProperty(token);
  const caseColor = color("--bgcolor-keyboardtvc");
  const well = color("--bgcolor-keyboardtvc-well");
  const keyFace = color("--bgcolor-keytvc");
  const keyEdge = color("--color-keytvc-edge");
  const fnFace = color("--bgcolor-keytvc-fn");
  const fnEdge = color("--color-keytvc-fn-edge");
  const ink = color("--color-keytvc-main");
  const fnInk = color("--color-keytvc-fn");
  const highlight = color("--color-keytvc-highlight");
  const fnHighlight = color("--color-keytvc-fn-highlight");
  const knob = color("--bgcolor-keytvc-knob");
  const pressedFace = color("--bgcolor-hilitedtvc");
  const pressedFn = color("--bgcolor-hilitedtvc-fn");

  const machine = () => machineService.getMachineController()?.machine;
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const ox = MARGIN * U;
  const oy = MARGIN * U;

  /** Mouse handlers of a zone that presses `code` */
  const zoneProps = (id: string, code: number, zone: Zone) => ({
    "data-zone": zone,
    style: { cursor: "pointer" },
    onMouseEnter: () => setHover(`${id}:${zone}`),
    onMouseLeave: () => setHover(undefined),
    onMouseDown: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: true }),
    onMouseUp: (e: React.MouseEvent) => handleClick({ code, keyCategory: zone, button: e.button, down: false })
  });

  // --- The recess the keys sit in: one band per row, so its outline steps as the rows do
  const wells: JSX.Element[] = [];
  const keys: JSX.Element[] = [];
  TVC_KEY_ROWS.forEach((row, r) => {
    let next = row.x;
    const first = row.x;
    for (const def of row.keys) {
      const x = def.x ?? next;
      const w = def.w ?? 1;
      next = x + w;
      const code = TvcKeyCode[def.name];
      const id = `${def.name}-${x}`;
      const W = w * U - 6;
      const H = U - 6;
      const down = code !== undefined && isPressed(code);
      const hot = (z: Zone) => hover === `${id}:${z}`;
      const face = down ? (def.fn ? pressedFn : pressedFace) : def.fn ? fnFace : keyFace;
      const legend = (z: Zone) => (hot(z) ? (def.fn ? fnHighlight : highlight) : def.fn ? fnInk : ink);
      keys.push(
        <g
          key={id}
          transform={`translate(${(ox + x * U + 3).toFixed(1)} ${(oy + r * U + 3).toFixed(1)})`}
          data-tvc-key={def.name}
        >
          <g {...zoneProps(id, code, "main")}>
            <rect rx={9} width={W} height={H} fill={def.fn ? fnEdge : keyEdge} />
            <rect x={7} y={4} rx={7} width={W - 14} height={H - 16} fill={face} />
            {def.fn ? (
              <text x={W / 2} y={H / 2 + 3} fontSize={20} fill={legend("main")} textAnchor="middle" fontWeight={700}>
                {def.main}
              </text>
            ) : (
              def.main && (
                <text
                  x={W / 2}
                  y={def.shifted ? H - 24 : H / 2 + 8}
                  fontSize={def.shifted ? 28 : 34}
                  fill={legend("main")}
                  textAnchor="middle"
                >
                  {def.main}
                </text>
              )
            )}
          </g>
          {def.shifted && (
            <g {...zoneProps(id, code, "shift")}>
              <rect x={W / 2 - 24} y={6} width={48} height={36} fill="transparent" />
              <text x={W / 2} y={34} fontSize={26} fill={legend("shift")} textAnchor="middle">
                {def.shifted}
              </text>
            </g>
          )}
        </g>
      );
    }
    wells.push(
      <rect
        key={`well-${r}`}
        x={ox + first * U - 4}
        y={oy + r * U - 4}
        width={(next - first) * U + 8}
        height={U + 8}
        fill={well}
      />
    );
  });

  // --- The joystick: a base with four direction zones and the knob, which is FIRE
  const cx = ox + JOY_X * U;
  const cy = oy + JOY_Y * U;
  const joystick = (
    <g data-tvc-joystick="">
      <circle cx={cx} cy={cy} r={JOY_R * U} fill={well} />
      <circle cx={cx} cy={cy} r={JOY_R * U - 10} fill={fnFace} stroke={fnEdge} strokeWidth={4} />
      {TVC_JOYSTICK.map(({ name, angle }) => {
        const code = TvcKeyCode[name];
        const id = `joy-${name}`;
        const lit = isPressed(code) || hover === `${id}:main`;
        return (
          <g key={name} transform={`rotate(${angle} ${cx} ${cy})`} data-tvc-key={name} {...zoneProps(id, code, "main")}>
            <rect x={cx - 34} y={cy - JOY_R * U + 14} width={68} height={64} fill="transparent" />
            <path
              d={`M ${cx} ${cy - JOY_R * U + 22} l 22 28 h -44 z`}
              fill={lit ? fnHighlight : fnInk}
              opacity={lit ? 1 : 0.75}
            />
          </g>
        );
      })}
      <g data-tvc-key="Tab" {...zoneProps("joy-fire", TvcKeyCode.Tab, "main")}>
        <circle
          cx={cx}
          cy={cy}
          r={38}
          fill={isPressed(TvcKeyCode.Tab) ? pressedFn : knob}
          stroke={hover === "joy-fire:main" ? fnHighlight : fnEdge}
          strokeWidth={5}
        />
      </g>
    </g>
  );

  const VW = TVC_KEYBOARD_WIDTH;
  const VH = TVC_KEYBOARD_HEIGHT;
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
        <rect width="100%" height="100%" rx={14} fill={caseColor} />
        {wells}
        {keys}
        {joystick}
      </svg>
    </Column>
  );

  /** A click on a zone: the face holds the key (and SHIFT on the right button), the shifted legend holds SHIFT with it */
  function handleClick(e: KeyboardButtonClickArgs): void {
    const m = machine();
    if (!m || m.getKeyQueueLength() > 0) return;
    const setKeys = (down: boolean, ...codes: number[]) => codes.forEach((c) => m.setKeyStatus(c, down));
    if (e.keyCategory === "shift") setKeys(e.down, e.code, SHIFT);
    else if (e.code === SHIFT || e.button === 0) setKeys(e.down, e.code);
    else setKeys(e.down, e.code, SHIFT);
  }
};
