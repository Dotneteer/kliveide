import { useCallback, useMemo, useState, type ReactNode } from "react";
import classnames from "classnames";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  decodeInterruptEvents,
  isReservedIntSource,
  type NextInterruptState,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";
import { DataLabel, DataPanel, DataRow, DataSecondary, DataValue, EmptyState } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import {
  buildInterruptsModel,
  sourceName,
  type IntChainRow,
  type IntDiagnostic,
  type IntRowState
} from "@renderer/features/interrupts/interruptsViewModel";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./InterruptsPanel.module.scss";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

/**
 * The ZX Spectrum Next Interrupts side-bar panel (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §3):
 * the interrupt system at a pause - the modes, diagnostics, the daisy chain in priority order with the
 * source that blocks it, and the NMI. A converted state panel: values take `--color-state-value`.
 */

const LABEL_WIDTH = "11ch";
/** How many of the ring's newest records the "lost" diagnostic looks at */
const RECENT_EVENTS = 512;

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

const STATE_KEYS: Record<IntRowState, MessageKey | undefined> = {
  idle: "panels.side.interrupts.state.idle",
  requesting: "panels.side.interrupts.state.requesting",
  inService: "panels.side.interrupts.state.inService",
  statusSet: "panels.side.interrupts.state.statusSet",
  none: "panels.side.interrupts.state.reserved"
};

const DIAG_KEYS: Record<IntDiagnostic["id"], { title: MessageKey; detail: MessageKey }> = {
  disabled: { title: "panels.side.interrupts.diag.disabled.title", detail: "panels.side.interrupts.diag.disabled.detail" },
  im1: { title: "panels.side.interrupts.diag.im1.title", detail: "panels.side.interrupts.diag.im1.detail" },
  stuck: { title: "panels.side.interrupts.diag.stuck.title", detail: "panels.side.interrupts.diag.stuck.detail" },
  waiting: { title: "panels.side.interrupts.diag.waiting.title", detail: "panels.side.interrupts.diag.waiting.detail" },
  hole: { title: "panels.side.interrupts.diag.hole.title", detail: "panels.side.interrupts.diag.hole.detail" },
  polled: { title: "panels.side.interrupts.diag.polled.title", detail: "panels.side.interrupts.diag.polled.detail" },
  lost: { title: "panels.side.interrupts.diag.lost.title", detail: "panels.side.interrupts.diag.lost.detail" },
  nmiStackless: {
    title: "panels.side.interrupts.diag.nmiStackless.title",
    detail: "panels.side.interrupts.diag.nmiStackless.detail"
  }
};

export const InterruptsPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const paused = machineState === MachineControllerState.Paused;
  const [state, setState] = useState<NextInterruptState>();
  const [recent, setRecent] = useState<NextIntEvent[]>([]);

  const refresh = useCallback(async () => {
    const next = await emuApi.getInterruptState();
    setState(next);
    if (next.recording.enabled && next.recording.count > 0) {
      const events = await emuApi.getInterruptEvents(Math.max(0, next.recording.count - RECENT_EVENTS));
      setRecent(decodeInterruptEvents(events));
    } else {
      setRecent([]);
    }
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const model = useMemo(() => (state ? buildInterruptsModel(state, recent) : undefined), [state, recent]);
  if (!state || !model) return <EmptyState message={t("panels.side.interrupts.notAvailable")} />;

  const write = async (reg: number, value: number) => {
    await emuApi.writeInterruptNextReg(reg, value);
    await refresh();
  };
  const reveal = (address: number) => void ideCommandsService.executeCommand(`show-disass ${hex4(address)}`);

  const tableAddress = state.cpu.i * 256 + state.vectorBase;
  const rows = model.rows;
  return (
    <DataPanel autoHeight xclass={styles.interruptsPanel}>
      {/* --- The modes */}
      <FieldRow label={t("panels.side.interrupts.modeLabel")} tooltip={t("panels.side.interrupts.modeTooltip")}>
        <DataValue
          text={state.hwIm2Mode ? t("panels.side.interrupts.mode.hwIm2") : t("panels.side.interrupts.mode.pulse")}
          xclass={regStyles.stateValue}
        />
      </FieldRow>
      <FieldRow label="CPU" tooltip={t("panels.side.interrupts.cpuTooltip")}>
        <DataValue text={`IM ${state.cpu.im}`} xclass={regStyles.stateValue} />
        <DataSecondary text="IFF1" />
        <DataValue text={state.cpu.iff1 ? "1" : "0"} xclass={regStyles.stateValue} />
        <DataSecondary text="IFF2" />
        <DataValue text={state.cpu.iff2 ? "1" : "0"} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label="/INT" tooltip={t("panels.side.interrupts.intTooltip")}>
        <DataValue
          text={state.intSignal || state.pulseActive ? t("panels.side.interrupts.low") : t("panels.side.interrupts.high")}
          xclass={regStyles.stateValue}
        />
        <DataSecondary text={t("panels.side.interrupts.pulseLength", { length: state.pulseLength })} />
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.vectors")} tooltip={t("panels.side.interrupts.vectorsTooltip")}>
        {state.hwIm2Mode ? (
          <>
            <DataValue text={`${hex2(state.vectorBase)}-${hex2(state.vectorBase | 0x1a)}`} xclass={regStyles.stateValue} />
            <DataSecondary text={t("panels.side.interrupts.lastVector", { vector: hex2(state.lastVector) })} />
          </>
        ) : (
          <DataValue text="$FF" xclass={regStyles.stateValue} />
        )}
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.table")} tooltip={t("panels.side.interrupts.tableTooltip")}>
        {state.cpu.im === 2 ? (
          <>
            <DataSecondary text={`I = ${hex2(state.cpu.i)}`} />
            <DataValue text={hex4(state.hwIm2Mode ? tableAddress : state.cpu.i * 256 + 0xff)} xclass={regStyles.stateValue} />
          </>
        ) : (
          <DataValue text={state.cpu.im === 1 ? "$0038" : "RST $38"} xclass={regStyles.stateValue} />
        )}
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

      {/* --- The daisy chain */}
      <div className={styles.sectionHeader}>
        <span>{t("panels.side.interrupts.chain")}</span>
        <span className={styles.sectionHint}>EN $C4-C6 · ST $C8-CA</span>
      </div>
      <div className={classnames(styles.chainRow, styles.chainHeader)}>
        <span>#</span>
        <span>{t("panels.side.interrupts.col.source")}</span>
        <span>EN</span>
        <span>ST</span>
        <span>{t("panels.side.interrupts.col.state")}</span>
        <span>{t("panels.side.interrupts.col.vector")}</span>
        <span>{t("panels.side.interrupts.col.handler")}</span>
      </div>
      {rows.map((row) => {
        if (isReservedIntSource(row.index)) {
          return row.index === 7 ? <ReservedRow key="reserved" /> : null;
        }
        return (
          <ChainRowView
            key={row.index}
            row={row}
            hw={state.hwIm2Mode}
            paused={paused}
            blockerName={model.blocker !== undefined ? sourceName(model.blocker) : undefined}
            onReveal={reveal}
            onRing={(bit) => void write(0x20, bit)}
            onClear={(w) => void write(w.reg, w.value)}
            afterBlocker={model.blocker === row.index}
          />
        );
      })}
      <div className={classnames(styles.chainRow, styles.busRow)}>
        <span className={styles.idx}>-</span>
        <span className={styles.name}>{t("panels.side.interrupts.expansionBus")}</span>
        <span className={state.expansionBusEnabled ? styles.on : styles.off}>{state.expansionBusEnabled ? "1" : "0"}</span>
        <span className={styles.off}>-</span>
        <span className={styles.stateIdle}>{t("panels.side.interrupts.notEmulated")}</span>
      </div>

      {/* --- The NMI */}
      <div className={styles.sectionHeader}>
        <span>NMI</span>
      </div>
      <FieldRow label={t("panels.side.interrupts.nmi.arbiter")} tooltip={t("panels.side.interrupts.nmi.arbiterTooltip")}>
        <DataValue text={state.nmi.state.toUpperCase()} xclass={regStyles.stateValue} />
        {state.nmi.source && (
          <DataSecondary
            text={state.nmi.source === "multiface" ? t("panels.side.interrupts.nmi.multiface") : t("panels.side.interrupts.nmi.divmmc")}
          />
        )}
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.nmi.allowed")} tooltip={t("panels.side.interrupts.nmi.allowedTooltip")}>
        <DataSecondary text="M1" />
        <DataValue text={state.nmi.allowMultiface ? t("panels.side.interrupts.on") : t("panels.side.interrupts.off")} xclass={regStyles.stateValue} />
        <DataSecondary text="DRIVE" />
        <DataValue text={state.nmi.allowDivMmc ? t("panels.side.interrupts.on") : t("panels.side.interrupts.off")} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.nmi.ioTrap")} tooltip={t("panels.side.interrupts.nmi.ioTrapTooltip")}>
        <DataValue text={state.nmi.ioTrap ? t("panels.side.interrupts.on") : t("panels.side.interrupts.off")} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.nmi.stackless")} tooltip={t("panels.side.interrupts.nmi.stacklessTooltip")}>
        <DataValue text={state.nmi.stackless ? t("panels.side.interrupts.on") : t("panels.side.interrupts.off")} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.interrupts.nmi.return")} tooltip={t("panels.side.interrupts.nmi.returnTooltip")}>
        <DataValue text={hex4(state.nmi.returnAddress)} xclass={regStyles.stateValue} />
      </FieldRow>

      <DataRow dense xclass={styles.footer}>
        <span className={styles.summary}>
          {state.recording.enabled
            ? t("panels.side.interrupts.recording", { count: state.recording.count })
            : t("panels.side.interrupts.notRecording")}
        </span>
        <button type="button" className={styles.link} onClick={() => void ideCommandsService.executeCommand("show-int-timeline")}>
          {t("panels.side.interrupts.openTimeline")}
        </button>
      </DataRow>
    </DataPanel>
  );
};

const ReservedRow = () => {
  const t = useT();
  return (
    <div className={classnames(styles.chainRow, styles.reserved)} title={t("panels.side.interrupts.reservedTooltip")}>
      <span className={styles.idx}>7-10</span>
      <span className={styles.name}>CTC 4-7</span>
      <span className={styles.off}>0</span>
      <span className={styles.off}>0</span>
      <span className={styles.stateIdle}>{t("panels.side.interrupts.state.reserved")}</span>
    </div>
  );
};

type ChainRowProps = {
  row: IntChainRow;
  hw: boolean;
  paused: boolean;
  blockerName?: string;
  afterBlocker: boolean;
  onReveal: (address: number) => void;
  onRing: (bit: number) => void;
  onClear: (write: { reg: number; value: number }) => void;
};

const ChainRowView = ({ row, hw, paused, blockerName, afterBlocker, onReveal, onRing, onClear }: ChainRowProps) => {
  const t = useT();
  const stateKey = STATE_KEYS[row.state];
  const stateClass =
    row.state === "inService"
      ? styles.stateInService
      : row.state === "requesting"
        ? styles.stateRequesting
        : row.state === "statusSet"
          ? styles.stateRequesting
          : styles.stateIdle;
  return (
    <>
      <div
        className={classnames(styles.chainRow, { [styles.blocked]: row.blocked })}
        title={row.blocked && blockerName ? t("panels.side.interrupts.blockedTooltip", { blocker: blockerName }) : undefined}
      >
        <span className={styles.idx}>{row.index}</span>
        <span className={styles.name}>
          <span className={classnames(styles.chip, styles[`lane${laneOf(row.index)}`])} />
          {sourceName(row.index)}
        </span>
        <span className={row.enabled ? styles.on : styles.off}>{row.enabled ? "1" : "0"}</span>
        <span className={row.status ? styles.on : styles.off}>{row.status ? "1" : "0"}</span>
        <span className={stateClass}>{stateKey ? t(stateKey) : ""}</span>
        <span className={styles.vector}>{hw ? hex2(row.vector).slice(1) : ""}</span>
        <span className={styles.handlerCell}>
          {row.handler !== undefined && (
            <button
              type="button"
              className={classnames(styles.handler, { [styles.suspect]: row.handlerSuspect })}
              title={t("panels.side.interrupts.handlerTooltip")}
              onClick={() => onReveal(row.handler!)}
            >
              {hex4(row.handler)}
            </button>
          )}
        </span>
        {paused && (
          <span className={styles.actions}>
            {row.ringBit !== undefined && (
              <button
                type="button"
                className={styles.action}
                title={t("panels.side.interrupts.ringTooltip", { bit: hex2(row.ringBit) })}
                onClick={() => onRing(row.ringBit!)}
              >
                {t("panels.side.interrupts.ring")}
              </button>
            )}
            {row.status && row.clearWrite && (
              <button
                type="button"
                className={styles.action}
                title={t("panels.side.interrupts.clearTooltip", {
                  reg: hex2(row.clearWrite.reg),
                  value: hex2(row.clearWrite.value)
                })}
                onClick={() => onClear(row.clearWrite!)}
              >
                {t("panels.side.interrupts.clear")}
              </button>
            )}
          </span>
        )}
      </div>
      {afterBlocker && (
        <div className={styles.blockBar}>{t("panels.side.interrupts.blockBar", { source: sourceName(row.index) })}</div>
      )}
    </>
  );
};

/** The timeline's lane colour for a source (`--color-int-lane-*`) */
export function laneOf(index: number): "Line" | "UartRx" | "Ctc" | "Ula" | "UartTx" {
  if (index === 0) return "Line";
  if (index === 1 || index === 2) return "UartRx";
  if (index >= 3 && index <= 10) return "Ctc";
  if (index === 11) return "Ula";
  return "UartTx";
}
