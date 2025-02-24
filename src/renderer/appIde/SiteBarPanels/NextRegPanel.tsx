import { Label, LabelSeparator, Secondary, Value } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa2 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./NextRegPanel.module.scss";
import {} from "@controls/Tooltip";
import { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/NextRegDevice";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";

const VAR_WIDTH = 64;
const WRITE_VALUE_WIDTH = 60;
const VALUE_WIDTH = 32;

let nextRegDescriptors: Record<number, NextRegDescriptor>;

const NextRegPanel = () => {
  const emuApi = useEmuApi();
  const [lastRegIndex, setLastRegIndex] = useState<number>();
  const [regVals, setRegVals] = useState<RegValueState[]>();
  const machineState = useSelector((s) => s.emulatorState?.machineState);

  useEffect(() => {
    if (emuApi && !nextRegDescriptors) {
      emuApi.getNextRegDescriptors().then((response) => {
        const descr = response.descriptors;
        nextRegDescriptors = {};
        descr.forEach((d) => {
          nextRegDescriptors[d.id] = d;
        });
      });
    }
  }, [emuApi]);

  // --- This function queries the breakpoints from the emulator
  const refreshNextDeviceState = async () => {
    // --- Get breakpoint information
    const response = await emuApi.getNextRegState();
    setLastRegIndex(response.lastRegisterIndex);
    setRegVals(response.regs);
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
      <VirtualizedList
        items={regVals ?? []}
        renderItem={(idx) => {
          const item = regVals[idx];
          return (
            <div className={styles.regItem}>
              <LabelSeparator width={4} />
              <Label
                text={`Reg ${toHexa2(item.id)}:`}
                width={VAR_WIDTH}
                tooltip={nextRegDescriptors[item.id]?.description}
              />
              {item.lastWrite !== undefined && (
                <Secondary
                  text={`${item.value !== undefined ? toHexa2(item.value) : "X"} --> `}
                  width={WRITE_VALUE_WIDTH}
                />
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
