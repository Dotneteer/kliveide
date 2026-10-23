import { useState } from "react";
import { Column, KeyboardButtonClickArgs, calculateKeyboardZoom, keyboardRootStyle } from "./keyboard-common";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { useKeyboard } from "./useKeyboard";
import { Ht1080zKeyCode } from "@emu/machines/ht1080z/Ht1080zKeyCode";
import type { Ht1080zRomSetId } from "@emu/machines/ht1080z/Ht1080zRoms";
import { HT_VIDEO_PAGE } from "@emu/machines/machine-props";

/*
 * The HT-1080Z virtual keyboard (`.plans/HT1080Z_PLAN.md` §7), built to the approved mockup
 * `.plans/ht1080z/ht1080z-keyboard-mockup.html`: geometry measured from the user manual's keyboard
 * drawing (§4.1, p. 8), colours sampled from a photo of a Series I/II machine. One SVG holds the whole
 * keyboard, because its rows are not a grid of equal keys.
 *
 * Zones: the key face presses the key (the right button adds SHIFT); the printed shifted legend presses
 * SHIFT with the key; the Hungarian hint - Klive's, not printed on the machine - types its character
 * through the machine's typer (`Ht1080zTyper.ts`: left button the first, right button the second),
 * which needs the extension ROM on. PAGE and F1 latch: PAGE selects the 32-column page, F1 holds
 * the recorder's motor on.
 */

/** The drawing's pixels (2000 px wide) to key units: a key is 68 px there and 100 units here */
const PX = 100 / 68;
const ORIGIN_X = 660;
const ORIGIN_Y = 820;
/** The whole keyboard in key units */
export const HT1080Z_KEYBOARD_WIDTH = (1732 - ORIGIN_X) * PX;
export const HT1080Z_KEYBOARD_HEIGHT = (1244 - ORIGIN_Y) * PX;

/** One key: its matrix code name, printed legends, and an explicit x and width when not on the row's pitch */
type KeyDef = { name: string; main: string; shifted?: string; x?: number; w?: number; kind?: "switch" };
type RowDef = { y: number; h: number; x: number; pitch: number; keys: KeyDef[] };

const k = (name: string, main: string, shifted?: string, x?: number, w?: number, kind?: "switch"): KeyDef => ({
  name,
  main,
  shifted,
  x,
  w,
  kind
});

/** The mockup's `ROWS`, in the drawing's pixels */
export const HT1080Z_KEY_ROWS: RowDef[] = [
  {
    y: 892,
    h: 66,
    x: 688,
    pitch: 70.83,
    keys: [
      k("N1", "1", "!"),
      k("N2", "2", '"'),
      k("N3", "3", "#"),
      k("N4", "4", "$"),
      k("N5", "5", "%"),
      k("N6", "6", "&"),
      k("N7", "7", "'"),
      k("N8", "8", "("),
      k("N9", "9", ")"),
      k("N0", "0"),
      k("Colon", ":", "*"),
      k("Minus", "−", "="),
      k("Break", "BREAK", undefined, 1538, 92),
      k("Clear", "CLEAR", undefined, 1630, 88)
    ]
  },
  {
    y: 958,
    h: 70,
    x: 690,
    pitch: 68,
    keys: [
      k("Up", "↑"),
      ..."QWERTYUIOP".split("").map((c) => k(c, c)),
      k("At", "@", "\\"),
      k("Left", "←"),
      k("Right", "→")
    ]
  },
  {
    y: 1028,
    h: 68,
    x: 708,
    pitch: 67.9,
    keys: [k("Down", "↓"), ..."ASDFGHJKL".split("").map((c) => k(c, c)), k("Semicolon", ";", "+"), k("Enter", "NEW LINE", undefined, 1455, 165)]
  },
  {
    y: 1096,
    h: 68,
    x: 808,
    pitch: 68.2,
    keys: [
      k("Shift", "SHIFT", undefined, 672, 136),
      ..."ZXCVBNM".split("").map((c) => k(c, c)),
      k("Comma", ",", "<"),
      k("Period", ".", ">"),
      k("Slash", "/", "?"),
      k("Shift", "SHIFT", undefined, 1490, 130)
    ]
  },
  { y: 1164, h: 66, x: 845, pitch: 0, keys: [k("Space", "", undefined, 845, 612)] },
  {
    y: 832,
    h: 38,
    x: 1470,
    pitch: 0,
    keys: [k("Page", "PAGE", undefined, 1470, 75, "switch"), k("F1", "F1", undefined, 1545, 73, "switch")]
  }
];

/** Klive's Hungarian hints per model: the key, then the characters its hint types (plain, SHIFT) */
export const HT1080Z_HINTS: Record<Ht1080zRomSetId, Record<string, [string, string]>> = {
  s1: {},
  s2: { A: ["Á", "á"], E: ["É", "é"], U: ["Ü", "ü"], O: ["Ö", "ö"] },
  s64: {
    A: ["Á", "á"],
    E: ["É", "é"],
    I: ["Í", "í"],
    O: ["Ó", "ó"],
    U: ["Ú", "ú"],
    N3: ["Ö", "ö"],
    N4: ["Ő", "ő"],
    N5: ["Ü", "ü"],
    N6: ["Ű", "ű"],
    N7: ["Ω", "ω"],
    N8: ["∞", "α"],
    N9: ["■", "√"],
    B: ["Ψ", "β"],
    G: ["π", "γ"],
    M: ["λ", "μ"],
    S: ["Σ", "∫"]
  }
};

const FONT = "Helvetica, Arial, sans-serif";
const SHIFT = Ht1080zKeyCode.Shift;

type Zone = "main" | "shift" | "hint";

type Props = {
  width: number;
  height: number;
  romSet?: Ht1080zRomSetId;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Ht1080zKeyboard = ({ width, height, romSet = "s2", apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const theme = useTheme();
  const zoom = calculateKeyboardZoom(width, height, HT1080Z_KEYBOARD_WIDTH, HT1080Z_KEYBOARD_HEIGHT);
  const { isPressed } = useKeyboard(apiLoaded);
  const [hover, setHover] = useState<string | undefined>();
  const [, setPageVersion] = useState(0);

  const color = (token: string) => theme.getThemeProperty(token);
  const caseColor = color("--bgcolor-keyboardht1080z");
  const panel = color("--bgcolor-keyboardht1080z-panel");
  const keyFace = color("--bgcolor-keyht1080z");
  const keyEdge = color("--color-keyht1080z-edge");
  const switchFace = color("--bgcolor-keyht1080z-switch");
  const switchEdge = color("--color-keyht1080z-switch-edge");
  const ink = color("--color-keyht1080z-main");
  const hint = color("--color-keyht1080z-hint");
  const highlight = color("--color-keyht1080z-highlight");
  const pressedFace = color("--bgcolor-hilitedht1080z");

  const machine = () => machineService.getMachineController()?.machine;
  const pageLatched = !!machine()?.getMachineProperty?.(HT_VIDEO_PAGE);
  const motorLatched = !!(machine() as unknown as { isMotorOverride?: boolean } | undefined)?.isMotorOverride;
  const hints = HT1080Z_HINTS[romSet] ?? {};
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;

  const keys: JSX.Element[] = [];
  for (const row of HT1080Z_KEY_ROWS) {
    let next = row.x;
    for (const def of row.keys) {
      const x = def.x ?? next;
      const w = def.w ?? row.pitch;
      next = x + w;
      const code = Ht1080zKeyCode[def.name];
      const id = `${def.name}-${x}`;
      const W = w * PX - 8;
      const H = row.h * PX - 8;
      const isSwitch = def.kind === "switch";
      const down =
        def.name === "Page" ? pageLatched : def.name === "F1" ? motorLatched : code !== undefined && isPressed(code);
      const hot = (z: Zone) => hover === `${id}:${z}`;
      const zone = (z: Zone) => ({
        "data-zone": z,
        style: { cursor: "pointer" },
        onMouseEnter: () => setHover(`${id}:${z}`),
        onMouseLeave: () => setHover(undefined),
        onMouseDown: (e: React.MouseEvent) => handleClick({ code, keyCategory: z, button: e.button, down: true }, def.name),
        onMouseUp: (e: React.MouseEvent) => handleClick({ code, keyCategory: z, button: e.button, down: false }, def.name)
      });
      const legend = (z: Zone) => (hot(z) ? highlight : ink);
      const words = def.main.length > 2;
      const parts = def.main.split(" ");
      const accent = hints[def.name];
      keys.push(
        <g
          key={id}
          transform={`translate(${((x - ORIGIN_X) * PX + 4).toFixed(1)} ${((row.y - ORIGIN_Y) * PX + 4).toFixed(1)})`}
          data-ht1080z-key={def.name}
        >
          <g {...zone("main")}>
            <rect
              rx={7}
              width={W}
              height={H}
              fill={down ? pressedFace : isSwitch ? switchFace : keyFace}
              stroke={isSwitch ? switchEdge : keyEdge}
              strokeWidth={1.5}
            />
            {words || isSwitch
              ? parts.map((p, i) => (
                  <text
                    key={i}
                    x={W / 2}
                    y={H / 2 + 8 + (i - (parts.length - 1) / 2) * 24}
                    fontSize={isSwitch ? 22 : 21}
                    fill={legend("main")}
                    textAnchor="middle"
                    fontWeight={700}
                  >
                    {p}
                  </text>
                ))
              : def.main && (
                  <text
                    x={W / 2}
                    y={def.shifted ? H - 16 : H / 2 + 14}
                    fontSize={def.shifted ? 34 : 40}
                    fill={legend("main")}
                    textAnchor="middle"
                    fontWeight={600}
                  >
                    {def.main}
                  </text>
                )}
          </g>
          {def.shifted && (
            <g {...zone("shift")}>
              <rect x={W / 2 - 26} y={2} width={52} height={42} fill="transparent" />
              <text x={W / 2} y={38} fontSize={30} fill={legend("shift")} textAnchor="middle" fontWeight={600}>
                {def.shifted}
              </text>
            </g>
          )}
          {accent && (
            <g {...zone("hint")}>
              <rect x={W - 46} y={H - 34} width={44} height={32} fill="transparent" />
              <text x={W - 6} y={H - 8} fontSize={21} fill={hot("hint") ? highlight : hint} textAnchor="end" fontWeight={700}>
                {accent[0] + accent[1]}
              </text>
            </g>
          )}
        </g>
      );
    }
  }

  const VW = HT1080Z_KEYBOARD_WIDTH;
  const VH = HT1080Z_KEYBOARD_HEIGHT;
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
        <rect width="100%" height="100%" rx={10} fill={caseColor} />
        <rect x={6} y={6} width={VW - 12} height={VH - 12} rx={8} fill={panel} />
        {keys}
      </svg>
    </Column>
  );

  /**
   * A click on a zone: the key face holds the key (and SHIFT on the right button), the shifted legend
   * holds SHIFT with the key, a hint types its character, PAGE flips its latch on the press.
   */
  function handleClick(e: KeyboardButtonClickArgs, name: string): void {
    const m = machine();
    if (!m || m.getKeyQueueLength() > 0) return;
    const setKeys = (down: boolean, ...codes: number[]) => codes.forEach((c) => m.setKeyStatus(c, down));
    switch (e.keyCategory) {
      case "main":
        if (e.code === SHIFT || e.button === 0) setKeys(e.down, e.code);
        else setKeys(e.down, e.code, SHIFT);
        if (name === "Page" || name === "F1") setPageVersion((v) => v + 1);
        break;
      case "shift":
        setKeys(e.down, e.code, SHIFT);
        break;
      case "hint": {
        const chars = hints[name];
        const typer = m as unknown as { typeText?: (text: string) => void };
        if (e.down && chars && typeof typer.typeText === "function") typer.typeText(chars[e.button === 2 ? 1 : 0]);
        break;
      }
    }
  }
};
