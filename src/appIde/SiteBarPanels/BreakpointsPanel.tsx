import { Icon } from "@/controls/common/Icon";
import { Label, Secondary, Value } from "@/controls/common/Labels";
import {
  VirtualizedList,
} from "@/controls/common/VirtualizedList";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { BreakpointInfo } from "@/emu/abstractions/ExecutionContext";
import { EmuListBreakpointsResponse } from "@messaging/main-to-emu";
import { useEffect, useState } from "react";
import { toHexa4 } from "../services/interactive-commands";
import styles from "./BreakpointsPanel.module.scss";

const BreakpointsPanel = () => {
  const { messenger } = useRendererContext();
  const [bps, setBps] = useState<BreakpointInfo[]>([]);
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);

  const obtainBreakpoints = async () => {
    return await messenger.sendMessage({
      type: "EmuListBreakpoints"
    }) as EmuListBreakpointsResponse;
  }

  useEffect(() => {
    (async function() {
      const obtained = (await obtainBreakpoints()).breakpoints;
      setBps(obtained);
    })();
  }, [machineState, bpsVersion])

  return (
    <div className={styles.component}>
      {bps.length === 0 && (
        <div className={styles.center}>No breakpoints defined </div>
      )}
      <VirtualizedList
        items={bps}
        approxSize={20}
        fixItemHeight={false}
        itemRenderer={idx => {
          return (
            <div className={styles.breakpoint}>
              <Icon
                iconName='circle-filled'
                width={16}
                height={16}
                fill='red'
              />
              <Value text={`${toHexa4(bps[idx].address)}`} width={40} />
              <Secondary text={`(${bps[idx].address})`} width={64} />
            </div>
          );
        }}
      />
    </div>
  );
};

export const breakpointsPanelRenderer = () => <BreakpointsPanel />;
