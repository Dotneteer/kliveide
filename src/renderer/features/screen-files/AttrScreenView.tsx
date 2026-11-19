import classnames from "classnames";
import { useMemo } from "react";

import { useT } from "@common/i18n/useT";
import type { ScreenFile } from "@common/screenFiles/screenFile";
import { shcAttributes, shcPicture, shcProbe, TIMEX_SECOND_ADDRESS } from "@common/screenFiles/timexScreen";
import {
  attrUsage,
  decodeAttr,
  SCR_PIXEL_BYTES,
  scrPicture,
  scrProbe,
  SCREEN_ADDRESS,
  type DecodedAttr
} from "@common/screenFiles/zxScreen";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { Fact, Facts } from "@renderer/controls/data/FileFacts";
import { PLUS3DOS_HEADER_SIZE } from "@common/diskfs/plus3dos";

import { hex2, hex4, ScreenFileViewer, ScreenSection, type ScreenProbe } from "./ScreenFileViewer";
import { dimMask, useFlashPhase, type ScreenFileViewState } from "./screenFileView";
import styles from "./ScreenFileViewer.module.scss";

/*
 * The attribute formats on the screen file viewer (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`): the ZX
 * Spectrum screen (`.scr`, an attribute per 8x8 cell) and Timex hi-colour (`.shc`, one per 8x1 strip).
 * Both draw with the 48K colours (D14), blink their FLASH cells on request (D9), and highlight a colour
 * or the FLASH cells by dimming the rest (D8).
 */

/** The 16 colours as ABGR words, the rest of the table unused */
const SPECTRUM_ABGR = Uint32Array.from({ length: 256 }, (_, i) => SPECTRUM_48_COLORS[i & 0x0f] >>> 0);

/** CSS for a 48K colour (`SPECTRUM_48_COLORS` holds ABGR words) */
export function spectrumCss(index: number): string {
  const v = SPECTRUM_48_COLORS[index & 0x0f];
  return `rgb(${v & 0xff}, ${(v >> 8) & 0xff}, ${(v >> 16) & 0xff})`;
}

/** The eight colours' names, by colour number */
export const COLOUR_NAME_KEYS = [
  "panels.next.screenFile.colour.black",
  "panels.next.screenFile.colour.blue",
  "panels.next.screenFile.colour.red",
  "panels.next.screenFile.colour.magenta",
  "panels.next.screenFile.colour.green",
  "panels.next.screenFile.colour.cyan",
  "panels.next.screenFile.colour.yellow",
  "panels.next.screenFile.colour.white"
] as const;

export const AttrScreenView = ({
  file,
  bytes,
  document,
  viewState,
  changeViewState
}: {
  file: ScreenFile;
  bytes: Uint8Array;
  document?: ProjectDocumentState;
  viewState: ScreenFileViewState;
  changeViewState: (setter: (vs: ScreenFileViewState) => void) => void;
}) => {
  const t = useT();
  const shc = file.kind === "shc";
  const body = file.body;
  const pre = file.header ? PLUS3DOS_HEADER_SIZE : 0;
  const blink = !!viewState.blink;
  const flashPhase = useFlashPhase(blink);
  const decoded = useMemo(() => (shc ? shcPicture(body, flashPhase) : scrPicture(body, flashPhase)), [body, shc, flashPhase]);
  const usage = useMemo(() => attrUsage(shc ? shcAttributes(body) : body.subarray(SCR_PIXEL_BYTES)), [body, shc]);
  const highlight = viewState.highlight;
  const dim = useMemo(() => {
    if (highlight === undefined) return undefined;
    if (highlight === "flash") return dimMask(decoded.pixels.length, (p) => decoded.flash[p] === 1);
    return dimMask(decoded.pixels.length, (p) => decoded.ink[p] === highlight || decoded.paper[p] === highlight);
  }, [decoded, highlight]);

  const colourName = (index: number) =>
    index > 7
      ? t("panels.next.screenFile.brightColour", { colour: t(COLOUR_NAME_KEYS[index & 7]) })
      : t(COLOUR_NAME_KEYS[index & 7]);
  const unit = shc ? "strips" : "cells";
  const set = (patch: Partial<ScreenFileViewState>) => changeViewState((vs) => Object.assign(vs, patch));
  const select = (value: number | "flash") => set({ highlight: highlight === value ? undefined : value });

  const decodedText = (a: DecodedAttr) =>
    `INK ${a.ink} PAPER ${a.paper}${a.bright ? " BRIGHT" : ""}${a.flash ? " FLASH" : ""}`;
  const decodedLong = (a: DecodedAttr) =>
    t(a.bright || a.flash ? "panels.next.screenFile.attrLongFlags" : "panels.next.screenFile.attrLong", {
      ink: a.ink,
      inkName: t(COLOUR_NAME_KEYS[a.ink]),
      paper: a.paper,
      paperName: t(COLOUR_NAME_KEYS[a.paper]),
      flags: [a.bright ? "BRIGHT" : "", a.flash ? "FLASH" : ""].filter(Boolean).join(", ")
    });

  const probe = (x: number, y: number): ScreenProbe => {
    if (shc) {
      const p = shcProbe(body, x, y);
      const a = decodeAttr(p.attr);
      return {
        fileOffset: p.attrOffset + pre,
        line: (
          <>
            {t("panels.next.screenFile.probe.xy", { x, y })}
            {" · "}
            {t("panels.next.screenFile.probe.pixel")} <span className={styles.v}>{hex4(SCREEN_ADDRESS + p.pixelOffset)}</span> (+{(p.pixelOffset + pre).toString(16).toUpperCase().padStart(4, "0")})
            {" · "}
            {t("panels.next.screenFile.probe.attr")} <span className={styles.v}>{hex4(TIMEX_SECOND_ADDRESS + p.pixelOffset)}</span> = <span className={styles.a}>{hex2(p.attr)}</span> {decodedText(a)}
          </>
        ),
        facts: (
          <Facts labelWidth="12ch">
            <Fact label={t("panels.next.screenFile.fact.position")}>{t("panels.next.screenFile.probe.xy", { x, y })}</Fact>
            <Fact label={t("panels.next.screenFile.fact.strip")}>{t("panels.next.screenFile.stripAt", { column: p.stripColumn, row: y })}</Fact>
            <Fact label={t("panels.next.screenFile.fact.pixelByte")} tone="state">
              {t("panels.next.screenFile.atFileOffset", { address: hex4(SCREEN_ADDRESS + p.pixelOffset), offset: (p.pixelOffset + pre).toString(16).toUpperCase().padStart(4, "0") })}
            </Fact>
            <Fact label={t("panels.next.screenFile.fact.bit")}>
              {t(p.ink ? "panels.next.screenFile.bitInk" : "panels.next.screenFile.bitPaper", { bit: p.bit })}
            </Fact>
            <Fact label={t("panels.next.screenFile.fact.attribute")} tone="state">
              {`${hex4(TIMEX_SECOND_ADDRESS + p.pixelOffset)} = ${hex2(p.attr)}`}
            </Fact>
            <Fact label={t("panels.next.screenFile.fact.decoded")}>{decodedLong(a)}</Fact>
          </Facts>
        )
      };
    }
    const p = scrProbe(body, x, y);
    const a = decodeAttr(p.attr);
    return {
      fileOffset: p.pixelOffset + pre,
      line: (
        <>
          {t("panels.next.screenFile.probe.xy", { x, y })}
          {" · "}
          {t("panels.next.screenFile.probe.cell", { column: p.cellColumn, row: p.cellRow })}
          {" · "}
          {t("panels.next.screenFile.probe.pixel")} <span className={styles.v}>{hex4(SCREEN_ADDRESS + p.pixelOffset)}</span> (+{(p.pixelOffset + pre).toString(16).toUpperCase().padStart(4, "0")})
          {" · "}
          {t("panels.next.screenFile.probe.attr")} <span className={styles.v}>{hex4(SCREEN_ADDRESS + p.attrOffset)}</span> = <span className={styles.a}>{hex2(p.attr)}</span> {decodedText(a)}
        </>
      ),
      facts: (
        <Facts labelWidth="12ch">
          <Fact label={t("panels.next.screenFile.fact.position")}>{t("panels.next.screenFile.probe.xy", { x, y })}</Fact>
          <Fact label={t("panels.next.screenFile.fact.cell")}>{t("panels.next.screenFile.cellAt", { column: p.cellColumn, row: p.cellRow })}</Fact>
          <Fact label={t("panels.next.screenFile.fact.pixelByte")} tone="state">
            {t("panels.next.screenFile.atFileOffset", { address: hex4(SCREEN_ADDRESS + p.pixelOffset), offset: (p.pixelOffset + pre).toString(16).toUpperCase().padStart(4, "0") })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.bit")}>
            {t(p.ink ? "panels.next.screenFile.bitInk" : "panels.next.screenFile.bitPaper", { bit: p.bit })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.attribute")} tone="state">
            {t("panels.next.screenFile.atFileOffset", { address: `${hex4(SCREEN_ADDRESS + p.attrOffset)} = ${hex2(p.attr)}`, offset: (p.attrOffset + pre).toString(16).toUpperCase().padStart(4, "0") })}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.decoded")}>{decodedLong(a)}</Fact>
        </Facts>
      )
    };
  };

  const sections = (
    <>
      <ScreenSection id="picture" title={t("panels.next.screenFile.section.picture")}>
        <Facts labelWidth="12ch">
          <Fact label={t("panels.next.screenFile.fact.format")}>
            {t(shc ? "panels.next.screenFile.format.shc" : "panels.next.screenFile.format.scr")}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.resolution")}>
            {t(shc ? "panels.next.screenFile.resolution.shc" : "panels.next.screenFile.resolution.scr")}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.bytes")}>
            {t(shc ? "panels.next.screenFile.layout.shc" : "panels.next.screenFile.layout.scr")}
          </Fact>
          <Fact label={t("panels.next.screenFile.fact.colours")}>{t("panels.next.screenFile.colours48k")}</Fact>
        </Facts>
      </ScreenSection>
      <ScreenSection id="colours" title={t("panels.next.screenFile.section.colours")} meta={t("panels.next.screenFile.clickToHighlight")}>
        <div className={styles.swatches} role="group" aria-label={t("panels.next.screenFile.section.colours")}>
          {Array.from({ length: 16 }, (_, i) => {
            const n = usage.ink[i] + usage.paper[i];
            return (
              <button
                key={i}
                type="button"
                className={classnames(styles.colour, { [styles.unused]: n === 0, [styles.selected]: highlight === i })}
                style={{ background: spectrumCss(i) }}
                aria-pressed={highlight === i}
                title={t(shc ? "panels.next.screenFile.colourUseStrips" : "panels.next.screenFile.colourUseCells", {
                  colour: colourName(i),
                  ink: usage.ink[i],
                  paper: usage.paper[i]
                })}
                onClick={() => select(i)}
              >
                {n > 0 && <span>{n}</span>}
              </button>
            );
          })}
        </div>
        <div className={styles.legend}>{t(shc ? "panels.next.screenFile.swatchLegendStrips" : "panels.next.screenFile.swatchLegendCells")}</div>
        <Facts labelWidth="12ch">
          <Fact label={t(unit === "cells" ? "panels.next.screenFile.fact.brightCells" : "panels.next.screenFile.fact.brightStrips")}>
            {usage.bright}
          </Fact>
          <Fact label={t(unit === "cells" ? "panels.next.screenFile.fact.flashCells" : "panels.next.screenFile.fact.flashStrips")}>
            {usage.flash === 0 ? (
              t("panels.next.screenFile.none")
            ) : (
              <>
                {usage.flash}
                <button
                  type="button"
                  className={styles.link}
                  aria-pressed={highlight === "flash"}
                  title={t("panels.next.screenFile.highlightFlashTitle")}
                  onClick={() => select("flash")}
                >
                  {highlight === "flash" ? t("panels.next.screenFile.highlighted") : t("panels.next.screenFile.highlight")}
                </button>
              </>
            )}
          </Fact>
        </Facts>
      </ScreenSection>
    </>
  );

  return (
    <ScreenFileViewer
      document={document}
      bytes={bytes}
      header={file.header}
      screenAddress={SCREEN_ADDRESS}
      title={t(shc ? "panels.next.screenFile.format.shc" : "panels.next.screenFile.format.scr")}
      controls={<span className={styles.value}>256×192</span>}
      description={t(shc ? "panels.next.screenFile.describe.shc" : "panels.next.screenFile.describe.scr")}
      toggles={[
        ...(shc
          ? []
          : [
              {
                id: "grid",
                text: t("panels.next.screenFile.grid"),
                title: t("panels.next.screenFile.gridTitle"),
                iconName: "spr-grid",
                on: !!viewState.grid,
                toggle: () => set({ grid: !viewState.grid })
              }
            ]),
        {
          id: "blink",
          text: t("panels.next.screenFile.blink"),
          title: t("panels.next.screenFile.blinkTitle"),
          iconName: "zap",
          on: blink,
          toggle: () => set({ blink: !blink })
        }
      ]}
      picture={{ width: decoded.width, height: decoded.height, pixels: decoded.pixels, abgr: SPECTRUM_ABGR }}
      dim={dim}
      highlightLabel={highlight === undefined ? undefined : highlight === "flash" ? t("panels.next.screenFile.flashCellsLabel") : colourName(highlight)}
      onClearHighlight={() => set({ highlight: undefined })}
      overlays={!shc && viewState.grid ? [{ kind: "grid", cellWidth: 8, cellHeight: 8 }] : undefined}
      hoverBox={(x, y) =>
        shc
          ? { x1: x & ~7, y1: y, x2: (x & ~7) + 7, y2: y }
          : { x1: x & ~7, y1: y & ~7, x2: (x & ~7) + 7, y2: (y & ~7) + 7 }
      }
      probe={probe}
      sections={sections}
      viewState={viewState}
      changeViewState={changeViewState}
    />
  );
};
