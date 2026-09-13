import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa4 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./CallStackPanel.module.scss";
import { Icon } from "@renderer/controls/Icon";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import classnames from "classnames";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { EmptyState } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";

/**
 * A stack address, in hex and decimal.
 *
 * No binary here, unlike the byte tooltips in the memory dump and the register panels: those are
 * about a *bit pattern* — flags, a port's fields — whereas these two numbers are addresses, where
 * sixteen binary digits say nothing the hex does not.
 */
const addressText = (value: number) => `$${toHexa4(value)} (${value})`;

/**
 * One call-stack frame: where the return address is stored, and what it points at.
 *
 * A component rather than markup inlined into `renderItem`, because the row owns a tooltip and so
 * needs a hook — `renderItem` is a callback, not a component, and a hook there breaks the rules of
 * hooks. The tooltip binds to the row, so it answers anywhere along it rather than only over one of
 * the two four-character numbers (see `TipRow` in `MemMappingPanel` for the same shape).
 */
const CallStackRow = ({ index, slot, frame }: { index: number; slot: number; frame: number }) => {
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <div ref={ref} className={styles.item}>
      <Label text={`${index ? index : "Top"}:`} className={styles.csIndex} />
      <Value
        text={toHexa4(slot)}
        className={classnames(styles.csCell, regStyles.stateValueAlt)}
      />
      <Icon iconName="arrow-small-right" width={16} height={16} fill="--data-label" />
      <Value text={toHexa4(frame)} className={classnames(styles.csCell, regStyles.stateValue)} />
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={
          `${index ? `Frame ${index}` : "Top of stack"}\n` +
          `Stored at ${addressText(slot)}\n` +
          `Returns to ${addressText(frame)}`
        }
      />
    </div>
  );
};

export const CallStackPanel = () => {
  const emuApi = useEmuApi();
  const [refreshed, setRefreshed] = useState(false);
  const [spValue, setSpValue] = useState<number>();
  const [frames, setFrames] = useState<number[]>();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    // --- Get breakpoint information
    if (machineState !== MachineControllerState.None) {
      const callStack = await emuApi.getCallStack();
      setSpValue(callStack.sp);
      setFrames(callStack.frames);
      setRefreshed(true);
    }
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      await refreshMemoryMappingState();
    })();
  }, [machineState, emuViewVersion]);

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshMemoryMappingState();
  });

  return (
    <div className={styles.callStackPanel}>
      {refreshed && (
        <VirtualizedList
          items={frames}
          renderItem={(idx) => (
            <CallStackRow
              key={idx}
              index={idx}
              slot={(spValue + idx * 2) & 0xffff}
              frame={frames[idx]}
            />
          )}
        />
      )}
      {!refreshed && <EmptyState message="Call stack not available" />}
    </div>
  );
};

