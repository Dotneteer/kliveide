import { memo, useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { KeyboardButtonClickArgs } from "./keyboard-common";

/*
 * One key of the ZX81 keyboard, built from the approved design (`.plans/ZX8081_WASM_PLAN.md` §8.1,
 * mockup `.plans/zx8081/zx81-keyboard-mockup.html`). All geometry is in key units - a key face is 100
 * wide - measured from the reference photo; the SVG cell is one row pitch high with the face at y 24,
 * so the keyword printed above the key and the function printed below it fit in the cell.
 */

/** A key face, and the cell around it: one row pitch (124.6) high, the face at y = 24 */
export const ZX81_KEY_WIDTH = 100;
export const ZX81_KEY_HEIGHT = 74.7;
export const ZX81_CELL_HEIGHT = 124.6;
const FACE_Y = 24;

/** The legends of a key (the mockup's `R` table) */
export type Zx81KeyDef = {
  /** Klive key code: `line * 5 + bit` */
  c: number;
  /** The main legend */
  m?: string;
  /** The red shifted legend; `sym` when it is a symbol rather than a word */
  s?: string;
  sym?: boolean;
  /** The keyword printed above the key (K mode) */
  k?: string;
  /** The function printed below the key (F mode) */
  f?: string;
  /** The block graphic's character code (G mode) */
  g?: number;
  /** An outlined cursor arrow instead of a shifted text legend */
  arrow?: "l" | "r" | "u" | "d";
  shift?: boolean;
  nl?: boolean;
  space?: boolean;
};

/** Quadrants TL, TR, BL, BR of the ZX81 block graphics $01-$0A: ink, paper, chequer (§8.1.4) */
const GLYPHS: Record<number, string> = {
  1: "ippp",
  2: "pipp",
  3: "iipp",
  4: "ppip",
  5: "ipip",
  6: "piip",
  7: "iiip",
  8: "gggg",
  9: "ppgg",
  10: "ggpp"
};

/** The quadrants of a graphic code; bit 7 swaps ink and paper (the chequer stays) */
export function zx81GlyphCells(code: number): string[] {
  const inverse = (code & 0x80) !== 0;
  return GLYPHS[code & 0x7f]
    .split("")
    .map((v) => (inverse ? (v === "i" ? "p" : v === "p" ? "i" : "g") : v));
}

/** The outlined arrows, in a 36 x 20 box placed at (54, 4) of the face */
const ARROWS = {
  l: "0,9 11,0 11,5 36,5 36,13 11,13 11,18",
  r: "36,9 25,0 25,5 0,5 0,13 25,13 25,18",
  d: "18,20 4,8 12,8 12,0 24,0 24,8 32,8",
  u: "18,0 4,12 12,12 12,20 24,20 24,12 32,12"
};

const FONT = "Helvetica, Arial, sans-serif";

/** The red word legends shrink with their length: 18 up to 4 letters, 16 up to 6, 11.5 beyond */
const wordSize = (s: string) => (s.length <= 4 ? 18 : s.length <= 6 ? 16 : 11.5);

type Zone = "main" | "shift" | "below" | "glyph";

type Props = {
  zoom: number;
  def: Zx81KeyDef;
  pressed?: boolean;
  keyAction?: (e: KeyboardButtonClickArgs) => void;
};

export const Zx81Key = memo(({ zoom, def, pressed, keyAction }: Props) => {
  const [hover, setHover] = useState<Zone | undefined>();
  const theme = useTheme();
  const keyFace = theme.getThemeProperty("--bgcolor-keyzx81");
  const ink = theme.getThemeProperty("--color-keyzx81-main");
  const red = theme.getThemeProperty("--color-keyzx81-shift");
  const legend = theme.getThemeProperty("--color-keyzx81-legend");
  const glyphFrame = theme.getThemeProperty("--color-keyzx81-glyphframe");
  const highlight = theme.getThemeProperty("--color-keyzx81-highlight");
  const legendHighlight = theme.getThemeProperty("--color-keyzx81-legend-highlight");
  const pressedFace = theme.getThemeProperty("--bgcolor-hilitedzx81");

  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const d = def;
  const patternId = `zx81-chk-${d.c}`;

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
  const redColor = hover === "shift" ? highlight : red;

  // --- The main legend: a big character, or the SHIFT / NEW LINE / SPACE words
  let mainLegend: JSX.Element;
  if (d.shift) {
    mainLegend = (
      <text x={50} y={47} fontSize={23} fill={hover === "main" ? highlight : red} textAnchor="middle" fontWeight={400}>
        SHIFT
      </text>
    );
  } else if (d.nl) {
    mainLegend = (
      <>
        <text x={50} y={48} fontSize={15} fill={mainColor} textAnchor="middle" fontWeight={400}>
          NEW
        </text>
        <text x={50} y={64} fontSize={15} fill={mainColor} textAnchor="middle" fontWeight={400}>
          LINE
        </text>
      </>
    );
  } else if (d.space) {
    mainLegend = (
      <text x={50} y={64} fontSize={14} fill={mainColor} textAnchor="middle" fontWeight={400}>
        SPACE
      </text>
    );
  } else {
    mainLegend = (
      <text x={10} y={64} fontSize={46} fill={mainColor} fontWeight={700}>
        {d.m}
      </text>
    );
  }

  // --- The red shifted legend, or the outlined arrow
  let shiftLegend: JSX.Element | undefined;
  if (d.arrow) {
    shiftLegend = (
      <g {...zone("shift")}>
        <rect x={48} y={2} width={46} height={26} fill="transparent" />
        <polygon transform="translate(54 4)" points={ARROWS[d.arrow]} fill="none" stroke={redColor} strokeWidth={2.2} />
      </g>
    );
  } else if (d.s) {
    let x: number, y: number, size: number, weight: number, anchor: "middle" | "end";
    let spacing: number | undefined;
    if (d.nl) {
      [x, y, size, weight, anchor] = [50, 19, 12, 400, "middle"];
    } else if (d.space) {
      [x, y, size, weight, anchor] = [50, 30, 24, 400, "middle"];
    } else if (d.sym) {
      const two = d.s.length > 1;
      weight = d.s === "**" || d.s === '""' || d.s === '"' ? 700 : 400;
      [x, y, size, anchor] = [two ? 93 : 88, two ? 27 : 33, two ? 28 : 31, "end"];
      spacing = two && weight === 400 ? 1.5 : undefined;
    } else {
      [x, y, size, weight, anchor] = [92, 21, wordSize(d.s), 400, "end"];
    }
    const wide = d.nl || d.space;
    shiftLegend = (
      <g {...zone("shift")}>
        <rect x={wide ? 15 : 40} y={2} width={wide ? 70 : 57} height={26} fill="transparent" />
        <text x={x} y={y} fontSize={size} fill={redColor} textAnchor={anchor} fontWeight={weight} letterSpacing={spacing}>
          {d.s}
        </text>
      </g>
    );
  }

  // --- The block graphic: a 2 x 2 grid of 14.5-unit quadrants at (60, 32)
  let glyph: JSX.Element | undefined;
  if (d.g !== undefined) {
    const q = 14.5;
    const cells = zx81GlyphCells(d.g);
    glyph = (
      <g {...zone("glyph")}>
        {cells.map((v, i) => (
          <rect
            key={i}
            x={60 + (i % 2) * q}
            y={32 + Math.floor(i / 2) * q}
            width={q}
            height={q}
            fill={v === "i" ? ink : v === "p" ? keyFace : `url(#${patternId})`}
          />
        ))}
        <rect
          x={60}
          y={32}
          width={2 * q}
          height={2 * q}
          fill="none"
          stroke={hover === "glyph" ? highlight : glyphFrame}
          strokeWidth={hover === "glyph" ? 3 : 1.4}
        />
      </g>
    );
  }

  return (
    <svg
      width={ZX81_KEY_WIDTH * appliedZoom}
      height={ZX81_CELL_HEIGHT * appliedZoom}
      viewBox={`0 0 ${ZX81_KEY_WIDTH} ${ZX81_CELL_HEIGHT}`}
      fontFamily={FONT}
      style={{ marginRight: 28.1 * appliedZoom, flexShrink: 0 }}
      onContextMenu={(e) => e.preventDefault()}
      data-zx81-key={d.c}
    >
      <defs>
        <pattern id={patternId} width={3.4} height={3.4} patternUnits="userSpaceOnUse">
          <rect width={3.4} height={3.4} fill={keyFace} />
          <rect width={1.7} height={1.7} fill={ink} />
          <rect x={1.7} y={1.7} width={1.7} height={1.7} fill={ink} />
        </pattern>
      </defs>
      {d.k && (
        <g {...zone("main")}>
          <rect x={0} y={0} width={ZX81_KEY_WIDTH} height={22} fill="transparent" />
          <text x={6} y={18} fontSize={17} fill={hover === "main" ? legendHighlight : legend} fontWeight={700}>
            {d.k}
          </text>
        </g>
      )}
      <g transform={`translate(0 ${FACE_Y})`}>
        <g {...zone("main")}>
          <rect rx={8} width={ZX81_KEY_WIDTH} height={ZX81_KEY_HEIGHT} fill={pressed ? pressedFace : keyFace} />
          {mainLegend}
        </g>
        {shiftLegend}
        {glyph}
        {d.f && (
          <g {...zone("below")}>
            <rect x={0} y={ZX81_KEY_HEIGHT + 2} width={ZX81_KEY_WIDTH} height={22} fill="transparent" />
            <text x={6} y={ZX81_KEY_HEIGHT + 19} fontSize={17} fill={hover === "below" ? legendHighlight : legend} fontWeight={700}>
              {d.f}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
});
