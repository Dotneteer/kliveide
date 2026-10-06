import { useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import classnames from "classnames";

import { getRgbPartsForPaletteCode } from "@emu/machines/zxNext/palette";
import { formatSpritePattern, patternSlotOf } from "@common/zxnext/sprites/spriteAttributes";
import { transformPattern } from "@common/zxnext/sprites/spriteGeometry";
import {
  NEX_SPRITE_TRANSPARENT,
  patternColours,
  patternHint,
  patternPixels
} from "@common/zxnext/sprites/spritePatterns";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { SpriteCanvas, spriteCheckerClass } from "@renderer/controls/Next/sprites/SpritePatternSheet";
import { abgrToCss } from "@renderer/controls/Next/sprites/spriteAbgr";
import {
  cellPaletteOffset,
  cellRange,
  diagnosticsOf,
  spriteAtMapPoint,
  spriteFields,
  spriteMap,
  spriteSummary,
  usersOfSlot,
  type PatternCell,
  type SpriteModel,
  type SpriteSelection
} from "@renderer/features/sprites/spriteViewModel";
import type { SpriteInspectorViewState } from "./SpriteInspectorPanel";
import styles from "./SpriteInspector.module.scss";

/*
 * The inspector (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.5.3): the selection's details and where it is
 * in sprite space. One component with two homes, chosen by the document's width:
 *
 * - `band`: a strip under the list in a narrow document, split into the details (previews beside the
 *   fields, two to a line) and the sprite-space map, so both are visible at once without scrolling;
 * - `rail`: a full-height column beside the list in a wider one, everything stacked.
 */

export type InspectorLayout = "band" | "rail";

type Props = {
  layout: InspectorLayout;
  model: SpriteModel;
  cells: PatternCell[];
  selection?: SpriteSelection;
  selectedCell?: PatternCell;
  look: SpriteInspectorViewState;
  palette: number[];
  abgr: Uint32Array;
  onSelectSprite: (index: number) => void;
  onSelectPattern: (slot: number, half?: 0 | 1) => void;
};

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

export const SpriteInspectorPane = (props: Props) => {
  const { selection, layout, model, selectedCell } = props;
  let title: string;
  let summary = "";
  let details: ReactNode;
  let mapSelection: number | number[] | undefined;
  if (selection?.kind === "sprite") {
    title = `Sprite #${selection.index}`;
    summary = spriteSummary(model, selection.index);
    details = <SpriteDetails {...props} index={selection.index} />;
    mapSelection = selection.index;
  } else if (selection?.kind === "pattern" && selectedCell) {
    title = `Pattern ${selectedCell.number}`;
    const range = cellRange(selectedCell);
    summary = `${selectedCell.format === "8bit" ? "8-bit" : `4-bit, ${selectedCell.secondary}`} · ${hex4(range.start)}–${hex4(range.end)}`;
    details = <PatternDetails {...props} cell={selectedCell} />;
    mapSelection = usersOfSlot(model, selectedCell.slot);
  } else {
    title = "No selection";
    details = <p className={styles.why}>Select a sprite or a pattern, or click an outline on the map.</p>;
  }

  const map = <SpriteSpaceMap model={model} selected={mapSelection} onSelectSprite={props.onSelectSprite} />;
  return (
    <div
      className={classnames(styles.inspector, layout === "band" ? styles.band : styles.rail)}
      aria-label="Sprite Inspector selection"
      data-layout={layout}
    >
      <div className={styles.inspectorHeader}>
        <b>{title}</b>
        <span className={styles.inspectorSummary}>{summary}</span>
      </div>
      {layout === "band" ? (
        <div className={styles.inspectorBody}>
          <div className={styles.details}>{details}</div>
          <div className={styles.mapBox}>{map}</div>
        </div>
      ) : (
        <div className={styles.inspectorScroll}>
          <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
            <div className={styles.railContent}>
              <div className={styles.details}>{details}</div>
              {map}
            </div>
          </ScrollViewer>
        </div>
      )}
    </div>
  );
};

// --- The colours a pattern uses

const ColourStrip = ({ pixels, palette, abgr }: { pixels: Int16Array; palette: number[]; abgr: Uint32Array }) => {
  const colours = patternColours(pixels);
  const shown = colours.slice(0, 12);
  return (
    <div className={styles.swatches}>
      {shown.map(({ index, count }) =>
        index === NEX_SPRITE_TRANSPARENT ? (
          <span key="t" className={styles.swatch} title={`Transparent · ${count} px`}>
            <span className={classnames(styles.swatchColour, spriteCheckerClass)} />
          </span>
        ) : (
          <span
            key={index}
            className={styles.swatch}
            title={`Index ${hex2(index)} · RGB333 ${getRgbPartsForPaletteCode(palette[index]).join("")} · ${count} px`}
          >
            <span className={styles.swatchColour} style={{ backgroundColor: abgrToCss(abgr[index]) }} />
          </span>
        )
      )}
      {colours.length > shown.length && <span className={styles.swatch}>{`+${colours.length - shown.length}`}</span>}
    </div>
  );
};

// --- A selected sprite

const SpriteDetails = ({ model, look, palette, abgr, layout, index, onSelectPattern }: Props & { index: number }) => {
  const slot = model.slots[index];
  const r = model.resolved[index];
  const transparentAbgr = abgr[model.state.transparencyIndex & 0xff];
  const stored = useMemo(
    () =>
      patternPixels(model.state.patterns, r.fourBit ? r.pattern7 : patternSlotOf(r), {
        format: r.fourBit ? "4bit" : "8bit",
        offset: 0,
        paletteOffset: r.paletteOffset,
        transparencyIndex: model.state.transparencyIndex
      }),
    [model, r]
  );
  const shown = useMemo(() => transformPattern(stored, r.rotate, r.xmirror, r.ymirror), [stored, r]);
  // --- Only a problem gets a sentence: "drawn" is already in the header line
  const problems = diagnosticsOf(model, index);
  const fields = spriteFields(model, index);

  // --- Both previews fit the same box; "as shown" keeps the scaled aspect inside it
  const box = layout === "band" ? 40 : 64;
  const longest = Math.max(r.scaleX, r.scaleY);
  const shownWidth = (box << r.scaleX) >> longest;
  const shownHeight = (box << r.scaleY) >> longest;

  return (
    <>
      {problems.length > 0 && <p className={styles.problem}>{problems.map((d) => d.sentence).join(" ")}</p>}
      <div className={styles.previews}>
        <div className={styles.previewImages}>
          <figure className={styles.preview}>
            <SpriteCanvas
              pixels={stored}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              showTransparent={look.checker}
              className={styles.previewCanvas}
              style={{ width: box, height: box }}
            />
            <figcaption>stored</figcaption>
          </figure>
          <figure className={styles.preview}>
            <SpriteCanvas
              pixels={shown}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              showTransparent={look.checker}
              className={styles.previewCanvas}
              style={{ width: shownWidth, height: shownHeight }}
            />
            <figcaption>shown</figcaption>
          </figure>
        </div>
        <ColourStrip pixels={stored} palette={palette} abgr={abgr} />
      </div>
      <dl className={styles.fields}>
        {fields.map((f) => {
          // --- A long value, or one carrying the slot's own reading, takes a whole line in the band
          const wide = f.name === "Type" || f.own !== undefined;
          return (
            <FieldRow key={f.name} name={f.name} wide={wide} title={f.own ? `${f.value} · ${f.own}` : f.value}>
              {f.value}
              {f.own && <span className={styles.own}> · {f.own}</span>}
            </FieldRow>
          );
        })}
        <FieldRow name="Bytes" wide={true}>
          {slot.raw.map((b, k) =>
            k === 4 && slot.attr4Ignored ? (
              <s key={k} title="Ignored: a 4-byte sprite">
                {hex2(b)}
              </s>
            ) : (
              <span key={k}>{hex2(b)} </span>
            )
          )}
        </FieldRow>
      </dl>
      <button
        type="button"
        className={styles.link}
        onClick={() => onSelectPattern(patternSlotOf(r), r.fourBit ? ((r.pattern7 & 1) as 0 | 1) : undefined)}
      >
        Show pattern {formatSpritePattern(r.fourBit, r.pattern7)}
      </button>
    </>
  );
};

const FieldRow = ({
  name,
  wide,
  title,
  children
}: {
  name: string;
  wide: boolean;
  /** The full text, for a value the band may cut short */
  title?: string;
  children: ReactNode;
}) => (
  <>
    <dt className={classnames({ [styles.wide]: wide })}>{name}</dt>
    <dd className={classnames(styles.fieldValue, { [styles.wide]: wide })} title={title}>
      {children}
    </dd>
  </>
);

// --- A selected pattern

function describeHint(pixels: Int16Array, transparencyIndex: number): string {
  const hint = patternHint(pixels);
  switch (hint.kind) {
    case "blank":
      return hint.transparent
        ? `Blank: every pixel is transparent (${hex2(transparencyIndex)}).`
        : `Blank: every pixel is ${hex2(hint.index)}.`;
    case "noisy":
      return `${hint.colours} colours with little structure: more likely code or packed data than a sprite.`;
    default:
      return `${hint.colours} colour${hint.colours === 1 ? "" : "s"}, ${hint.transparent} transparent pixel${hint.transparent === 1 ? "" : "s"}.`;
  }
}

const PatternDetails = ({ model, look, palette, abgr, cell, onSelectSprite }: Props & { cell: PatternCell }) => {
  const pixels = useMemo(
    () =>
      patternPixels(model.state.patterns, cell.pattern, {
        format: cell.format,
        offset: 0,
        paletteOffset: cellPaletteOffset(model, cell, look.paletteOffset),
        transparencyIndex: model.state.transparencyIndex
      }),
    [model, cell, look.paletteOffset]
  );
  // --- The slot's other readers: the other format, or the other 4-bit half
  const others = usersOfSlot(model, cell.slot).filter((u) => !cell.users.includes(u));
  const userLinks = (users: number[]) =>
    users.map((u) => (
      <button key={u} type="button" className={styles.link} onClick={() => onSelectSprite(u)}>
        #{u}
      </button>
    ));
  return (
    <>
      <div className={styles.previews}>
        <span className={styles.bigFrame}>
          <SpriteCanvas
            pixels={pixels}
            abgr={abgr}
            transparentAbgr={abgr[model.state.transparencyIndex & 0xff]}
            showTransparent={look.checker}
            className={styles.bigCanvas}
          />
        </span>
        <ColourStrip pixels={pixels} palette={palette} abgr={abgr} />
      </div>
      <div className={styles.patternFacts}>
        {cell.mixed && (
          <p className={styles.problem}>
            This 256-byte slot is read both as one 8-bit pattern and as 4-bit halves: almost always a bug.
          </p>
        )}
        <p className={styles.why}>{describeHint(pixels, model.state.transparencyIndex)}</p>
        <dl className={styles.fields}>
          <FieldRow name="Used by" wide={true}>
            {cell.users.length === 0 && others.length === 0 && "no sprite"}
            {userLinks(cell.users)}
            {others.length > 0 && (
              <span className={styles.own}>
                {cell.format === "8bit" ? "as 4-bit: " : "other reading: "}
                {userLinks(others)}
              </span>
            )}
          </FieldRow>
        </dl>
      </div>
    </>
  );
};

// --- The sprite-space map

/**
 * 320×256 sprite space, with the paper, the effective clip window and every visible sprite as an
 * outline; the selection (a sprite, or a pattern's users) is filled. Clicking an outline selects it.
 */
const SpriteSpaceMap = ({
  model,
  selected,
  onSelectSprite
}: {
  model: SpriteModel;
  selected?: number | number[];
  onSelectSprite: (index: number) => void;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const map = useMemo(() => spriteMap(model, selected), [model, selected]);
  const click = (e: ReactMouseEvent<SVGSVGElement>) => {
    // --- Through the SVG's own transform: the drawing may be letterboxed inside the element
    const matrix = ref.current?.getScreenCTM?.()?.inverse();
    if (!matrix) return;
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
    const hit = spriteAtMapPoint(map, x, y, model.sprite0OnTop);
    if (hit !== undefined) onSelectSprite(hit);
  };
  const rect = (r: { x1: number; y1: number; x2: number; y2: number }) => ({
    x: r.x1,
    y: r.y1,
    width: r.x2 - r.x1 + 1,
    height: r.y2 - r.y1 + 1
  });
  return (
    <figure className={styles.mapFigure}>
      <figcaption className={styles.sectionTitle}>Sprite space</figcaption>
      <svg
        ref={ref}
        className={styles.map}
        viewBox={`0 0 ${map.width} ${map.height}`}
        role="img"
        aria-label="Sprite space"
        onClick={click}
      >
        <rect className={styles.mapSpace} x={0} y={0} width={map.width} height={map.height} />
        <rect className={styles.mapPaper} {...rect(map.paper)} />
        {map.sprites.map((s) => (
          <rect
            key={s.index}
            className={s.selected ? styles.mapSelected : styles.mapSprite}
            {...rect(s.rect)}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`#${s.index} at (${s.rect.x1}, ${s.rect.y1})`}</title>
          </rect>
        ))}
        <rect className={styles.mapClip} {...rect(map.clip)} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
};
