import classnames from "classnames";
import { type CSSProperties, useMemo } from "react";

import { PLUS3DOS_HEADER_SIZE } from "@common/diskfs/plus3dos";
import { useT } from "@common/i18n/useT";
import { nextDefaultUlaPalette, slrPicture, slrProbe } from "@common/screenFiles/loresScreen";
import type { ScreenFile } from "@common/screenFiles/screenFile";
import { HIRES_WIDTH, shrPicture, shrProbe, TIMEX_FILE_BYTES, TIMEX_SECOND_ADDRESS } from "@common/screenFiles/timexScreen";
import { SCR_HEIGHT, SCREEN_ADDRESS } from "@common/screenFiles/zxScreen";
import { defaultLayer2Palette, LAYER2_FILE_PALETTE, type Layer2File } from "@common/zxnext/layer2/layer2File";
import { layer2ByteOffset, layer2Image, layer2Index, layer2Size, type Layer2Resolution } from "@common/zxnext/layer2/layer2Decode";
import { bankRegions } from "@common/zxnext/layer2/layer2Geometry";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { Fact, Facts } from "@renderer/controls/data/FileFacts";
import { spriteSegmentClass, spriteSegmentedClass } from "@renderer/controls/Next/sprites/SpritePatternSheet";
import { abgrToCss, toAbgrTable } from "@renderer/controls/Next/sprites/spriteAbgr";

import { hex2, hex4, ScreenFileViewer, ScreenSection, type ScreenProbe } from "./ScreenFileViewer";
import type { ScreenShape } from "./ScreenOverlayCanvas";
import { dimMask, type ScreenFileViewState } from "./screenFileView";
import { COLOUR_NAME_KEYS, spectrumCss } from "./AttrScreenView";
import styles from "./ScreenFileViewer.module.scss";

/*
 * The palette formats on the screen file viewer (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`): Layer 2
 * (`.sl2`, `.nxi`) and LoRes (`.slr`) index a 256-colour palette; Timex hi-res (`.shr`) has one colour
 * pair, which the file does not carry (D13).
 */

type ViewProps = {
  document?: ProjectDocumentState;
  bytes: Uint8Array;
  viewState: ScreenFileViewState;
  changeViewState: (setter: (vs: ScreenFileViewState) => void) => void;
};

const hexOffset = (value: number, digits: number) => `+${value.toString(16).toUpperCase().padStart(digits, "0")}`;

// ---------------------------------------------------------------------------------------------------
// The palette grid (D6, D8)

/**
 * A palette's entries 16 to a row: the ones the picture uses solid, the rest hollow, the highlighted
 * one ringed. A click highlights the pixels that use the entry (D8). A 4-bit picture shows one row:
 * the only colours it can use ("A Palette Shows Only The Colours The Thing Being Drawn Can Use").
 */
const PaletteGrid = ({
  abgr,
  palette,
  used,
  rows,
  highlight,
  onSelect
}: {
  abgr: Uint32Array;
  /** 9-bit values, for the tooltip */
  palette: number[];
  used: Set<number>;
  rows: number;
  highlight?: number | "flash";
  onSelect: (index: number) => void;
}) => {
  const t = useT();
  return (
    <>
      <div className={styles.paletteGrid} role="group" aria-label={t("panels.next.screenFile.section.palette")}>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className={styles.paletteRow}>
            <span className={styles.paletteRowLabel}>{r.toString(16).toUpperCase()}</span>
            {Array.from({ length: 16 }, (_, c) => {
              const i = r * 16 + c;
              const css = abgrToCss(abgr[i]);
              const isUsed = used.has(i);
              return (
                <button
                  key={c}
                  type="button"
                  className={classnames(styles.paletteCell, {
                    [styles.paletteUnused]: !isUsed,
                    [styles.selected]: highlight === i
                  })}
                  style={{ "--cell-colour": css } as CSSProperties}
                  aria-pressed={highlight === i}
                  title={t(isUsed ? "panels.next.screenFile.paletteEntry" : "panels.next.screenFile.paletteEntryUnused", {
                    index: hex2(i),
                    value: `$${palette[i].toString(16).toUpperCase().padStart(3, "0")}`
                  })}
                  onClick={() => onSelect(i)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.legend}>{t("panels.next.screenFile.paletteLegend")}</div>
      <Facts labelWidth="12ch">
        <Fact label={t("panels.next.screenFile.fact.indicesUsed")}>
          {t("panels.next.screenFile.indicesUsed", { used: used.size, total: rows * 16 })}
        </Fact>
      </Facts>
    </>
  );
};

const usedIndices = (pixels: Int16Array) => {
  const used = new Set<number>();
  for (let p = 0; p < pixels.length; p++) if (pixels[p] >= 0) used.add(pixels[p]);
  return used;
};

const deviceAbgr = (palette: number[]) => toAbgrTable(palette.map(paletteCodeFromDeviceValue));

// ---------------------------------------------------------------------------------------------------
// Layer 2

export const Layer2ScreenView = ({ file, bytes, document, viewState, changeViewState }: ViewProps & { file: Layer2File }) => {
  const t = useT();
  const wanted = viewState.resolution;
  const resolution: Layer2Resolution = wanted !== undefined && file.resolutions.includes(wanted) ? wanted : file.resolutions[0];
  const size = layer2Size(resolution);
  const set = (patch: Partial<ScreenFileViewState>) => changeViewState((vs) => Object.assign(vs, patch));
  const pixels = useMemo(() => layer2Image(resolution, file.data, 0), [file, resolution]);
  const abgr = useMemo(() => deviceAbgr(file.palette), [file]);
  const used = useMemo(() => usedIndices(pixels), [pixels]);
  const highlight = typeof viewState.highlight === "number" ? viewState.highlight : undefined;
  const dim = useMemo(
    () => (highlight === undefined ? undefined : dimMask(pixels.length, (p) => pixels[p] === highlight)),
    [pixels, highlight]
  );
  const grid = viewState.grid ?? viewState.banks ?? false;
  const overlays = useMemo<ScreenShape[]>(
    () =>
      grid
        ? bankRegions(resolution).flatMap(({ index, rect }) => [
            { kind: "rect" as const, role: "bank" as const, rect },
            { kind: "label" as const, x: rect.x1, y: rect.y1, text: `+${index}` }
          ])
        : [],
    [grid, resolution]
  );
  const pre = (file.header ? PLUS3DOS_HEADER_SIZE : 0) + (file.paletteFromFile ? LAYER2_FILE_PALETTE : 0);
  const resolutionText = (r: Layer2Resolution) => (r === 0 ? "256×192" : r === 1 ? "320×256" : "640×256");

  const probe = (x: number, y: number): ScreenProbe => {
    const { offset, nibble } = layer2ByteOffset(resolution, x, y);
    const index = layer2Index(resolution, file.data, x, y, 0) ?? 0;
    const value = file.palette[index];
    const bank = offset >> 14;
    const inBank = offset & 0x3fff;
    const rgb = `${(value >> 6) & 7},${(value >> 3) & 7},${value & 7}`;
    const nibbleText = nibble === undefined ? "" : ` ${t(nibble === "hi" ? "panels.next.screenFile.nibbleHigh" : "panels.next.screenFile.nibbleLow")}`;
    return {
      fileOffset: offset + pre,
      line: (
        <>
          {t("panels.next.screenFile.probe.xy", { x, y })}
          {" · "}
          {t("panels.next.screenFile.probe.index")} <span className={styles.v}>{hex2(index)}</span>
          {" · RGB "}
          {rgb}
          {" · "}
          {t("panels.next.screenFile.probe.bank", { bank })} <span className={styles.a}>{hex4(inBank)}</span> ({hexOffset(offset + pre, 5)})
          {nibbleText}
        </>
      ),
      facts: (
        <Facts labelWidth="12ch">
          <Fact label={t("panels.next.screenFile.fact.position")}>{t("panels.next.screenFile.probe.xy", { x, y })}</Fact>
          <Fact label={t("panels.next.screenFile.fact.paletteIndex")} tone="state">{hex2(index)}</Fact>
          <Fact label={t("panels.next.screenFile.fact.colour")} tone="state">
            {`$${value.toString(16).toUpperCase().padStart(3, "0")} · R ${(value >> 6) & 7} G ${(value >> 3) & 7} B ${value & 7}`}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.byte")} tone="state">
            {t("panels.next.screenFile.bankOffset", { bank, offset: hex4(inBank) })}
            {nibbleText}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.fileOffset")}>{hexOffset(offset + pre, 5)}</Fact>
        </Facts>
      )
    };
  };

  const controls =
    file.resolutions.length > 1 ? (
      <span className={spriteSegmentedClass} role="group" aria-label={t("panels.next.layer2.resolution")}>
        {file.resolutions.map((r) => (
          <button
            key={r}
            type="button"
            className={spriteSegmentClass}
            aria-pressed={resolution === r}
            title={t("panels.next.screenFile.resolutionAmbiguous")}
            onClick={() => set({ resolution: r, pin: undefined, highlight: undefined })}
          >
            {resolutionText(r)}
          </button>
        ))}
      </span>
    ) : (
      <span className={styles.value}>256×192</span>
    );

  return (
    <ScreenFileViewer
      document={document}
      bytes={bytes}
      header={file.header}
      title={t("panels.next.layer2.picture")}
      controls={controls}
      description={t(file.paletteFromFile ? "panels.next.screenFile.describe.layer2File" : "panels.next.screenFile.describe.layer2Default")}
      toggles={[
        {
          id: "banks",
          text: t("panels.next.layer2.banks"),
          title: t("panels.next.layer2.banksTitle"),
          iconName: "spr-grid",
          on: grid,
          toggle: () => set({ grid: !grid, banks: undefined })
        }
      ]}
      picture={{ width: size.width, height: size.height, pixels, abgr, zoomY: size.nibbles ? 2 : 1 }}
      dim={dim}
      highlightLabel={highlight === undefined ? undefined : hex2(highlight)}
      onClearHighlight={() => set({ highlight: undefined })}
      overlays={overlays}
      probe={probe}
      sections={
        <>
          <ScreenSection id="picture" title={t("panels.next.screenFile.section.picture")}>
            <Facts labelWidth="12ch">
              <Fact label={t("panels.next.screenFile.fact.format")}>{t("panels.next.layer2.picture")}</Fact>
              <Fact label={t("panels.next.screenFile.fact.resolution")}>
                {t(size.nibbles ? "panels.next.screenFile.resolution.layer2Bits4" : "panels.next.screenFile.resolution.layer2Bits8", {
                  size: resolutionText(resolution)
                })}
              </Fact>
              <Fact label={t("panels.next.screenFile.fact.layout")}>
                {t(size.wide ? "panels.next.screenFile.layout.columns" : "panels.next.screenFile.layout.rows")}
              </Fact>
              <Fact label={t("panels.next.screenFile.fact.bytes")}>
                {t("panels.next.screenFile.layout.banks", { bytes: size.bytes, banks: size.banks })}
              </Fact>
              <Fact label={t("panels.next.screenFile.fact.palette")}>
                {t(file.paletteFromFile ? "panels.next.screenFile.paletteFromFile" : "panels.next.screenFile.paletteDefault")}
              </Fact>
            </Facts>
          </ScreenSection>
          <ScreenSection
            id="palette"
            title={t("panels.next.screenFile.section.palette")}
            meta={t("panels.next.screenFile.clickToHighlight")}
          >
            <PaletteGrid
              abgr={abgr}
              palette={file.palette}
              used={used}
              rows={size.nibbles ? 1 : 16}
              highlight={highlight}
              onSelect={(i) => set({ highlight: highlight === i ? undefined : i })}
            />
          </ScreenSection>
        </>
      }
      viewState={viewState}
      changeViewState={changeViewState}
    />
  );
};

// ---------------------------------------------------------------------------------------------------
// LoRes

/** RGB332 at index i: the Layer 2 default, which LoRes pictures are usually drawn for */
const rgb332Palette = () => defaultLayer2Palette();

export const LoresScreenView = ({ file, bytes, document, viewState, changeViewState }: ViewProps & { file: ScreenFile }) => {
  const t = useT();
  const set = (patch: Partial<ScreenFileViewState>) => changeViewState((vs) => Object.assign(vs, patch));
  const paletteChoice = viewState.loresPalette ?? "ula";
  const palette = useMemo(() => (paletteChoice === "ula" ? nextDefaultUlaPalette() : rgb332Palette()), [paletteChoice]);
  const abgr = useMemo(() => deviceAbgr(palette), [palette]);
  const picture = useMemo(() => slrPicture(file.body), [file]);
  const used = useMemo(() => usedIndices(picture.pixels), [picture]);
  const highlight = typeof viewState.highlight === "number" ? viewState.highlight : undefined;
  const dim = useMemo(
    () => (highlight === undefined ? undefined : dimMask(picture.pixels.length, (p) => picture.pixels[p] === highlight)),
    [picture, highlight]
  );
  const pre = file.header ? PLUS3DOS_HEADER_SIZE : 0;

  const probe = (x: number, y: number): ScreenProbe => {
    const p = slrProbe(file.body, x, y);
    const value = palette[p.index];
    return {
      fileOffset: p.offset + pre,
      line: (
        <>
          {t("panels.next.screenFile.probe.xy", { x, y })}
          {" · "}
          {t("panels.next.screenFile.probe.index")} <span className={styles.v}>{hex2(p.index)}</span>
          {" · "}
          <span className={styles.a}>{hex4(p.address)}</span> ({hexOffset(p.offset + pre, 4)})
        </>
      ),
      facts: (
        <Facts labelWidth="12ch">
          <Fact label={t("panels.next.screenFile.fact.position")}>{t("panels.next.screenFile.probe.xy", { x, y })}</Fact>
          <Fact label={t("panels.next.screenFile.fact.paletteIndex")} tone="state">{hex2(p.index)}</Fact>
          <Fact label={t("panels.next.screenFile.fact.colour")} tone="state">
            {`$${value.toString(16).toUpperCase().padStart(3, "0")} · R ${(value >> 6) & 7} G ${(value >> 3) & 7} B ${value & 7}`}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.address")} tone="state">
            {t(p.bottom ? "panels.next.screenFile.loresBottom" : "panels.next.screenFile.loresTop", { address: hex4(p.address) })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.fileOffset")}>{hexOffset(p.offset + pre, 4)}</Fact>
        </Facts>
      )
    };
  };

  return (
    <ScreenFileViewer
      document={document}
      bytes={bytes}
      header={file.header}
      screenAddress={SCREEN_ADDRESS}
      title={t("panels.next.screenFile.format.slr")}
      controls={
        <>
          <span className={styles.value}>128×96</span>
          <span className={spriteSegmentedClass} role="group" aria-label={t("panels.next.screenFile.section.palette")}>
            {(["ula", "rgb332"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={spriteSegmentClass}
                aria-pressed={paletteChoice === choice}
                title={t(choice === "ula" ? "panels.next.screenFile.loresUlaTitle" : "panels.next.screenFile.loresRgb332Title")}
                onClick={() => set({ loresPalette: choice })}
              >
                {t(choice === "ula" ? "panels.next.screenFile.loresUla" : "panels.next.screenFile.loresRgb332")}
              </button>
            ))}
          </span>
        </>
      }
      description={t("panels.next.screenFile.describe.slr")}
      picture={{ width: picture.width, height: picture.height, pixels: picture.pixels, abgr }}
      dim={dim}
      highlightLabel={highlight === undefined ? undefined : hex2(highlight)}
      onClearHighlight={() => set({ highlight: undefined })}
      probe={probe}
      sections={
        <>
          <ScreenSection id="picture" title={t("panels.next.screenFile.section.picture")}>
            <Facts labelWidth="12ch">
              <Fact label={t("panels.next.screenFile.fact.format")}>{t("panels.next.screenFile.format.slr")}</Fact>
              <Fact label={t("panels.next.screenFile.fact.resolution")}>{t("panels.next.screenFile.resolution.slr")}</Fact>
              <Fact label={t("panels.next.screenFile.fact.bytes")}>{t("panels.next.screenFile.layout.slr")}</Fact>
              <Fact label={t("panels.next.screenFile.fact.palette")}>
                {t(paletteChoice === "ula" ? "panels.next.screenFile.loresPaletteUla" : "panels.next.screenFile.loresPaletteRgb332")}
              </Fact>
            </Facts>
          </ScreenSection>
          <ScreenSection id="palette" title={t("panels.next.screenFile.section.palette")} meta={t("panels.next.screenFile.clickToHighlight")}>
            <PaletteGrid
              abgr={abgr}
              palette={palette}
              used={used}
              rows={16}
              highlight={highlight}
              onSelect={(i) => set({ highlight: highlight === i ? undefined : i })}
            />
          </ScreenSection>
        </>
      }
      viewState={viewState}
      changeViewState={changeViewState}
    />
  );
};

// ---------------------------------------------------------------------------------------------------
// Timex hi-res

export const HiresScreenView = ({ file, bytes, document, viewState, changeViewState }: ViewProps & { file: ScreenFile }) => {
  const t = useT();
  const set = (patch: Partial<ScreenFileViewState>) => changeViewState((vs) => Object.assign(vs, patch));
  const ink = (viewState.ink ?? 0) & 7;
  const paper = 7 - ink;
  const picture = useMemo(() => shrPicture(file.body), [file]);
  const abgr = useMemo(() => {
    const table = new Uint32Array(256);
    table[0] = SPECTRUM_48_COLORS[paper] >>> 0;
    table[1] = SPECTRUM_48_COLORS[ink] >>> 0;
    return table;
  }, [ink, paper]);
  const pre = file.header ? PLUS3DOS_HEADER_SIZE : 0;
  const colour = (i: number) => t(COLOUR_NAME_KEYS[i & 7]);

  const probe = (x: number, y: number): ScreenProbe => {
    const p = shrProbe(file.body, x, y);
    // --- A right byte sits at the same offset in the $6000 half as its left byte in the $4000 one
    const address = p.right ? TIMEX_SECOND_ADDRESS + p.offset - TIMEX_FILE_BYTES / 2 : SCREEN_ADDRESS + p.offset;
    return {
      fileOffset: p.offset + pre,
      line: (
        <>
          {t("panels.next.screenFile.probe.xy", { x, y })}
          {" · "}
          {t("panels.next.screenFile.probe.byte")} <span className={styles.v}>{hex4(address)}</span> ({hexOffset(p.offset + pre, 4)}) ={" "}
          <span className={styles.a}>{hex2(p.byte)}</span>
          {" · "}
          {t(p.right ? "panels.next.screenFile.wordRight" : "panels.next.screenFile.wordLeft", { word: p.wordColumn })}
        </>
      ),
      facts: (
        <Facts labelWidth="12ch">
          <Fact label={t("panels.next.screenFile.fact.position")}>{t("panels.next.screenFile.probe.xy", { x, y })}</Fact>
          <Fact label={t("panels.next.screenFile.fact.byte")} tone="state">{`${hex4(address)} = ${hex2(p.byte)}`}</Fact>
          <Fact label={t("panels.next.screenFile.fact.half")}>
            {t(p.right ? "panels.next.screenFile.wordRight" : "panels.next.screenFile.wordLeft", { word: p.wordColumn })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.bit")}>
            {t(p.ink ? "panels.next.screenFile.bitInk" : "panels.next.screenFile.bitPaper", { bit: p.bit })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.fileOffset")}>{hexOffset(p.offset + pre, 4)}</Fact>
        </Facts>
      )
    };
  };

  return (
    <ScreenFileViewer
      document={document}
      bytes={bytes}
      header={file.header}
      screenAddress={SCREEN_ADDRESS}
      title={t("panels.next.screenFile.format.shr")}
      controls={
        <>
          <span className={styles.value}>
            {HIRES_WIDTH}×{SCR_HEIGHT}
          </span>
          <span className={styles.note} title={t("panels.next.screenFile.inkTitle")}>
            {t("panels.next.screenFile.ink")}
          </span>
          <span className={spriteSegmentedClass} role="group" aria-label={t("panels.next.screenFile.ink")}>
            {Array.from({ length: 8 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={spriteSegmentClass}
                aria-pressed={ink === i}
                title={t("panels.next.screenFile.inkChoice", { ink: i, inkName: colour(i), paper: 7 - i, paperName: colour(7 - i) })}
                onClick={() => set({ ink: i })}
              >
                <span className={styles.swatch} style={{ background: spectrumCss(i) }} />
              </button>
            ))}
          </span>
        </>
      }
      description={t("panels.next.screenFile.describe.shr")}
      picture={{ width: picture.width, height: picture.height, pixels: picture.pixels, abgr, zoomY: 2 }}
      probe={probe}
      sections={
        <ScreenSection id="picture" title={t("panels.next.screenFile.section.picture")}>
          <Facts labelWidth="12ch">
            <Fact label={t("panels.next.screenFile.fact.format")}>{t("panels.next.screenFile.format.shr")}</Fact>
            <Fact label={t("panels.next.screenFile.fact.resolution")}>{t("panels.next.screenFile.resolution.shr")}</Fact>
            <Fact label={t("panels.next.screenFile.fact.bytes")}>{t("panels.next.screenFile.layout.shr")}</Fact>
            <Fact label={t("panels.next.screenFile.fact.colours")}>
              {t("panels.next.screenFile.shrColours", { ink, inkName: colour(ink), paper, paperName: colour(paper) })}
            </Fact>
          </Facts>
        </ScreenSection>
      }
      viewState={viewState}
      changeViewState={changeViewState}
    />
  );
};

