import classnames from "classnames";
import { useMemo } from "react";
import { abgrToCss } from "@renderer/controls/Next/sprites/spriteAbgr";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
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

const ROLE_TEXT: Record<string, MessageKey> = {
  displayed: "panels.layer2.pane.roleDisplayed",
  shadow: "panels.layer2.pane.roleShadow",
  window: "panels.layer2.pane.roleWindow"
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
  const t = useT();
  // --- Not memoized: the text is cheap and must follow a language switch
  const fields = pixel ? pixelFields(model, pixel) : [];
  const reasons = pixel ? pixelReasons(model, pixel) : [];
  const thumb = useMemo(() => (bank && whole ? bankThumbnail(model, whole, bank) : undefined), [model, whole, bank]);
  const thumbZoom = thumb ? Math.max(1, Math.min(2, Math.floor(256 / Math.max(thumb.width, thumb.height)))) : 1;

  return (
    <div className={classnames(styles.inspector, { [styles.inspectorBand]: layout === "band" })} aria-label={t("panels.graphics.inspector.label")}>
      {!pixel && !bank && <div className={styles.inspectorEmpty}>{t("panels.layer2.pane.empty")}</div>}

      {pixel && (
        <>
          <div className={styles.inspectorHeader}>
            {t("panels.layer2.pane.pixel", { x: pixel.layer.x, y: pixel.layer.y, bank: pixel.address.bank16 })}
          </div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                {pixel.entry !== undefined && (
                  <div className={styles.inspectorSection}>
                    <span
                      className={styles.swatch}
                      style={{ background: abgrToCss(abgr[pixel.index & 0xff]) }}
                      title={t("panels.layer2.pane.paletteIndex", { index: pixel.index })}
                    />
                    <span className={styles.muted}>{t("panels.layer2.pane.paletteIndexHex", { index: hex(pixel.index, 2) })}</span>
                  </div>
                )}
                <dl className={styles.fields}>
                  {fields.map((f) => (
                    <div key={f.id} className={styles.field} title={f.title}>
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
                  <p className={styles.note}>{t("panels.graphics.inspector.copperNote")}</p>
                )}
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!memoryText}
                  title={
                    memoryText
                      ? t("panels.layer2.pane.showInMemoryTitle")
                      : t("panels.layer2.pane.showInMemoryOutsideTitle")
                  }
                  onClick={onShowInMemory}
                >
                  {memoryText
                    ? t("panels.layer2.menu.showInMemory", { address: memoryText })
                    : t("panels.layer2.pane.showInMemory")}
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  disabled={!breakText}
                  title={
                    breakText
                      ? t("panels.layer2.pane.breakOnWriteTitle")
                      : t("panels.layer2.pane.breakOnWriteOutsideTitle")
                  }
                  onClick={onBreakOnWrite}
                >
                  {breakText
                    ? t("panels.layer2.menu.breakOnWrite", { targets: breakText })
                    : t("panels.layer2.pane.breakOnWrite")}
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
                    <dt>{t("panels.layer2.pane.role")}</dt>
                    <dd className={classnames({ [styles.muted]: !bank.roles.length })}>
                      {bank.roles.length
                        ? bank.roles.map((r) => t(ROLE_TEXT[r])).join(", ")
                        : t("panels.graphics.inspector.none")}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>{t("panels.graphics.inspector.physical")}</dt>
                    <dd className={classnames({ [styles.warn]: bank.outsideRam })}>
                      {bank.outsideRam
                        ? t("panels.layer2.role.outside")
                        : `${hex(0x040000 + bank.bank16 * 0x4000, 6)}-${hex(0x040000 + bank.bank16 * 0x4000 + 0x3fff, 6)}`}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>{t("panels.layer2.pane.holds")}</dt>
                    <dd>
                      {model.size.wide
                        ? t("panels.layer2.pane.columns", { first: bank.rect.x1, last: bank.rect.x2 })
                        : t("panels.layer2.pane.rows", { first: bank.rect.y1, last: bank.rect.y2 })}
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
                      ariaLabel={t("panels.layer2.pane.bank", { bank: bank.bank16 })}
                    />
                    <figcaption>{t("panels.layer2.pane.bankCaption", { bank: bank.bank16 })}</figcaption>
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
