import { memo, useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardButtonClickArgs } from "./keyboard-common";
import { ZX81_KEY_HEIGHT, ZX81_KEY_WIDTH } from "./Zx81Key";

/*
 * One key of the ZX80 keyboard (`.plans/ZX8081_WASM_PLAN.md` §8.1.9). The key face is the ZX81's
 * (100 x 74.7 key units); the legends follow a photo of an original 4K-ROM ZX80 and the ROM's own key
 * tables. Unlike the ZX81, nothing is printed under a key: the amber shifted legend of a number key
 * and the white keyword of a letter key both sit in the band above it, so the cell is the band (24)
 * plus the face plus the gap to the next row.
 */

/** The cell around a face: one row pitch high, the face at y = 24 */
export const ZX80_CELL_HEIGHT = 114;
const FACE_Y = 24;

/** The legends of a key */
export type Zx80KeyDef = {
  /** Klive key code: `line * 5 + bit` */
  c: number;
  /** The main legend (white, on the key) */
  m?: string;
  /** The amber shifted legend on the key face (a symbol, or OR) */
  s?: string;
  /** The amber shifted legend printed above the key (NOT, AND, HOME, RUBOUT, EDIT) */
  sa?: string;
  /** An outlined amber cursor arrow above the key instead of `sa` */
  arrow?: "l" | "r" | "u" | "d";
  /** The white keyword printed above the key (K mode) */
  k?: string;
  /** The dark print above SPACE (BREAK) */
  dim?: string;
  /** The block graphic's ZX80 character code ($02-$0B), typed with SHIFT */
  g?: number;
  shift?: boolean;
  nl?: boolean;
  space?: boolean;
};

/**
 * Quadrants TL, TR, BL, BR of the ZX80 block graphics $02-$0B (i = ink, p = paper, g = chequer), read
 * from the 4K ROM's character set at $0E00.
 */
const GLYPHS: Record<number, string> = {
  2: "ipip",
  3: "ppii",
  4: "ippp",
  5: "pipp",
  6: "ppip",
  7: "pppi",
  8: "piip",
  9: "gggg",
  10: "ppgg",
  11: "ggpp"
};

/** The quadrants of a ZX80 graphic code */
export function zx80GlyphCells(code: number): string[] {
  return GLYPHS[code].split("");
}

/** The outlined arrows (the ZX81's polygons), in a 36 x 20 box */
const ARROWS = {
  l: "0,9 11,0 11,5 36,5 36,13 11,13 11,18",
  r: "36,9 25,0 25,5 0,5 0,13 25,13 25,18",
  d: "18,20 4,8 12,8 12,0 24,0 24,8 32,8",
  u: "18,0 4,12 12,12 12,20 24,20 24,12 32,12"
};

const FONT = "Helvetica, Arial, sans-serif";

type Zone = "main" | "shift";

type Props = {
  zoom: number;
  def: Zx80KeyDef;
  pressed?: boolean;
  keyAction?: (e: KeyboardButtonClickArgs) => void;
};

export const Zx80Key = memo(({ zoom, def, pressed, keyAction }: Props) => {
  const [hover, setHover] = useState<Zone | undefined>();
  const theme = useTheme();
  const keyFace = theme.getThemeProperty("--bgcolor-keyzx80");
  const ink = theme.getThemeProperty("--color-keyzx80-main");
  const amber = theme.getThemeProperty("--color-keyzx80-shift");
  const legend = theme.getThemeProperty("--color-keyzx80-legend");
  const dim = theme.getThemeProperty("--color-keyzx80-dim");
  const highlight = theme.getThemeProperty("--color-keyzx80-highlight");
  const pressedFace = theme.getThemeProperty("--bgcolor-hilitedzx80");

  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const d = def;
  const patternId = `zx80-chk-${d.c}`;

  // --- A zone's events: hover, and the press/release the keyboard turns into keystrokes
  const zone = (z: Zone) => ({
    "data-zone": z,
    style: { cursor: "pointer" },
    onMouseEnter: () => setHover(z),
    onMouseLeave: () => setHover(undefined),
    onMouseDown: (e: React.MouseEvent) => keyAction?.({ code: d.c, keyCategory: z, button: e.button, down: true }),
    onMouseUp: (e: React.MouseEvent) => keyAction?.({ code: d.c, keyCategory: z, button: e.button, down: false })
  });

  const mainColor = hover === "main" ? highlight : ink;
  const amberColor = hover === "shift" ? highlight : amber;
  const isDigit = d.m !== undefined && /^[0-9]$/.test(d.m);

  // --- The main legend: a centred digit, a letter at the left, the dot, or the SHIFT / NEW LINE /
  // --- SPACE words
  let mainLegend: JSX.Element;
  if (d.shift) {
    mainLegend = (
      <text x={50} y={44} fontSize={17} fill={hover === "main" ? highlight : amber} textAnchor="middle">
        SHIFT
      </text>
    );
  } else if (d.nl) {
    mainLegend = (
      <>
        <text x={50} y={34} fontSize={16} fill={mainColor} textAnchor="middle">
          NEW
        </text>
        <text x={50} y={52} fontSize={16} fill={mainColor} textAnchor="middle">
          LINE
        </text>
      </>
    );
  } else if (d.space) {
    mainLegend = (
      <text x={50} y={56} fontSize={17} fill={mainColor} textAnchor="middle">
        SPACE
      </text>
    );
  } else if (d.m === ".") {
    mainLegend = <circle cx={32} cy={50} r={4} fill={mainColor} />;
  } else if (isDigit) {
    mainLegend = (
      <text x={50} y={50} fontSize={30} fill={mainColor} textAnchor="middle">
        {d.m}
      </text>
    );
  } else {
    mainLegend = (
      <text x={15} y={60} fontSize={30} fill={mainColor}>
        {d.m}
      </text>
    );
  }

  // --- The amber legend on the face: a symbol (or OR) at the top right, or the block graphic
  let faceShift: JSX.Element | undefined;
  if (d.g !== undefined) {
    const q = 13;
    const [gx, gy] = [62, 10];
    const cells = zx80GlyphCells(d.g);
    faceShift = (
      <g {...zone("shift")}>
        {cells.map((v, i) => (
          <rect
            key={i}
            x={gx + (i % 2) * q}
            y={gy + Math.floor(i / 2) * q}
            width={q}
            height={q}
            fill={v === "i" ? amberColor : v === "p" ? keyFace : `url(#${patternId})`}
          />
        ))}
        <rect
          x={gx}
          y={gy}
          width={2 * q}
          height={2 * q}
          fill="none"
          stroke={amberColor}
          strokeWidth={hover === "shift" ? 3 : 2}
        />
      </g>
    );
  } else if (d.s) {
    const word = d.s.length > 1 && /^[A-Z]+$/.test(d.s);
    const wide = d.space;
    faceShift = (
      <g {...zone("shift")}>
        <rect x={wide ? 55 : 45} y={2} width={wide ? 42 : 52} height={34} fill="transparent" />
        <text
          x={wide ? 76 : 88}
          y={word ? 28 : wide ? 28 : 34}
          fontSize={word ? 17 : wide ? 22 : 26}
          fill={amberColor}
          textAnchor={wide ? "middle" : "end"}
        >
          {d.s}
        </text>
      </g>
    );
  }

  // --- The band above the key: an amber shifted legend or arrow, a white keyword, or BREAK
  let above: JSX.Element | undefined;
  if (d.arrow) {
    above = (
      <g {...zone("shift")}>
        <rect x={20} y={0} width={60} height={22} fill="transparent" />
        <polygon transform="translate(32 1)" points={ARROWS[d.arrow]} fill="none" stroke={amberColor} strokeWidth={2.2} />
      </g>
    );
  } else if (d.sa) {
    above = (
      <g {...zone("shift")}>
        <rect x={0} y={0} width={ZX81_KEY_WIDTH} height={22} fill="transparent" />
        <text x={50} y={18} fontSize={15} fill={amberColor} textAnchor="middle">
          {d.sa}
        </text>
      </g>
    );
  } else if (d.k || d.dim) {
    const color = hover === "main" ? highlight : d.k ? legend : dim;
    above = (
      <g {...zone("main")}>
        <rect x={0} y={0} width={ZX81_KEY_WIDTH} height={22} fill="transparent" />
        <text x={50} y={18} fontSize={15} fill={color} textAnchor="middle">
          {d.k ?? d.dim}
        </text>
      </g>
    );
  }

  return (
    <svg
      width={ZX81_KEY_WIDTH * appliedZoom}
      height={ZX80_CELL_HEIGHT * appliedZoom}
      viewBox={`0 0 ${ZX81_KEY_WIDTH} ${ZX80_CELL_HEIGHT}`}
      fontFamily={FONT}
      style={{ marginRight: 28.1 * appliedZoom, flexShrink: 0 }}
      onContextMenu={(e) => e.preventDefault()}
      data-zx80-key={d.c}
    >
      <defs>
        <pattern id={patternId} width={3.4} height={3.4} patternUnits="userSpaceOnUse">
          <rect width={3.4} height={3.4} fill={keyFace} />
          <rect width={1.7} height={1.7} fill={amberColor} />
          <rect x={1.7} y={1.7} width={1.7} height={1.7} fill={amberColor} />
        </pattern>
      </defs>
      {above}
      <g transform={`translate(0 ${FACE_Y})`}>
        <g {...zone("main")}>
          <rect rx={8} width={ZX81_KEY_WIDTH} height={ZX81_KEY_HEIGHT} fill={pressed ? pressedFace : keyFace} />
          {mainLegend}
        </g>
        {faceShift}
      </g>
    </svg>
  );
});
