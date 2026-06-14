import { useEffect, useState } from "react";
import type { Z80CpuState } from "../../../common/messaging/EmuApi";
import { getRendererEmuApi } from "../../messaging";
import { usePanelRuntime } from "../../src/components/ide/panel-runtime";
import type { PanelChrome } from "../../src/components/ide/panel-runtime";
import type { PanelPlacement } from "../../src/components/ide/panel-registry";
import {
  createZ80CpuPanelViewModel,
  sampleZ80CpuState,
  type Z80RegisterRowView
} from "../../src/components/ide/z80CpuPanelViewModel";
import styles from "./Z80CpuPanel.module.scss";

export type Z80CpuPanelReactProps = {
  contributionId?: string;
  instanceId?: string;
  placement?: PanelPlacement;
  chrome?: PanelChrome;
  sampleState?: Z80CpuState;
};

export function Z80CpuPanelReact({
  contributionId = "z80Cpu",
  instanceId = "z80Cpu",
  placement = "primarySideBar",
  chrome = "compact",
  sampleState
}: Z80CpuPanelReactProps) {
  const runtime = usePanelRuntime({ contributionId, instanceId, placement, chrome });
  const numberCase = runtime.getState<"upper" | "lower">("numberCase", "upper");
  const [cpuState, setCpuState] = useState<Z80CpuState | null | undefined>(sampleState);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sampleState) {
      setCpuState(sampleState);
      setError("");
      return;
    }

    let disposed = false;

    const refresh = async () => {
      try {
        const nextState = await getRendererEmuApi().getCpuState();
        if (!disposed) {
          setCpuState(nextState);
          setError("");
        }
      } catch (err) {
        if (!disposed) {
          setCpuState(undefined);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 500);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [sampleState]);

  if (error) {
    return <PanelMessage title="CPU snapshot unavailable" detail={error} />;
  }

  if (cpuState === undefined) {
    return <PanelMessage title="Loading CPU snapshot" detail="Waiting for emulator response..." />;
  }

  if (cpuState === null) {
    return <PanelMessage title="No active emulator" detail="Start or select an SP48 emulator session." />;
  }

  const model = createZ80CpuPanelViewModel(cpuState ?? sampleZ80CpuState);

  return (
    <div className={styles.panel}>
      <div className={styles.flagBlock}>
        <div className={styles.flagRegister}>F</div>
        <div className={styles.flags} aria-label="CPU flags">
          {model.flags.map((flag) => (
            <div className={styles.flagLetter} key={`letter-${flag.letter}`}>
              {flag.letter}
            </div>
          ))}
          {model.flags.map((flag) => (
            <div
              className={`${styles.flagValue} ${flag.active ? "" : styles.flagInactive}`}
              key={`value-${flag.letter}`}
              title={flag.active === undefined ? `${flag.letter}: unavailable` : `${flag.letter}: ${flag.active ? "set" : "reset"}`}
            >
              {flag.active ? "●" : "○"}
            </div>
          ))}
        </div>
      </div>

      <RegisterSection rows={model.mainRegisters} numberCase={numberCase} />
      <RegisterSection rows={model.memoryAndIo} numberCase={numberCase} />
      <RegisterSection rows={model.interrupts} numberCase={numberCase} />
    </div>
  );
}

function PanelMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.message}>
      <div className={styles.messageTitle}>{title}</div>
      <div className={styles.messageDetail}>{detail}</div>
    </div>
  );
}

function RegisterSection({
  rows,
  numberCase
}: {
  rows: Z80RegisterRowView[];
  numberCase: "upper" | "lower";
}) {
  return (
    <div className={styles.section}>
      <div className={styles.registerGrid}>
        {rows.map((row) => (
          <RegisterRow
            row={row}
            numberCase={numberCase}
            key={`${row.leftLabel}-${row.rightLabel ?? ""}`}
          />
        ))}
      </div>
    </div>
  );
}

function RegisterRow({
  row,
  numberCase
}: {
  row: Z80RegisterRowView;
  numberCase: "upper" | "lower";
}) {
  return (
    <>
      <RegisterCell label={row.leftLabel} value={formatRuntimeValue(row.leftValue, numberCase)} />
      {row.rightLabel ? (
        <RegisterCell
          label={row.rightLabel}
          value={formatRuntimeValue(row.rightValue ?? "", numberCase)}
        />
      ) : (
        <div aria-hidden="true" />
      )}
    </>
  );
}

function RegisterCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.registerCell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

function formatRuntimeValue(value: string, numberCase: "upper" | "lower"): string {
  return numberCase === "lower" ? value.toLowerCase() : value;
}
