import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { useCallback, useEffect, useRef, useState } from "react";
import classnames from "classnames";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { setSourceFrameAction } from "@common/state/actions";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { EmptyState } from "@renderer/controls/data";
import { IconButton } from "@renderer/controls/IconButton";
import { Icon } from "@renderer/controls/Icon";
import { ContextMenu, ContextMenuItem, useContextMenuState } from "@renderer/controls/ContextMenu";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import styles from "@renderer/appIde/SideBarPanels/CallStackPanel.module.scss";

import { buildSourceCallStack, type RuntimeRow, type SourceFrameRow } from "./call-stack-model";

const baseName = (path?: string) => path?.split(/[\\/]/).pop() ?? "";

/**
 * The symbolic call stack of a Klive BASIC program (plan §10.6): one row per activation, innermost
 * first. Selecting a row makes it the frame the Variables panel shows and moves the editor to its
 * statement; the button on an outer row runs until control is back in that frame (Run to Frame).
 */
export const SourceCallStack = ({ info }: { info: SourceLevelDebugInfo }) => {
  const emuApi = useEmuApi();
  const dispatch = useDispatch();
  const { ideCommandsService } = useAppServices();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const selected = useSelector((s) => s.ideView?.sourceFrame ?? 0);
  const [rows, setRows] = useState<(SourceFrameRow | RuntimeRow)[]>();
  // --- The runtime row expands to the raw return addresses between SP and the innermost user activation
  const [runtimeWords, setRuntimeWords] = useState<{ slot: number; value: number }[]>([]);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [menuState, menuApi] = useContextMenuState();
  const [menuRow, setMenuRow] = useState<SourceFrameRow>();
  const lastStop = useRef<string>();

  const refresh = useCallback(async () => {
    if (machineState !== MachineControllerState.Paused) {
      setRows(undefined);
      lastStop.current = undefined;
      return;
    }
    const [chain, stop, cpu] = await Promise.all([
      emuApi.getSourceCallStack(),
      emuApi.getSourceStopInfo(),
      emuApi.getCpuState()
    ]);
    setRows(chain ? buildSourceCallStack(info, chain, stop) : undefined);
    if (chain?.length && stop && stop.statementIndex < 0) {
      const raw = await emuApi.getCallStack();
      const limit = chain[0].returnSlot ?? chain[0].baseline;
      setRuntimeWords(
        raw.frames.map((value, i) => ({ slot: (raw.sp + 2 * i) & 0xffff, value })).filter((w) => w.slot < limit)
      );
    } else setRuntimeWords([]);
    // --- A new stop selects the innermost frame again; a refresh at the same stop keeps the choice
    const key = `${cpu.pc}:${cpu.sp}`;
    if (key !== lastStop.current) {
      lastStop.current = key;
      dispatch(setSourceFrameAction(0));
    }
  }, [emuApi, info, machineState, dispatch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEmuStateListener(emuApi, refresh);

  const select = async (row: SourceFrameRow) => {
    dispatch(setSourceFrameAction(row.frame));
    if (row.filename && row.line) {
      await ideCommandsService.executeCommand(`nav "${row.filename}" ${row.line} ${(row.startColumn ?? 0) + 1}`);
    }
  };

  const runToFrame = (frame: number) => void emuApi.sourceStep("runToFrame", { targetFrame: frame });
  const symbolOf = (address: number) => runtimeSymbolAt(info, address);

  if (!rows) return <EmptyState message="Pause the machine to see the call stack" />;
  return (
    <div className={styles.callStackPanel}>
      {rows.map((row) =>
        "runtime" in row ? (
          <div key="runtime">
            <div className={classnames(styles.item, styles.sourceFrame)} onClick={() => setRuntimeOpen(!runtimeOpen)}>
              <span className={styles.csIndex}>
                <Icon
                  iconName={runtimeOpen ? "chevron-down" : "chevron-right"}
                  width={iconSizes.sm}
                  height={iconSizes.sm}
                  fill="--data-label"
                />
              </span>
              <Secondary
                text={row.error ? `runtime error: ${row.error}` : `runtime code at $${toHexa4(row.pc)}${symbolOf(row.pc)}`}
              />
            </div>
            {runtimeOpen &&
              runtimeWords.map((w) => (
                <div key={w.slot} className={styles.item}>
                  <Label text="" className={styles.csIndex} />
                  <Value text={toHexa4(w.slot)} className={classnames(styles.csCell, regStyles.stateValueAlt)} />
                  <Icon iconName="arrow-small-right" width={16} height={16} fill="--data-label" />
                  <Value text={`${toHexa4(w.value)}${symbolOf(w.value)}`} className={classnames(styles.csCell, regStyles.stateValue)} />
                </div>
              ))}
          </div>
        ) : (
          <div
            key={row.frame}
            className={classnames(styles.item, styles.sourceFrame, { [styles.selectedFrame]: row.frame === selected })}
            onClick={() => void select(row)}
            onContextMenu={(e) => {
              setMenuRow(row);
              menuApi.show(e);
            }}
          >
            <Label text={row.frame ? `${row.frame}:` : "Top:"} className={styles.csIndex} />
            <Value text={row.name} className={classnames(styles.csCell, regStyles.stateValue)} />
            {row.line !== undefined && <Secondary text={`${baseName(row.filename)}:${row.line}`} />}
            {row.frame > 0 && (
              <span className={styles.frameAction}>
                <IconButton
                  iconName="step-out"
                  iconSize={14}
                  buttonWidth={16}
                  buttonHeight={16}
                  noPadding
                  title="Run to this frame"
                  clicked={(e) => {
                    e.stopPropagation();
                    runToFrame(row.frame);
                  }}
                />
              </span>
            )}
          </div>
        )
      )}
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text="Go to this frame"
          clicked={() => {
            menuApi.conceal();
            if (menuRow) void select(menuRow);
          }}
        />
        <ContextMenuItem
          text="Run to this frame"
          iconName="step-out"
          disabled={!menuRow?.frame}
          clicked={() => {
            menuApi.conceal();
            if (menuRow?.frame) runToFrame(menuRow.frame);
          }}
        />
      </ContextMenu>
    </div>
  );
};

/** ` (core.Name+n)` for an address in the runtime, from its entry points; empty elsewhere. */
function runtimeSymbolAt(info: SourceLevelDebugInfo, address: number): string {
  let best: { name: string; address: number } | undefined;
  for (const s of info.extensions?.runtimeSymbols ?? []) {
    if (s.address > address) break;
    best = s;
  }
  if (!best || address - best.address > 0x400) return "";
  const offset = address - best.address;
  return ` (${best.name}${offset ? `+${offset}` : ""})`;
}
