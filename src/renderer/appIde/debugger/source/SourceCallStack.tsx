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

  if (!rows) return <EmptyState message="Pause the machine to see the call stack" />;
  return (
    <div className={styles.callStackPanel}>
      {rows.map((row) =>
        "runtime" in row ? (
          <div key="runtime" className={styles.item}>
            <Label text="" className={styles.csIndex} />
            <Secondary text={row.error ? `runtime error: ${row.error}` : `runtime code at $${toHexa4(row.pc)}`} />
          </div>
        ) : (
          <div
            key={row.frame}
            className={classnames(styles.item, styles.sourceFrame, { [styles.selectedFrame]: row.frame === selected })}
            onClick={() => void select(row)}
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
                    void emuApi.sourceStep("runToFrame", { targetFrame: row.frame });
                  }}
                />
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
};
