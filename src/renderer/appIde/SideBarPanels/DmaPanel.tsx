import { useCallback, useMemo, useState, type ReactNode } from "react";
import classnames from "classnames";

import { DMA_READ_ENTRIES, type DmaPortState, type NextDmaState } from "@common/zxnext/dma/dmaState";
import type { DmaFieldRole } from "@common/zxnext/dma/dmaDecoder";
import { DataLabel, DataPanel, DataRow, DataSecondary, DataValue, EmptyState } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import {
  buildDmaModel,
  hex6,
  physicalPage,
  portAddresses,
  type DmaDiagnostic,
  type DmaHeaderState
} from "@renderer/features/dma/dmaViewModel";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./DmaPanel.module.scss";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

/**
 * The ZX Spectrum Next DMA side-bar panel (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3): the DMA at a
 * pause - its derived state, diagnostics, the transfer, both ports' start and working addresses, the
 * prescaler's pacing, the status byte and read sequence, the step-aside sources and core 3.03's zxnDDMA
 * settings. Read only. A converted state panel: values take `--color-state-value`.
 */

const LABEL_WIDTH = "13ch";

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

const FieldRow = ({ label, tooltip, children }: { label: string; tooltip?: string; children: ReactNode }) => {
  const ref = useTooltipRef<HTMLDivElement>();
  return (
    <DataRow dense hoverable xclass={styles.fieldRow} ref={ref}>
      <DataLabel text={label} width={LABEL_WIDTH} />
      {children}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom-start"
          offsetX={0}
          offsetY={0}
          showDelay={300}
          content={tooltip}
          className={regStyles.rowTooltip}
        />
      )}
    </DataRow>
  );
};

const HEADER_KEYS: Record<DmaHeaderState, MessageKey> = {
  deaf: "panels.side.dma.state.deaf",
  locked: "panels.side.dma.state.locked",
  holding: "panels.side.dma.state.holding",
  steppedAside: "panels.side.dma.state.steppedAside",
  waiting: "panels.side.dma.state.waiting",
  starting: "panels.side.dma.state.starting",
  idle: "panels.side.dma.state.idle"
};

const DIAG_KEYS: Record<DmaDiagnostic["id"], { title: MessageKey; detail: MessageKey }> = {
  deaf: { title: "panels.side.dma.diag.deaf.title", detail: "panels.side.dma.diag.deaf.detail" },
  lock: { title: "panels.side.dma.diag.lock.title", detail: "panels.side.dma.diag.lock.detail" },
  noLoad: { title: "panels.side.dma.diag.noLoad.title", detail: "panels.side.dma.diag.noLoad.detail" },
  afterEnd: { title: "panels.side.dma.diag.afterEnd.title", detail: "panels.side.dma.diag.afterEnd.detail" },
  partial: { title: "panels.side.dma.diag.partial.title", detail: "panels.side.dma.diag.partial.detail" },
  prescalerContinuous: {
    title: "panels.side.dma.diag.prescalerContinuous.title",
    detail: "panels.side.dma.diag.prescalerContinuous.detail"
  },
  portOff: { title: "panels.side.dma.diag.portOff.title", detail: "panels.side.dma.diag.portOff.detail" },
  stepAsideIm: { title: "panels.side.dma.diag.stepAsideIm.title", detail: "panels.side.dma.diag.stepAsideIm.detail" },
  ddmaOn: { title: "panels.side.dma.diag.ddmaOn.title", detail: "panels.side.dma.diag.ddmaOn.detail" },
  prescalerNone: { title: "panels.side.dma.diag.prescalerNone.title", detail: "panels.side.dma.diag.prescalerNone.detail" },
  z80: { title: "panels.side.dma.diag.z80.title", detail: "panels.side.dma.diag.z80.detail" },
  zeroLength: { title: "panels.side.dma.diag.zeroLength.title", detail: "panels.side.dma.diag.zeroLength.detail" },
  framePause: { title: "panels.side.dma.diag.framePause.title", detail: "panels.side.dma.diag.framePause.detail" }
};

const OP_MODE_KEYS: Record<NextDmaState["operatingMode"], MessageKey> = {
  byte: "panels.side.dma.opMode.byte",
  continuous: "panels.side.dma.opMode.continuous",
  burst: "panels.side.dma.opMode.burst",
  reserved: "panels.side.dma.opMode.reserved"
};

const STEP_KEYS: Record<DmaPortState["step"], MessageKey> = {
  down: "panels.side.dma.step.down",
  up: "panels.side.dma.step.up",
  fixed: "panels.side.dma.step.fixed"
};

/** The read sequence's entries as the chips show them: hardware short names, not translated */
const READ_ENTRY_LABELS: Record<(typeof DMA_READ_ENTRIES)[number], string> = {
  status: "ST",
  counterLo: "CNT.L",
  counterHi: "CNT.H",
  portALo: "A.L",
  portAHi: "A.H",
  portBLo: "B.L",
  portBHi: "B.H"
};

/** The follow-byte roles as the decoder names them, for the "expects" row (hardware short names) */
const ROLE_LABELS: Record<DmaFieldRole | "ddma", string> = {
  portA: "port A",
  portALo: "port A lo",
  portAHi: "port A hi",
  length: "length",
  lengthLo: "length lo",
  lengthHi: "length hi",
  portB: "port B",
  portBLo: "port B lo",
  portBHi: "port B hi",
  timing: "timing",
  timingExtra: "timing extra",
  prescaler: "prescaler",
  mask: "mask",
  match: "match",
  readMask: "read mask",
  ddma: "zxnDDMA byte"
};

const formatHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 100_000 ? 0 : 2)} kHz` : `${hz.toFixed(1)} Hz`);

export const DmaPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<NextDmaState>();

  const refresh = useCallback(async () => {
    setState(await emuApi.getDmaState());
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const model = useMemo(() => (state ? buildDmaModel(state) : undefined), [state]);
  if (!state || !model) return <EmptyState message={t("panels.side.dma.notAvailable")} />;

  const portCell = (port: "A" | "B") => {
    const a = portAddresses(state, port);
    const fmt = model.physical ? hex6 : hex4;
    return { start: fmt(a.start), working: fmt(a.working), moved: a.start !== a.working, raw: a };
  };
  const a = portCell("A");
  const b = portCell("B");
  const status = model.status;
  const pageText = (address: number) => {
    const p = physicalPage(address);
    return p ? t("panels.side.dma.physicalPage", { page: p.page, offset: hex4(p.offset) }) : t("panels.side.dma.physicalLow");
  };

  return (
    <DataPanel autoHeight xclass={styles.dmaPanel}>
      {/* --- The derived state */}
      <FieldRow label={t("panels.side.dma.stateLabel")} tooltip={t("panels.side.dma.stateTooltip")}>
        <span className={classnames(styles.badge, styles[`badge_${model.header}`])}>{t(HEADER_KEYS[model.header])}</span>
        {model.header === "idle" && model.finished && <DataSecondary text={t("panels.side.dma.blockFinished")} />}
      </FieldRow>

      {/* --- Diagnostics */}
      {model.diagnostics.length > 0 && (
        <div className={styles.diagnostics}>
          {model.diagnostics.map((d, i) => (
            <div key={`${d.id}-${i}`} className={classnames(styles.diag, styles[d.severity])}>
              <span className={styles.diagTitle}>{t(DIAG_KEYS[d.id].title, d.args)}</span>
              <span className={styles.diagDetail}>{t(DIAG_KEYS[d.id].detail, d.args)}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- The transfer */}
      <div className={styles.sectionHeader}>
        <span>{t("panels.side.dma.section.transfer")}</span>
      </div>
      <FieldRow label={t("panels.side.dma.dialect")} tooltip={t("panels.side.dma.dialectTooltip")}>
        <DataValue text={state.dialect === "zxn" ? "zxnDMA" : "Z80 DMA"} xclass={regStyles.stateValue} />
        <DataSecondary
          text={state.dialect === "zxn" ? t("panels.side.dma.dialect.zxn") : t("panels.side.dma.dialect.z80")}
        />
      </FieldRow>
      <FieldRow label={t("panels.side.dma.mode")} tooltip={t("panels.side.dma.modeTooltip")}>
        <DataValue text={t(OP_MODE_KEYS[state.operatingMode])} xclass={regStyles.stateValue} />
        {(state.operatingMode === "byte" || (state.operatingMode === "burst" && model.behavesAs === "continuous")) && (
          <DataSecondary text={t("panels.side.dma.behavesContinuous")} />
        )}
      </FieldRow>
      <FieldRow label={t("panels.side.dma.direction")} tooltip={t("panels.side.dma.directionTooltip")}>
        <DataValue text={state.aToB ? "A → B" : "B → A"} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.dma.progress")} tooltip={t("panels.side.dma.progressTooltip")}>
        <DataValue
          text={t("panels.side.dma.progressValue", { moved: model.bytesMoved, total: model.bytesToMove })}
          xclass={regStyles.stateValue}
        />
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${Math.round(model.progress * 1000) / 10}%` }} />
        </span>
      </FieldRow>
      <FieldRow label={t("panels.side.dma.autoRestart")} tooltip={t("panels.side.dma.autoRestartTooltip")}>
        <DataValue text={state.autoRestart ? t("panels.side.dma.on") : t("panels.side.dma.off")} xclass={regStyles.stateValue} />
      </FieldRow>

      {/* --- The ports */}
      <div className={styles.sectionHeader}>
        <span>{t("panels.side.dma.section.ports")}</span>
      </div>
      <div className={classnames(styles.portRow, styles.portHeader)}>
        <span />
        <span>{t("panels.side.dma.portA")}</span>
        <span>{t("panels.side.dma.portB")}</span>
      </div>
      <div className={styles.portRow} title={t("panels.side.dma.startTooltip")}>
        <span className={styles.portLabel}>{t("panels.side.dma.start")}</span>
        <span className={styles.value}>{a.start}</span>
        <span className={styles.value}>{b.start}</span>
      </div>
      <div className={styles.portRow} title={t("panels.side.dma.workingTooltip")}>
        <span className={styles.portLabel}>{t("panels.side.dma.working")}</span>
        <span className={a.moved ? styles.valueAlt : styles.value}>{a.working}</span>
        <span className={b.moved ? styles.valueAlt : styles.value}>{b.working}</span>
      </div>
      {model.physical && (
        <div className={styles.portRow}>
          <span className={styles.portLabel}>{t("panels.side.dma.page")}</span>
          <span className={styles.secondary}>{pageText(a.raw.working)}</span>
          <span className={styles.secondary}>{pageText(b.raw.working)}</span>
        </div>
      )}
      <div className={styles.portRow}>
        <span className={styles.portLabel}>{t("panels.side.dma.kind")}</span>
        <span className={styles.value}>{state.portA.isIo ? t("panels.side.dma.kind.io") : t("panels.side.dma.kind.memory")}</span>
        <span className={styles.value}>{state.portB.isIo ? t("panels.side.dma.kind.io") : t("panels.side.dma.kind.memory")}</span>
      </div>
      <div className={styles.portRow}>
        <span className={styles.portLabel}>{t("panels.side.dma.stepLabel")}</span>
        <span className={styles.value}>{t(STEP_KEYS[state.portA.step])}</span>
        <span className={styles.value}>{t(STEP_KEYS[state.portB.step])}</span>
      </div>
      <div className={styles.portRow} title={t("panels.side.dma.cycleTooltip")}>
        <span className={styles.portLabel}>{t("panels.side.dma.cycle")}</span>
        <span className={styles.value}>{t("panels.side.dma.clocks", { count: state.portA.cycleClocks })}</span>
        <span className={styles.value}>{t("panels.side.dma.clocks", { count: state.portB.cycleClocks })}</span>
      </div>

      {/* --- Pacing */}
      {model.pacing && (
        <>
          <div className={styles.sectionHeader}>
            <span>{t("panels.side.dma.section.pacing")}</span>
          </div>
          <FieldRow label={t("panels.side.dma.prescaler")} tooltip={t("panels.side.dma.prescalerTooltip")}>
            <DataValue text={`${state.prescaler}`} xclass={regStyles.stateValue} />
          </FieldRow>
          <FieldRow label={t("panels.side.dma.nominal")} tooltip={t("panels.side.dma.nominalTooltip")}>
            <DataValue text={formatHz(model.pacing.nominalHz)} xclass={regStyles.stateValue} />
            <DataSecondary text="875 kHz ÷ P" />
          </FieldRow>
          <FieldRow label={t("panels.side.dma.exact")} tooltip={t("panels.side.dma.exactTooltip")}>
            {model.pacing.effective ? (
              <>
                <DataValue
                  text={t("panels.side.dma.periodValue", { clocks: model.pacing.periodClocks })}
                  xclass={regStyles.stateValue}
                />
                <DataSecondary text={formatHz(model.pacing.exactHz)} />
              </>
            ) : (
              <DataSecondary text={t("panels.side.dma.noEffect")} />
            )}
          </FieldRow>
        </>
      )}

      {/* --- Status and read-back */}
      <div className={styles.sectionHeader}>
        <span>{t("panels.side.dma.section.status")}</span>
      </div>
      <FieldRow label={t("panels.side.dma.status")} tooltip={t("panels.side.dma.statusTooltip")}>
        <DataValue text={hex2(status)} xclass={regStyles.stateValue} />
        <span className={styles.bits} aria-label="00E1101T">
          {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => (
            <span
              key={bit}
              className={classnames(styles.bit, { [styles.bitLive]: bit === 5 || bit === 0 })}
              title={bit === 5 ? "E" : bit === 0 ? "T" : undefined}
            >
              {(status >> bit) & 1}
            </span>
          ))}
        </span>
      </FieldRow>
      <FieldRow label="">
        <DataSecondary
          text={t("panels.side.dma.statusMeaning", {
            ended: state.endOfBlockN ? "no" : "yes",
            moving: state.atLeastOne ? "yes" : "no"
          })}
        />
      </FieldRow>
      <FieldRow label={t("panels.side.dma.readMask")} tooltip={t("panels.side.dma.readMaskTooltip")}>
        <DataValue text={hex2(state.readMask)} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.dma.nextRead")} tooltip={t("panels.side.dma.nextReadTooltip")}>
        <span className={styles.chips}>
          {DMA_READ_ENTRIES.map((entry, i) => (
            <span
              key={entry}
              className={classnames(styles.chip, {
                [styles.chipNext]: state.nextRead === entry,
                [styles.chipOff]: (state.readMask & (1 << i)) === 0
              })}
            >
              {READ_ENTRY_LABELS[entry]}
            </span>
          ))}
        </span>
      </FieldRow>
      <FieldRow label={t("panels.side.dma.decoder")} tooltip={t("panels.side.dma.decoderTooltip")}>
        {model.header === "deaf" ? (
          <DataValue text={t("panels.side.dma.decoder.deaf")} xclass={regStyles.stateValue} />
        ) : model.pending ? (
          <>
            <DataValue text={model.pending.group} xclass={regStyles.stateValue} />
            <DataSecondary text={model.pending.roles.map((r) => ROLE_LABELS[r]).join(", ")} />
          </>
        ) : (
          <DataValue text={t("panels.side.dma.decoder.ready")} xclass={regStyles.stateValue} />
        )}
      </FieldRow>

      {/* --- Stepping aside for interrupts */}
      <div className={styles.sectionHeader}>
        <span>{t("panels.side.dma.section.stepAside")}</span>
        <span className={styles.sectionHint}>$CC-$CE</span>
      </div>
      <FieldRow label={t("panels.side.dma.sources")} tooltip={t("panels.side.dma.sourcesTooltip")}>
        {model.stepAside.length > 0 ? (
          <DataValue text={model.stepAside.join(", ")} xclass={regStyles.stateValue} />
        ) : (
          <DataSecondary text={t("panels.side.dma.noStepAside")} />
        )}
      </FieldRow>

      {/* --- zxnDDMA (core 3.03 and later) */}
      {state.ddma && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.keepCase}>zxnDDMA</span>
            <span className={styles.sectionHint}>{t("panels.side.dma.ddmaHint")}</span>
          </div>
          <FieldRow label={t("panels.side.dma.ddma.flags")} tooltip={t("panels.side.dma.ddma.flagsTooltip")}>
            <DataValue text={hex2(state.ddma.flags)} xclass={regStyles.stateValue} />
            <DataSecondary text={model.ddmaFlags.length > 0 ? model.ddmaFlags.join(", ") : t("panels.side.dma.off")} />
          </FieldRow>
          <FieldRow label={t("panels.side.dma.ddma.ext")} tooltip={t("panels.side.dma.ddma.extTooltip")}>
            <DataSecondary text="A" />
            <DataValue text={hex2(state.ddma.extA)} xclass={regStyles.stateValue} />
            <DataSecondary text="B" />
            <DataValue text={hex2(state.ddma.extB)} xclass={regStyles.stateValue} />
          </FieldRow>
          <FieldRow label={t("panels.side.dma.ddma.rect")} tooltip={t("panels.side.dma.ddma.rectTooltip")}>
            <DataValue text={`${state.ddma.rowLength} × ${state.ddma.rowCount}`} xclass={regStyles.stateValue} />
            {(state.ddma.flags & 0x02) !== 0 && (
              <DataSecondary text={t("panels.side.dma.ddma.position", { row: state.ddma.row, byte: state.ddma.rowByte })} />
            )}
          </FieldRow>
          <FieldRow label={t("panels.side.dma.ddma.stride")} tooltip={t("panels.side.dma.ddma.strideTooltip")}>
            <DataSecondary text="A" />
            <DataValue text={`${state.ddma.strideA}`} xclass={regStyles.stateValue} />
            <DataSecondary text="B" />
            <DataValue text={`${state.ddma.strideB}`} xclass={regStyles.stateValue} />
          </FieldRow>
          <FieldRow label={t("panels.side.dma.ddma.colours")} tooltip={t("panels.side.dma.ddma.coloursTooltip")}>
            <DataSecondary text="$F3" />
            <DataValue text={hex2(state.ddma.transparent)} xclass={regStyles.stateValue} />
            <DataSecondary text="$F7" />
            <DataValue text={hex2(state.ddma.fill)} xclass={regStyles.stateValue} />
          </FieldRow>
        </>
      )}
    </DataPanel>
  );
};
