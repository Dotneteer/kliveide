import classnames from "classnames";
import { useMemo } from "react";
import { abgrToCss } from "@renderer/controls/Next/sprites/spriteAbgr";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  bankChipLabel,
  bankThumbnail,
  pixelFields,
  pixelReasons,
  type BankChip,
  type Layer2Model,
  type Layer2PixelInfo
} from "@renderer/features/layer2/layer2ViewModel";
import styles from "./Layer2Inspector.module.scss";

/*
 * The inspector (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.5): for a pixel, its coordinates, the stored
 * byte or nibble, the palette index after the offset (T7), the colour with its priority bit, whether it
 * is transparent and why (T6), and its four addresses (D6); for a bank, its role, its physical range
 * and a thumbnail.
 */

type Props = {
  layout: "band" | "rail";
  model: Layer2Model;
  pixel?: Layer2PixelInfo;
  bank?: BankChip;
  /** The whole-layer image, for the bank thumbnail */
  whole?: Int16Array;
  abgr: Uint32Array;
  transparentAbgr: number;
  checker: boolean;
  onShowInMemory: () => void;
  onBreakOnWrite: () => void;
  /** Where "Show in memory" goes (`$C123`, `page 12:$0A00`); undefined past 2 MB */
  memoryText?: string;
  /** What "Break on write" sets (`09:+$0A00 + $0A00`); undefined past 2 MB */
  breakText?: string;
};

const hex = (v: number, digits: number) => `$${v.toString(16).toUpperCase().padStart(digits, "0")}`;

const ROLE_TEXT: Record<string, string> = {
  displayed: "displayed ($12)",
  shadow: "shadow ($13)",
  window: "write window ($123B)"
};

export const Layer2InspectorPane = ({
  layout,
  model,
  pixel,
  bank,
  whole,
  abgr,
  transparentAbgr,
  checker,
  onShowInMemory,
  onBreakOnWrite,
  memoryText,
  breakText
}: Props) => {
  const fields = useMemo(() => (pixel ? pixelFields(model, pixel) : []), [model, pixel]);
  const reasons = useMemo(() => (pixel ? pixelReasons(model, pixel) : []), [model, pixel]);
  const thumb = useMemo(() => (bank && whole ? bankThumbnail(model, whole, bank) : undefined), [model, whole, bank]);
  const thumbZoom = thumb ? Math.max(1, Math.min(2, Math.floor(256 / Math.max(thumb.width, thumb.height)))) : 1;

  return (
    <div className={classnames(styles.inspector, { [styles.inspectorBand]: layout === "band" })} aria-label="Inspector">
      {!pixel && !bank && <div className={styles.inspectorEmpty}>Select a pixel on the image or a bank in the strip.</div>}

      {pixel && (
        <>
          <div className={styles.inspectorHeader}>
            Pixel ({pixel.layer.x}, {pixel.layer.y}) · bank {pixel.address.bank16}
          </div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                {pixel.entry !== undefined && (
                  <div className={styles.inspectorSection}>
                    <span
                      className={styles.swatch}
                      style={{ background: abgrToCss(abgr[pixel.index & 0xff]) }}
                      title={`Palette index ${pixel.index}`}
                    />
                    <span className={styles.muted}>palette index {hex(pixel.index, 2)}</span>
                  </div>
                )}
                <dl className={styles.fields}>
                  {fields.map((f) => (
                    <div key={f.name} className={styles.field} title={f.title}>
                      <dt>{f.name}</dt>
                      <dd className={classnames({ [styles.muted]: f.muted, [styles.warn]: f.warn })}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {reasons.map((r) => (
                  <p key={r} className={styles.reason}>
                    {r}
                  </p>
                ))}
                {model.state.copperRunning && (
                  <p className={styles.note}>
                    The Copper is running: it may change the registers per line, so the screen can differ from this
                    decode.
                  </p>
                )}
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!memoryText}
                  title={
                    memoryText
                      ? "Open the Memory view at this byte: at its Z80 address when mapped, otherwise in its 8K page"
                      : "The byte is past the 2 MB SRAM: there is no memory to show"
                  }
                  onClick={onShowInMemory}
                >
                  Show in memory{memoryText ? ` (${memoryText})` : ""}
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!breakText}
                  title={
                    breakText
                      ? "Set a write breakpoint on this byte: bank-relative (wherever the MMU pages the bank in), and on its $123B window address when the window maps writes"
                      : "The byte is past the 2 MB SRAM: no write can reach it"
                  }
                  onClick={onBreakOnWrite}
                >
                  Break on write{breakText ? ` (${breakText})` : ""}
                </button>
              </div>
            </ScrollViewer>
          </div>
        </>
      )}

      {!pixel && bank && (
        <>
          <div className={styles.inspectorHeader}>{bankChipLabel(bank)}</div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                <dl className={styles.fields}>
                  <div className={styles.field}>
                    <dt>Role</dt>
                    <dd className={classnames({ [styles.muted]: !bank.roles.length })}>
                      {bank.roles.length ? bank.roles.map((r) => ROLE_TEXT[r]).join(", ") : "none"}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Physical</dt>
                    <dd className={classnames({ [styles.warn]: bank.outsideRam })}>
                      {bank.outsideRam
                        ? "past 2 MB"
                        : `${hex(0x040000 + bank.bank16 * 0x4000, 6)}-${hex(0x040000 + bank.bank16 * 0x4000 + 0x3fff, 6)}`}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Holds</dt>
                    <dd>
                      {model.size.wide
                        ? `columns ${bank.rect.x1}-${bank.rect.x2}`
                        : `rows ${bank.rect.y1}-${bank.rect.y2}`}
                    </dd>
                  </div>
                </dl>
                {thumb && !bank.outsideRam && (
                  <figure className={styles.preview}>
                    <IndexedImageCanvas
                      pixels={thumb.pixels}
                      width={thumb.width}
                      height={thumb.height}
                      abgr={abgr}
                      transparentAbgr={transparentAbgr}
                      checker={checker}
                      zoomX={thumbZoom}
                      ariaLabel={`Bank ${bank.bank16}`}
                    />
                    <figcaption>bank {bank.bank16}</figcaption>
                  </figure>
                )}
              </div>
            </ScrollViewer>
          </div>
        </>
      )}
    </div>
  );
};
