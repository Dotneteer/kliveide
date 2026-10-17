import { useMemo, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import classnames from "classnames";

import { getRgbPartsForPaletteCode } from "@emu/machines/zxNext/palette";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
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
import type { NexSpriteFormat } from "@common/zxnext/sprites/spritePatterns";
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
  /** Pops a pattern out into a read-only sprite editor (`patternSnapshot.ts`) */
  onOpenSnapshot: (format: NexSpriteFormat, pattern: number, paletteOffset: number, sprite?: number) => void;
};

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

export const SpriteInspectorPane = (props: Props) => {
  const t = useT();
  const { selection, layout, model, selectedCell } = props;
  let title: string;
  let summary = "";
  let details: ReactNode;
  let mapSelection: number | number[] | undefined;
  if (selection?.kind === "sprite") {
    title = t("panels.sprites.pane.sprite", { index: selection.index });
    summary = spriteSummary(model, selection.index);
    details = <SpriteDetails {...props} index={selection.index} />;
    mapSelection = selection.index;
  } else if (selection?.kind === "pattern" && selectedCell) {
    title = t("panels.sprites.pane.pattern", { number: selectedCell.number });
    const range = cellRange(selectedCell);
    summary =
      selectedCell.format === "8bit"
        ? t("panels.sprites.pane.summary8", { start: hex4(range.start), end: hex4(range.end) })
        : t("panels.sprites.pane.summary4", {
            half: selectedCell.secondary,
            start: hex4(range.start),
            end: hex4(range.end)
          });
    details = <PatternDetails {...props} cell={selectedCell} />;
    mapSelection = usersOfSlot(model, selectedCell.slot);
  } else {
    title = t("panels.sprites.pane.noSelection");
    details = <p className={styles.why}>{t("panels.sprites.pane.hint")}</p>;
  }

  const map = <SpriteSpaceMap model={model} selected={mapSelection} onSelectSprite={props.onSelectSprite} />;
  return (
    <div
      className={classnames(styles.inspector, layout === "band" ? styles.band : styles.rail)}
      aria-label={t("panels.sprites.pane.label")}
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
  const t = useT();
  const colours = patternColours(pixels);
  const shown = colours.slice(0, 12);
  return (
    <div className={styles.swatches}>
      {shown.map(({ index, count }) =>
        index === NEX_SPRITE_TRANSPARENT ? (
          <span key="t" className={styles.swatch} title={t("panels.sprites.pane.swatchTransparent", { count })}>
            <span className={classnames(styles.swatchColour, spriteCheckerClass)} />
          </span>
        ) : (
          <span
            key={index}
            className={styles.swatch}
            title={t("panels.sprites.pane.swatch", {
              index: hex2(index),
              rgb: getRgbPartsForPaletteCode(palette[index]).join(""),
              count
            })}
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

const SpriteDetails = ({
  model,
  look,
  palette,
  abgr,
  layout,
  index,
  onSelectPattern,
  onOpenSnapshot
}: Props & { index: number }) => {
  const t = useT();
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
            <figcaption>{t("panels.sprites.pane.stored")}</figcaption>
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
            <figcaption>{t("panels.sprites.pane.shown")}</figcaption>
          </figure>
        </div>
        <ColourStrip pixels={stored} palette={palette} abgr={abgr} />
      </div>
      <dl className={styles.fields}>
        {fields.map((f) => {
          // --- A long value, or one carrying the slot's own reading, takes a whole line in the band
          const wide = f.id === "type" || f.own !== undefined;
          return (
            <FieldRow key={f.id} name={f.name} wide={wide} title={f.own ? `${f.value} · ${f.own}` : f.value}>
              {f.value}
              {f.own && <span className={styles.own}> · {f.own}</span>}
            </FieldRow>
          );
        })}
        <FieldRow name={t("panels.graphics.inspector.bytes")} wide={true}>
          {slot.raw.map((b, k) =>
            k === 4 && slot.attr4Ignored ? (
              <s key={k} title={t("panels.sprites.attr4Ignored")}>
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
        {t("panels.sprites.pane.showPattern", { pattern: formatSpritePattern(r.fourBit, r.pattern7) })}
      </button>
      <button
        type="button"
        className={styles.link}
        title={t("panels.sprites.pane.openEditorSpriteTitle")}
        onClick={() =>
          onOpenSnapshot(
            r.fourBit ? "4bit" : "8bit",
            r.fourBit ? r.pattern7 : patternSlotOf(r),
            r.paletteOffset,
            index
          )
        }
      >
        {t("panels.sprites.pane.openEditor")}
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
        ? translate("panels.sprites.pane.blankTransparent", { index: hex2(transparencyIndex) })
        : translate("panels.sprites.pane.blank", { index: hex2(hint.index) });
    case "noisy":
      return translate("panels.sprites.pane.noisy", { colours: hint.colours });
    default:
      return translate("panels.sprites.pane.colours", { colours: hint.colours, transparent: hint.transparent });
  }
}

const PatternDetails = ({
  model,
  look,
  palette,
  abgr,
  cell,
  onSelectSprite,
  onOpenSnapshot
}: Props & { cell: PatternCell }) => {
  const t = useT();
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
          <p className={styles.problem}>{t("panels.sprites.pane.mixedSlot")}</p>
        )}
        <p className={styles.why}>{describeHint(pixels, model.state.transparencyIndex)}</p>
        <button
          type="button"
          className={styles.link}
          title={t("panels.sprites.pane.openEditorPatternTitle")}
          onClick={() =>
            onOpenSnapshot(cell.format, cell.pattern, cellPaletteOffset(model, cell, look.paletteOffset))
          }
        >
          {t("panels.sprites.pane.openEditor")}
        </button>
        <dl className={styles.fields}>
          <FieldRow name={t("panels.graphics.inspector.usedBy")} wide={true}>
            {cell.users.length === 0 && others.length === 0 && t("panels.sprites.pane.noSprite")}
            {userLinks(cell.users)}
            {others.length > 0 && (
              <span className={styles.own}>
                {cell.format === "8bit" ? t("panels.sprites.pane.as4bit") : t("panels.sprites.pane.otherReading")}{" "}
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
  const t = useT();
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
      <figcaption className={styles.sectionTitle}>{t("panels.sprites.pane.space")}</figcaption>
      <svg
        ref={ref}
        className={styles.map}
        viewBox={`0 0 ${map.width} ${map.height}`}
        role="img"
        aria-label={t("panels.sprites.pane.space")}
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
            <title>{t("panels.sprites.pane.mapSprite", { index: s.index, x: s.rect.x1, y: s.rect.y1 })}</title>
          </rect>
        ))}
        <rect className={styles.mapClip} {...rect(map.clip)} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  );
};
