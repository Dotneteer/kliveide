import { Label, LabelSeparator, Secondary, Value } from "@controls/Labels";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa2 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./NextRegPanel.module.scss";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import {} from "@controls/Tooltip";
import { reportMessagingError, reportUnexpectedMessageType } from "@renderer/reportError";
import { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/NextRegDevice";

const VAR_WIDTH = 64;
const WRITE_VALUE_WIDTH = 60;
const VALUE_WIDTH = 32;

let nextRegDescriptors: Record<number, NextRegDescriptor>;

const NextRegPanel = () => {
  const { messenger } = useRendererContext();
  const [lastRegIndex, setLastRegIndex] = useState<number>();
  const [regVals, setRegVals] = useState<RegValueState[]>();
  const machineState = useSelector((s) => s.emulatorState?.machineState);

  useEffect(() => {
    if (messenger && !nextRegDescriptors) {
      messenger.sendMessage({ type: "EmuGetNextRegDescriptors" }).then((response) => {
        if (response.type === "EmuGetNextRegDescriptorsResponse") {
          const descr = response.descriptors;
          nextRegDescriptors = {};
          descr.forEach((d) => {
            nextRegDescriptors[d.id] = d;
          });
        }
        console.log("NextRegDescriptors", nextRegDescriptors);
      });
    }
  }, [messenger]);

  // --- This function queries the breakpoints from the emulator
  const refreshNextDeviceState = async () => {
    // --- Get breakpoint information
    const response = await messenger.sendMessage({
      type: "EmuGetNextRegState"
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`EmuGetNextRegState call failed: ${response.message}`);
    } else if (response.type !== "EmuGetNextRegStateResponse") {
      reportUnexpectedMessageType(response.type);
    } else {
      setLastRegIndex(response.lastRegisterIndex);
      setRegVals(response.regs);
    }
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      await refreshNextDeviceState();
    })();
  }, [machineState]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshNextDeviceState();
  });

  return (
    <div className={styles.nextRegPanel}>
      <div className={styles.regItem}>
        <LabelSeparator width={4} />
        <Label text={`Last Reg Index:`} />
        <LabelSeparator width={4} />
        <Value text={toHexa2(lastRegIndex ?? 0)} />
      </div>
      <VirtualizedListView
        items={regVals ?? []}
        approxSize={20}
        fixItemHeight={true}
        itemRenderer={(idx) => {
          const item = regVals[idx];
          return (
            <div className={styles.regItem}>
              <LabelSeparator width={4} />
              <Label text={`Reg ${toHexa2(item.id)}:`} width={VAR_WIDTH} tooltip={nextRegDescriptors[item.id]?.description}/>
              {item.lastWrite !== undefined && (
                <Secondary text={`${item.value !== undefined ? toHexa2(item.value) : "X"} --> `} width={WRITE_VALUE_WIDTH} />
              )}
              {item.value !== undefined && (
                <Value text={`${toHexa2(item.value)}`} width={VALUE_WIDTH} />
              )}
            </div>
          );
        }}
      />
    </div>
  );
};

export const nextRegPanelRenderer = () => <NextRegPanel />;
