import { Label, LabelSeparator, Secondary, Value } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa4 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./CallStackPanel.module.scss";
import { Icon } from "@renderer/controls/Icon";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";

const CallStackPanel = () => {
  const emuApi = useEmuApi();
  const [refreshed, setRefreshed] = useState(false);
  const [spValue, setSpValue] = useState<number>();
  const [frames, setFrames] = useState<number[]>();
  const machineState = useSelector((s) => s.emulatorState?.machineState);

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
  }, [machineState]);

  // --- Take care of refreshing the screen
  useStateRefresh(1000, async () => {
    await refreshMemoryMappingState();
  });

  return (
    <div className={styles.callStackPanel}>
      {refreshed && (
        <VirtualizedList
          items={frames}
          renderItem={(idx) => {
            return (
              <div key={idx} className={styles.item}>
                <Secondary text={`${idx ? idx : "Top"}:`} width={32} />
                <LabelSeparator width={4} />
                <Label text={toHexa4((spValue + idx * 2) & 0xffff)} />
                <LabelSeparator width={4} />
                <Icon iconName="arrow-small-right" width={16} height={16} />
                <LabelSeparator width={4} />
                <Value text={toHexa4(frames[idx])} />
              </div>
            );
          }}
        />
      )}
      {!refreshed && <div className={styles.center}>Call stack not available</div>}
    </div>
  );
};

export const callStackPanelRenderer = () => <CallStackPanel />;
