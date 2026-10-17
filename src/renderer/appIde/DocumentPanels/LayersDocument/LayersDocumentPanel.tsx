import { useCallback, useEffect, useRef, useState } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
import type { NextLayerState } from "@common/messaging/EmuApi";
import { SETTING_EMU_SHOW_NEXT_LAYERS } from "@common/settings/setting-const";
import { setNextLayersAction } from "@common/state/actions";
import {
  describeBlend,
  NEXT_LAYER_BITS,
  PRIORITY_NAMES,
  rgb333Hex,
  type NextLayerId
} from "@common/zxnext/layers/layerMix";
import { useT } from "@common/i18n/useT";
import { EMPTY_LAYER_VIEW, toggleHidden, toggleSolo } from "@common/zxnext/layers/layerView";
import { EmptyState, SectionHeader } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { useDispatch, useSelector, useStore } from "@renderer/core/RendererProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { layerCards, priorityStack, type LayerCard } from "@renderer/features/layers/layersDocumentModel";
import styles from "./LayersDocument.module.scss";

/*
 * The Layers document (`.plans/LAYER_COMPOSITION_PLAN.md` D9): the priority stack for the current
 * `$15`, one card per layer (on or off, clip, why it might be invisible, the debug view) and one
 * picture per layer from the capture, each clickable to solo that layer on the emulator screen.
 */

const LAYER_CLASS: Record<NextLayerId, string> = {
  ula: styles.ula,
  tm: styles.tm,
  l2: styles.l2,
  spr: styles.spr
};

const LayersDocumentPanel = (_props: DocumentProps) => {
  const t = useT();
  const isNext = useSelector((s) => s.emulatorState?.machineId) === MI_ZXNEXT;
  const view = useSelector((s) => s.emulatorState?.nextLayers) ?? EMPTY_LAYER_VIEW;
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const dispatch = useDispatch();
  const store = useStore();
  const [state, setState] = useState<NextLayerState>();

  // --- While open, the emulator keeps the capture on, so the pictures are the frame's own (Q5)
  useEffect(() => {
    if (!isNext) return undefined;
    const mark = (documentOpen: boolean) => {
      const current = store.getState()?.emulatorState?.nextLayers ?? EMPTY_LAYER_VIEW;
      if (!!current.documentOpen !== documentOpen) dispatch(setNextLayersAction({ ...current, documentOpen }));
    };
    mark(true);
    return () => mark(false);
  }, [isNext, dispatch, store]);

  const refresh = useCallback(async () => {
    if (!isNext) return;
    try {
      setState(await emuApi.getNextLayerState({ thumbnails: true }));
    } catch {
      setState(undefined);
    }
  }, [emuApi, isNext]);
  useEmuStateListener(emuApi, refresh, isNext);
  // --- The debug view changed: the pictures and the cards follow at once
  useEffect(() => {
    void refresh();
  }, [view.hidden, view.solo, refresh]);

  const change = useCallback(
    async (next: typeof view) => {
      dispatch(setNextLayersAction(next));
      try {
        await mainApi.setGlobalSettingsValue(SETTING_EMU_SHOW_NEXT_LAYERS, true);
      } catch {
        // --- The strip stays as it was; the view still changed
      }
    },
    [dispatch, mainApi]
  );

  if (!isNext || !state) {
    return (
      <FullPanel>
        <EmptyState
          message={isNext ? t("panels.layersDoc.waiting") : t("panels.layersDoc.notNext")}
        />
      </FullPanel>
    );
  }

  const regs = state.regs;
  const stack = priorityStack(regs);
  const cards = layerCards(state, view);
  const mode = describeBlend(regs.priorities, regs.blendMode) ?? PRIORITY_NAMES[regs.priorities];

  return (
    <FullPanel>
      <ScrollViewer>
        <div className={styles.document} data-testid="layers-document">
          <div className={styles.header}>
            <span className={styles.mode}>{mode}</span>
            <span className={styles.meta}>
              {t("panels.layersDoc.meta", {
                priority: (regs.priorities & 7).toString(2).padStart(3, "0"),
                fallback: rgb333Hex(((regs.fallback << 1) | (regs.fallback & 3 ? 1 : 0)) & 0x1ff),
                transparency: `$${regs.globalTransparency.toString(16).toUpperCase().padStart(2, "0")}`
              })}
              {regs.copperRunning && ` · ${t("panels.layersDoc.copperRunning")}`}
              {!state.capture && ` · ${t("panels.layersDoc.noCapture")}`}
            </span>
          </div>

          <section className={styles.section}>
            <SectionHeader title={t("panels.layersDoc.priority")} />
            <ol className={styles.stack}>
              {stack.map((level, i) => (
                <li key={i} className={styles.level}>
                  <span className={styles.levelLayers}>
                    {level.layers.map((id) => (
                      <span key={id} className={classnames(styles.dot, LAYER_CLASS[id])} />
                    ))}
                  </span>
                  <span className={styles.levelLabel}>{level.label}</span>
                  {/* --- Always the third cell: the list is a three-column grid of its items' children */}
                  <span className={styles.levelNote}>{level.note ?? ""}</span>
                </li>
              ))}
              <li className={styles.level}>
                <span className={styles.levelLayers} />
                <span className={styles.levelLabel}>{t("panels.layersDoc.fallback")}</span>
                <span className={styles.levelNote}>{t("panels.layersDoc.fallbackNote")}</span>
              </li>
            </ol>
          </section>

          <section className={styles.section}>
            <SectionHeader title={t("panels.layersDoc.layers")} />
            <div className={styles.cards}>
              {cards.map((card) => (
                <LayerCardView
                  key={card.id}
                  card={card}
                  hidden={(view.hidden & NEXT_LAYER_BITS[card.id]) !== 0}
                  solo={view.solo === NEXT_LAYER_BITS[card.id]}
                  thumbnail={state.thumbnails?.[card.id]}
                  width={state.thumbnails?.width ?? 0}
                  height={state.thumbnails?.height ?? 0}
                  onSolo={() => change(toggleSolo(view, card.id))}
                  onHide={() => change(toggleHidden(view, card.id))}
                />
              ))}
              {state.thumbnails && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>{t("panels.layersDoc.composite")}</div>
                  <Thumbnail
                    rgba={state.thumbnails.composite}
                    width={state.thumbnails.width}
                    height={state.thumbnails.height}
                    title={t("panels.layersDoc.compositeTitle")}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollViewer>
    </FullPanel>
  );
};

const LayerCardView = ({
  card,
  hidden,
  solo,
  thumbnail,
  width,
  height,
  onSolo,
  onHide
}: {
  card: LayerCard;
  /** The debug view state, read from the view itself: `card.debugText` is display text */
  hidden: boolean;
  solo: boolean;
  thumbnail?: Uint8ClampedArray;
  width: number;
  height: number;
  onSolo: () => void;
  onHide: () => void;
}) => {
  const t = useT();
  return (
  <div className={classnames(styles.card, LAYER_CLASS[card.id])} data-testid={`layers-card-${card.id}`}>
    <div className={styles.cardTitle}>
      <span className={classnames(styles.dot, LAYER_CLASS[card.id])} />
      {card.name}
      <span className={styles.cardActions}>
        <button type="button" onClick={onHide} aria-pressed={hidden}>
          {hidden ? t("panels.layersDoc.show") : t("panels.layersDoc.hide")}
        </button>
        <button type="button" onClick={onSolo} aria-pressed={solo}>
          {solo ? t("panels.layersDoc.endSolo") : t("panels.layersDoc.solo")}
        </button>
      </span>
    </div>
    {thumbnail && (
      <Thumbnail
        rgba={thumbnail}
        width={width}
        height={height}
        frameClass={LAYER_CLASS[card.id]}
        title={t("panels.layersDoc.soloTitle", { layer: card.name })}
        onClick={onSolo}
      />
    )}
    <dl className={styles.facts}>
      <dt>{t("panels.layersDoc.program")}</dt>
      <dd>{card.enableText}</dd>
      <dt>{t("panels.layersDoc.clip")}</dt>
      <dd>{card.clipText}</dd>
      <dt>{t("panels.layersDoc.debugView")}</dt>
      <dd>{card.debugText}</dd>
    </dl>
    {card.reasons.length > 0 && (
      <ul className={styles.reasons}>
        {card.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    )}
  </div>
  );
};

/** One layer's picture, drawn once per snapshot; transparent pixels show the checker behind */
const Thumbnail = ({
  rgba,
  width,
  height,
  frameClass,
  title,
  onClick
}: {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  frameClass?: string;
  title?: string;
  onClick?: () => void;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !width || !height) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  }, [rgba, width, height]);
  return (
    <canvas
      ref={canvas}
      className={classnames(styles.thumbnail, frameClass, { [styles.clickable]: !!onClick })}
      width={width}
      height={height}
      title={title}
      onClick={onClick}
    />
  );
};

export const createLayersDocumentPanel = ({ document, viewState }: DocumentProps) => (
  <LayersDocumentPanel document={document} viewState={viewState} />
);
